// ═══════════════════════════════════════════════════════════════════════════
// NOVA — Backend Server (ESM)
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
//
// ARCHITECTURE
//   • Node.js 20+ · Express 5 · better-sqlite3
//   • p-queue (concurrency=1) — strictly sequential Ollama inference
//   • opossum — circuit breaker on Ollama handshake
//   • SSE streaming from Node → React (token-by-token)
//   • phi3:mini via Ollama (http://127.0.0.1:11434)
//
// QUAD-LAYER ARMOR v2.0
//   L1  PII scrubbing (NZ-specific: NHI, IRD, phone, email, address)
//   L2  Rate limiting (session-based, NOT IP-based)
//   L3  Zero Data Retention (nothing persists beyond HTTP lifetime)
//   L4  Helmet CSP · HSTS · anonymous audit counters only
//
// PRIVACY GUARANTEES (enforced in code, not just in comments)
//   ✘ req.body.message is NEVER console.log'd, NEVER file-logged
//   ✘ No IP is persisted anywhere (in-memory rate limit uses hashed IP only)
//   ✘ No message content reaches SQLite — only region/topic/language codes
//   ✔ Explicit user consent required before any /api/chat call succeeds
// ═══════════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import CircuitBreaker from 'opossum';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

import * as store from './database.js';

// p-queue is ESM-only and has no default named-import surface in CJS
// (We're already ESM so this is a clean static import)
import PQueue from 'p-queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const PORT               = parseInt(process.env.PORT || '3000', 10);
const OLLAMA_URL         = process.env.OLLAMA_URL   || 'http://127.0.0.1:11434';
const OLLAMA_MODEL       = process.env.OLLAMA_MODEL || 'phi3:mini';   // phi3:mini via Ollama (default)
const OLLAMA_NUM_CTX     = parseInt(process.env.OLLAMA_NUM_CTX     || '2048', 10);
const OLLAMA_NUM_PREDICT = parseInt(process.env.OLLAMA_NUM_PREDICT || '45',   10); // ~2-3 sentences @ 0.8tok/s = ~100s
const OLLAMA_KEEP_ALIVE  = process.env.OLLAMA_KEEP_ALIVE || '2h';

// Circuit breaker + queue timings
const QUEUE_TIMEOUT_MS       = parseInt(process.env.QUEUE_TIMEOUT_MS       || '360000', 10); // total in queue
const HANDSHAKE_TIMEOUT_MS   = parseInt(process.env.HANDSHAKE_TIMEOUT_MS   || '360000', 10); // breaker wraps this (phi3:mini cold-loads ~6s)
const STREAM_HARD_TIMEOUT_MS = parseInt(process.env.STREAM_HARD_TIMEOUT_MS || '360000', 10); // phi3:mini 2-vCPU: ~280ms/tok, V10c ~225s cold + ~135s gen

// Security
const SESSION_SECRET   = process.env.SESSION_SECRET   || randomUUID();
const ADMIN_USERNAME   = process.env.ADMIN_USERNAME   || 'burnett';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16) {
  console.error('FATAL: ADMIN_PASSWORD must be set in .env and be at least 16 characters');
  process.exit(1);
}
const ADMIN_COOKIE_NAME = 'nova_admin';
const ADMIN_SESSION_MS  = 8 * 60 * 60 * 1000; // 8 hours

// Allowed origins (CORS)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  || 'http://localhost:5173,http://localhost:3000,https://matauranga-nova.onrender.com'
).split(',').map(s => s.trim()).filter(Boolean);

// Safe console helper — blocks anything resembling free-form text
// (Extra-paranoid belt-and-braces enforcement of the "no PII in logs" rule.)
const safeLog = {
  info:  (msg, meta = {}) => console.log(`[${new Date().toISOString()}] ${msg}`, stripStrings(meta)),
  warn:  (msg, meta = {}) => console.warn(`[${new Date().toISOString()}] ${msg}`, stripStrings(meta)),
  error: (msg, meta = {}) => console.error(`[${new Date().toISOString()}] ${msg}`, stripStrings(meta))
};
function stripStrings(obj) {
  // Replace any string value longer than 80 chars with [REDACTED_LEN=n]
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (typeof v === 'string' && v.length > 80) out[k] = `[REDACTED_LEN=${v.length}]`;
    else out[k] = v;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════
{
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  store.ensureAdmin(ADMIN_USERNAME, passwordHash);
}

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════
const app = express();
app.set('trust proxy', 1); // needed for rate-limit to see real client IP behind nginx
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com", "data:"],
      scriptSrc:  ["'self'"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, health checks
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Session-Id']
}));

app.use(express.json({ limit: '12kb' }));
app.use(cookieParser(SESSION_SECRET));

// ─── Fingerprinting prevention — strip tracking headers on every request ──
app.use((req, _res, next) => {
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];
  delete req.headers['user-agent'];
  delete req.headers['referer'];
  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2 — RATE LIMITING (session-based, never persists IP)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Rate-limit key is the session UUID (from header or body), falling back to
 * an HMAC'd IP for anonymous abuse protection. The hashed IP lives only in
 * the rate-limit LRU cache (in-memory, rotated on restart). It is never
 * persisted, never logged, never sent to SQLite.
 */
function rateLimitKey(req) {
  const sid = req.get('X-Session-Id') || req.body?.sessionId;
  if (sid && typeof sid === 'string' && sid.length >= 8) return `s:${sid.slice(0, 64)}`;
  const ip = req.ip || 'unknown';
  return 'h:' + createHmac('sha256', SESSION_SECRET).update(ip).digest('hex').slice(0, 12);
}

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Too many messages. Please wait a moment.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: rateLimitKey
});

const adminChatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: rateLimitKey
});

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1 — PII SCRUBBING (NZ-specific patterns)
// Runs BEFORE any prompt leaves Node and goes to Ollama.
// ═══════════════════════════════════════════════════════════════════════════

// In-memory PII counters (process lifetime — resets on restart, never persisted)
const piiCounters = { total: 0, email: 0, phone: 0, nhi: 0, ird: 0, card: 0, address: 0 };

function scrubPII(text) {
  if (typeof text !== 'string') return '';
  const tally = (re, key) => {
    const m = text.match(re);
    if (m) { piiCounters[key] += m.length; piiCounters.total += m.length; }
  };
  tally(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'email');
  tally(/\b(?:\+?64[\s.-]?|0)\d[\d\s.-]{6,12}\b/g, 'phone');
  tally(/\b[A-Z]{3}\d{4}\b/g, 'nhi');
  tally(/\b[A-Z]{3}\d{2}[A-Z]\d\b/g, 'nhi');
  tally(/\b\d{2,3}[-\s]?\d{3}[-\s]?\d{3}\b/g, 'ird');
  tally(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, 'card');
  tally(/\b\d{1,4}\s+[A-Z][a-z]+\s+(Street|Road|Avenue|Lane|Drive|Place|Crescent|Way|Terrace|St|Rd|Ave|Ln|Dr|Pl|Cr|Tce)\b/gi, 'address');
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(?:\+?64[\s.-]?|0)\d[\d\s.-]{6,12}\b/g, '[PHONE]')
    .replace(/\b[A-Z]{3}\d{4}\b/g, '[NHI]')
    .replace(/\b[A-Z]{3}\d{2}[A-Z]\d\b/g, '[NHI]')
    .replace(/\b\d{2,3}[-\s]?\d{3}[-\s]?\d{3}\b/g, '[IRD]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
    .replace(/\b\d{1,4}\s+[A-Z][a-z]+\s+(Street|Road|Avenue|Lane|Drive|Place|Crescent|Way|Terrace|St|Rd|Ave|Ln|Dr|Pl|Cr|Tce)\b/gi, '[ADDRESS]');
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPIC EXTRACTION (local regex — no LLM used for tagging)
// ═══════════════════════════════════════════════════════════════════════════
const TOPIC_PATTERNS = {
  HIV:                      /\b(vih|hiv|seropositiv|positivo al|positive result|aids|sida)\b/i,
  New_Diagnosis:            /\b(just (found out|got diagnosed|tested positive)|me acabo de enterar|recien diagnostic|nuevo diagnostic|newly diagnosed)\b/i,
  PrEP:                     /\b(prep|pre[\s-]?exposure prophylaxis|profilaxis pre[\s-]?exposici[oó]n|lenacapavir|yeztugo)\b/i,
  PEP:                      /\b(pep|post[\s-]?exposure|72 hours|72 horas|exposure last night|anoche tuve)\b/i,
  DoxyPEP:                  /\b(doxypep|doxy[\s-]?pep|doxycycline|doxiciclina)\b/i,
  UeqU:                     /\b(u=u|u equals u|undetectable\s?=\s?untransmittable|indetectable|viral load undetect)\b/i,
  Syphilis:                 /\b(syphilis|s[ií]filis|treponema|hupiria)\b/i,
  Chlamydia:                /\b(chlamydia|clamidia)\b/i,
  Gonorrhoea:               /\b(gonorrhoea|gonorrhea|gonorrea)\b/i,
  STI_Testing:              /\b(sti test|std test|prueba (de )?its|full screen|sexual health (check|screen)|whakamātautau)\b/i,
  Long_Term_Living:         /\b(living with hiv for|tengo vih hace|living long[\s-]?term|a[nñ]os con vih|diagnosed \d+ years)\b/i,
  ART_Medication:           /\b(art|antiretroviral|antirretroviral|tenofovir|dolutegravir|biktarvy|bictegravir)\b/i,

  Suicide_Ideation:         /\b(suicid|kill myself|end (my|it) (all|life)|matarme|me quiero morir|no quiero vivir|want to die|acabar con todo)\b/i,
  Self_Harm:                /\b(self[\s-]?harm|hurt myself|cutting|cortarme|hacerme da[nñ]o|lastimarme)\b/i,
  Crisis_Acute:             /\b(no puedo m[aá]s|can'?t do this anymore|can'?t cope|estoy colapsando|breakdown|falling apart|no aguanto)\b/i,
  Anxiety:                  /\b(anxiety|anxious|panic|ansiedad|ansioso|ataque de p[aá]nico|overwhelm|māharahara)\b/i,
  Depression:               /\b(depress|depresi[oó]n|depressed|deprimido|hopeless|sin esperanza|no hope|pōkaikaha)\b/i,
  Loneliness:               /\b(lonely|loneliness|solo|soledad|aislado|isolated|no one|nadie|mokemoke)\b/i,

  Internal_Stigma:          /\b(ashamed|verg[uü]enza|self[\s-]?hate|shame|disgusting|asqueroso|soy sucio|worthless|whakam[aā]|dirty|unworthy|sucio|sucia|avergonzado|avergonzada|verg[uü]enza|inmundo|impuro|culpa|culpable)\b/i,
  External_Discrimination:  /\b(discriminat|discrimin[aá]|rechaz|rejected|prejudice|prejuicio|they treat me)\b/i,
  Bullying:                 /\b(bully|bullied|bullying|acoso|me molestan|harassment|hostig|whakaweti)\b/i,
  Online_Hate:              /\b(online hate|cyberbully|ciberacoso|hate speech|trolling|insultos online|ataques en redes)\b/i,
  Workplace_Discrimination: /\b(fired|me despid|discrimin(ated|aron) at work|boss found out|trabajo discrimin|workplace hiv)\b/i,
  Medical_Discrimination:   /\b(doctor refused|m[eé]dico se neg[oó]|denied treatment|hospital discriminat|clinic refused|clinic stigma|judged by)\b/i,

  LGBTQIA_Takatapui:        /\b(gay|lesbian|bisexual|\bbi\b|trans|transgender|queer|non[\s-]?binary|takat[aā]pui|lgbt|rainbow whanau)\b/i,
  Disclosure:               /\b(tell (my|him|her|them)|decirle|contarle|disclos|come out|revelarle|should i tell)\b/i,
  Whanau_Family:            /\b(wh[aā]nau|family|familia|parents|padres|mum|dad|mam[aá]|pap[aá]|hermano|hermana|sibling)\b/i,

  WINZ:                     /\b(winz|work and income|benefit|subsidio|jobseeker|supported living|disability allowance)\b/i,
  Housing_Council:          /\b(housing|council|vivienda|k[aā]inga ora|homeless|sin casa|rent (assistance|help)|housing nz)\b/i,
  Legal_Rights:              /\b(human rights|derechos humanos|legal advice|asesor[ií]a legal|lawyer|abogado|hrc|discriminaci[oó]n legal)\b/i,
  Immigration:              /\b(immigration|inmigraci[oó]n|visa|residency|residencia|work permit|hiv visa)\b/i,

  Takatapui_Specific:       /\b(takat[aā]pui|m[aā]ori (and |gay|queer|rainbow)|kaupapa m[aā]ori (lgbt|rainbow|queer))\b/i,
  Pacific_Wellbeing:        /\b(pasifika|pacific|samoan|tongan|fijian|niuean|cook islands|fa'afafine|leiti|akava'ine)\b/i,
  Ageing_with_HIV:          /\b(ageing|aging|older with hiv|kaum[aā]tua|pensioner|superannuation|living \d{2,} years)\b/i,
  Rural_Access:             /\b(rural|small town|no clinic near|countryside|remote|far from|live in the country)\b/i,
  Stigma_Clinic_Audit:      /\b(bad experience (at|with) (the )?(doctor|clinic|hospital|gp)|clinic (was|treated me|is) (awful|racist|homophobic)|gp wouldn'?t|m[eé]dico me trat[oó] mal|clinic stigma)\b/i
};

// Set of crisis topic codes (kept in sync with database seed)
const CRISIS_TOPICS = new Set(['Suicide_Ideation', 'Self_Harm', 'Crisis_Acute']);

// Topics that warrant an expanded token budget for fuller responses
const STIGMA_TOPICS = new Set(['Internal_Stigma', 'Medical_Discrimination']);

function extractTopics(text) {
  const found = [];
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(text)) found.push(topic);
  }
  return found;
}

function detectLanguage(text) {
  const lowered = text.toLowerCase();

  // Greetings excluded: kia ora, hola, hello, hi — too common in mixed messages
  const patterns = {
    mi: /\b(wh[aā]nau|aroha|hauora|m[aā]tauranga|t[eē]n[aā]|whakapapa|rangatahi|kai[aā]whina|tamariki|wahine|t[aā]ne|reo|iwi|hap[uū]|marae|taonga|wairua|tikanga)\b/gi,
    es: /\b(soy|estoy|tengo|quiero|necesito|siento|hace|cu[aá]ndo|porque|ahora|c[oó]mo|qu[eé]|para|esto|tambi[eé]n|mucho|nada|aqu[ií]|familia|salud|miedo|ayuda|recib[ií]|diagn[oó]stico|positivo|prueba|examen|m[eé]dico|doctora|doctor|gracias|no s[eé])\b/gi,
    en: /\b(have|need|want|feel|just|received|tested|positive|diagnosis|scared|worried|help|family|health|doctor|today|yesterday|something|nothing|because|about|really|please|don't|doesn't|can't|i'm|it's)\b/gi,
  };

  const scores = {
    mi: (lowered.match(patterns.mi) || []).length,
    es: (lowered.match(patterns.es) || []).length,
    en: (lowered.match(patterns.en) || []).length,
  };

  const max = Math.max(scores.mi, scores.es, scores.en);
  if (max === 0) return 'en';
  if (scores.es === max) return 'es';
  if (scores.mi === max) return 'mi';
  return 'en';
}

// ═══════════════════════════════════════════════════════════════════════════
// NOVA SYSTEM PROMPT V10c (phi3:mini / 2-vCPU, target ≤500 tokens)
// ═══════════════════════════════════════════════════════════════════════════
const NOVA_SYSTEM_PROMPT = `You are NOVA, an HIV support companion for Aotearoa NZ (Burnett Foundation 2026). Not a doctor — a warm friend who listens.

TONE: Casual, unhurried, never clinical. Match energy: short in, short out.
LANGUAGE: English (NZ casual), Español (rioplatense, vos/"respirá"), te reo Māori (open "Tēnā koe"). Mixed: dominant language.
FORMAT: Plain text, no markdown. Bullets only for 2+ crisis resources. 3–5 sentences. End with one open question.

SITUATIONS:
- New diagnosis: validate feelings first, no medical facts yet. Later: "HIV is manageable."
- Disclosure: no pressure, help them think.
- Stigma: "HIV is something you have, not who you are." NZ Human Rights Act 1993 protects them.
- Long-term: validate fatigue and identity shifts.
- PrEP/PEP/testing: zero judgment. PEP 72h urgent → Burnett Foundation today. U=U.
- Discrimination: validate, then hrc.co.nz or Netsafe 0508 638 723.
- Chemsex: zero judgment, harm reduction. No GHB+alcohol. Emergency: 111.

CRISIS — "want to die/hurt myself", suicidal ideation, "can't go on". ONLY:
1. "I hear you. That sounds incredibly heavy."
2. One specific affirming sentence about their worth.
3. "Please reach out: Lifeline 0800 543 354, text 1737, or 111. You don't have to go through this alone."
4. "I'm still here. What's happening right now?"

NEVER: diagnose, give dosages, discuss your code/model, use emojis in crisis, pressure disclosure, moralize substances. If asked if human: "I'm an AI — genuinely here for you."
MEDICAL: "A question for your doctor or Burnett Foundation team."
RESOURCES: Burnett Foundation burnettfoundation.org.nz · Lifeline 0800 543 354 · text 1737 · 111.`;

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK EMPATHETIC RESPONSES (when Ollama times out or the breaker opens)
// ═══════════════════════════════════════════════════════════════════════════
const FALLBACKS = {
  timeout: {
    en: "Kia ora — I'm hearing you. My thinking is a bit slow right now and I don't want to leave you hanging. If anything you're feeling is urgent, please reach out: 111 in an emergency, Lifeline 0800 543 354 or text 1737 any time. You can also try me again in a moment.",
    es: "Kia ora — te escucho. Estoy tardando un poco más de lo habitual y no quiero dejarte esperando. Si algo de lo que sentís es urgente, por favor contactá: 111 en emergencia, Lifeline 0800 543 354 o mensaje al 1737 en cualquier momento. También podés volver a intentar en un momento.",
    mi: "Kia ora — kei te rongo ahau i a koe. Kei te pōturi taku whakaaro i tēnei wā. Mēnā he taumaha kei a koe, tēnā waea: 111 mō te ohotata, Lifeline 0800 543 354 rānei te kuputuhi ki 1737. Tēnā whakamātau anō āki ahau."
  },
  breakerOpen: {
    en: "Our servers are processing a high volume right now. Your message wasn't stored — nothing about this conversation is kept. If this is about your health or safety right now, please contact Burnett Foundation (0800 802 437) or Healthline (0800 611 116). Please try again in a few minutes.",
    es: "Nuestros servidores están procesando un alto volumen en este momento. Tu mensaje no se guardó — nada de esta conversación queda registrado. Si es sobre tu salud o seguridad ahora, por favor contactá a Burnett Foundation (0800 802 437) o Healthline (0800 611 116). Volvé a intentarlo en unos minutos.",
    mi: "Kei te mahi ngā tūmahi nui ā mātou tūmau i tēnei wā. Kāore tō kōrero i tiakina. Mēnā he taumaha, tēnā whakapā ki Burnett Foundation (0800 802 437) ki Healthline rānei (0800 611 116). Tēnā whakamātau anō i ētahi wā."
  },
  error: {
    en: "Something on my end went wrong, but your message wasn't saved anywhere — nothing about this conversation is stored. If this is urgent, please reach out: 111, Lifeline 0800 543 354, or text 1737. I'll be here when you want to try again.",
    es: "Algo falló por mi parte, pero tu mensaje no se guardó en ningún lado — nada de esta conversación queda registrado. Si es urgente, por favor contactá: 111, Lifeline 0800 543 354, o mensaje al 1737. Voy a estar acá cuando quieras intentar de nuevo.",
    mi: "He raru i taku taha, engari kāore tō kōrero i tiakina. Mēnā he taumaha, waea ki te 111, Lifeline 0800 543 354, kuputuhi rānei ki 1737. Ka noho ahau i konei mō tō hokinga mai."
  }
};
const pickFallback = (kind, lang) => {
  const base = (FALLBACKS[kind]?.[lang]) || FALLBACKS[kind]?.en || '';
  const support = DISTRESS_SUPPORT_MSG[lang] || DISTRESS_SUPPORT_MSG.en || '';
  return base ? `${base}\n\n${support}` : base;
};

// ═══════════════════════════════════════════════════════════════════════════
// THREE-TIER KEYWORD ESCALATION SYSTEM
//
//  LEVEL 3 — HARMFUL_KEYWORDS  : methods of self-harm → hardcoded safety msg
//  LEVEL 3 — CRISIS_KEYWORDS   : active crisis/suicidal intent → hardcoded safety msg
//  LEVEL 2 — DISTRESS_KEYWORDS : indirect distress → model response + support note
//  LEVEL 1 — no match          : normal phi3:mini response
//
// All checks run on the PII-scrubbed text. Nothing is forwarded to Ollama
// for Level 3. Level 2 reaches Ollama, then appends a support message.
// ═══════════════════════════════════════════════════════════════════════════

// Level 3 — harmful content (methods queries)
const HARMFUL_KEYWORDS = {
  es: [/c[oó]mo sobredosificarme/i, /cu[aá]ntas pastillas/i, /c[oó]mo cortarme/i, /c[oó]mo ahorcarme/i, /mejor forma de morir/i],
  en: [/how to overdose/i, /how many pills/i, /how to cut/i, /how to hang/i, /best way to die/i, /painless way/i],
};

// Level 3 — active crisis / suicidal intent
const CRISIS_KEYWORDS = {
  mi: [/\bwhakamomori\b/i],
  es: [/\bsuicidio\b/i, /\bmatarme\b/i, /\bno quiero vivir\b/i, /\bhacerme da[nñ]o\b/i, /\bquitarme la vida\b/i],
  en: [/\bsuicide\b/i, /\bkill myself\b/i, /\bend my life\b/i, /\bself[- ]?harm\b/i, /\bdon'?t want to live\b/i, /\bcan'?t go on\b/i],
};

// Level 3 hardcoded safety message (harmful + crisis share the same response)
const CRISIS_SAFETY_MSG = {
  en: "I hear you. Please contact 1737 — free call or text, 24/7. Or call Youthline 0800 376 633. You don't have to go through this alone.",
  es: "Te escucho. Por favor contactá al 1737 — llamada o texto gratis, 24/7. O llamá a Youthline 0800 376 633. No tenés que pasar por esto solo.",
  mi: "Kei konei ahau. Whakapā atu ki te 1737 — free, 24/7. Youthline rānei: 0800 376 633.",
};

// Level 2 — indirect distress (model still responds; support note appended after)
const DISTRESS_KEYWORDS = {
  mi: [/kua heke t[oō]ku ng[aā]kau/i, /k[aā]ore he take/i],
  es: [/estoy cansado de todo/i, /nadie me extrañar[íi]a/i, /a nadie le importo/i, /me siento invisible/i, /para qu[eé]/i, /no puedo m[aá]s/i, /soy una carga/i],
  en: [/tired of everything/i, /nobody would miss me/i, /nobody cares/i, /i feel invisible/i, /what'?s the point/i, /i can'?t do this anymore/i, /\b(i'?m|feel(s)? like) a burden\b/i],
};

// Level 2 support note appended after model response
const DISTRESS_SUPPORT_MSG = {
  en: "I'm here with you. If things feel too heavy, 1737 is free to call or text anytime, or call Youthline 0800 376 633.",
  es: "Estoy acá con vos. Si se siente muy pesado, podés llamar o escribir al 1737, o llamar a Youthline 0800 376 633.",
  mi: "Kei konei ahau. Whakapā atu ki te 1737 ahakoa āhea, Youthline rānei: 0800 376 633.",
};

function detectHarmfulKeywords(text) {
  for (const lang of ['es', 'en']) {
    if (HARMFUL_KEYWORDS[lang].some(re => re.test(text))) return lang;
  }
  return null;
}
function detectCrisisKeywords(text, detectedLang) {
  for (const lang of ['mi', 'es', 'en']) {
    if (lang !== detectedLang) continue;
    if (CRISIS_KEYWORDS[lang].some(re => re.test(text))) return lang;
  }
  return null;
}
function detectDistressKeywords(text) {
  for (const lang of ['mi', 'es', 'en']) {
    if (DISTRESS_KEYWORDS[lang].some(re => re.test(text))) return lang;
  }
  return null;
}
function hashSessionId(sid) {
  return createHmac('sha256', SESSION_SECRET).update(String(sid)).digest('hex').slice(0, 12);
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION EXPIRY — 30-minute inactivity window (in-memory, never persisted)
// ═══════════════════════════════════════════════════════════════════════════
const SESSION_EXPIRY_MS = 30 * 60 * 1000;
const sessionActivity = new Map(); // raw sid → lastActivity ms epoch (ephemeral)

function touchSession(sid) {
  sessionActivity.set(sid, Date.now());
}

function checkAndExpireSession(sid) {
  const last = sessionActivity.get(sid);
  if (!last) return false; // first message from this session — not expired
  return Date.now() - last > SESSION_EXPIRY_MS;
}

// Prune stale entries every 30 min to keep the Map bounded
setInterval(() => {
  const cutoff = Date.now() - SESSION_EXPIRY_MS * 2;
  for (const [sid, ts] of sessionActivity) {
    if (ts < cutoff) sessionActivity.delete(sid);
  }
}, SESSION_EXPIRY_MS).unref();

// ═══════════════════════════════════════════════════════════════════════════
// OLLAMA — queue + circuit breaker
// ═══════════════════════════════════════════════════════════════════════════
const ollamaQueue = new PQueue({
  concurrency: 1,                 // strict sequential: matches OLLAMA_NUM_PARALLEL=1
  timeout:     QUEUE_TIMEOUT_MS,
  throwOnTimeout: true
});

/**
 * Opens an Ollama chat stream. The breaker wraps only the HANDSHAKE
 * (the initial fetch + first HTTP response). Streaming continues outside
 * the breaker under an AbortController hard-timeout.
 */
async function openOllamaStream({ messages, stream = true, signal, model = OLLAMA_MODEL, numPredict = OLLAMA_NUM_PREDICT }) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, stream, messages,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        num_ctx:     OLLAMA_NUM_CTX,
        num_predict: numPredict,
        temperature: 0.7,
        top_p:       0.9,
        repeat_penalty: 1.15
      }
    }),
    signal
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 160)}`);
  }
  return res;
}

const ollamaBreaker = new CircuitBreaker(openOllamaStream, {
  timeout:                  HANDSHAKE_TIMEOUT_MS,
  errorThresholdPercentage: 50,
  resetTimeout:             30000,
  rollingCountTimeout:      60000,
  rollingCountBuckets:      10,
  volumeThreshold:          5,
  name:                     'ollama-chat'
});

ollamaBreaker.on('open',     () => safeLog.warn('circuit OPEN',      { breaker: 'ollama-chat' }));
ollamaBreaker.on('halfOpen', () => safeLog.info('circuit HALF-OPEN', { breaker: 'ollama-chat' }));
ollamaBreaker.on('close',    () => safeLog.info('circuit CLOSED',    { breaker: 'ollama-chat' }));

/** Consume Ollama's NDJSON stream, yielding parsed objects. Buffers partial lines. */
async function* consumeOllamaNdjson(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        try { yield JSON.parse(line); } catch { /* skip malformed */ }
      }
    }
    if (buf.trim()) { try { yield JSON.parse(buf); } catch { /* noop */ } }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN AUTH — signed cookie (no external session store needed)
// ═══════════════════════════════════════════════════════════════════════════
function signAdminToken(username) {
  const payload = `${username}:${Date.now()}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}
function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let payload;
  try { payload = Buffer.from(b64, 'base64url').toString('utf8'); } catch { return null; }
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [username, tsStr] = payload.split(':');
  const ts = parseInt(tsStr, 10);
  if (!username || !ts || Date.now() - ts > ADMIN_SESSION_MS) return null;
  return username;
}
function requireAdmin(req, res, next) {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  const user = verifyAdminToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.adminUser = user;
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — PUBLIC METADATA
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/metadata', (_req, res) => {
  res.json({
    regions: store.getRegions(),
    topics:  store.getTopics(),
    model:   OLLAMA_MODEL,
    version: '2.0.0'
  });
});

app.get('/api/health', async (_req, res) => {
  let ollamaUp = false, modelLoaded = false;
  try {
    const r = await fetch(`${OLLAMA_URL}/api/ps`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      ollamaUp = true;
      const { models = [] } = await r.json();
      modelLoaded = models.some(m => (m.name || '').startsWith(OLLAMA_MODEL));
    }
  } catch { /* ollamaUp remains false */ }

  const memAvailMb = readMemAvailableMb();
  const breakerOpen = ollamaBreaker.opened;
  const ok = ollamaUp && (memAvailMb === null || memAvailMb > 800) && !breakerOpen;
  res.status(ok ? 200 : 503).json({
    ok, ollamaUp, modelLoaded, breakerOpen,
    memAvailableMb: memAvailMb,
    queueSize: ollamaQueue.size,
    queuePending: ollamaQueue.pending,
    uptime: Math.floor(process.uptime()),
    model: OLLAMA_MODEL
  });
});

function readMemAvailableMb() {
  try {
    const meminfo = readFileSync('/proc/meminfo', 'utf8');
    const m = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
    return m ? Math.round(parseInt(m[1], 10) / 1024) : null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — CHAT (SSE streaming)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/chat', chatLimiter, async (req, res) => {
  // ─── Input validation ──────────────────────────────────────────────────
  const { message, sessionId, regionCode, history, consent } = req.body || {};

  if (consent !== true) {
    return res.status(403).json({ error: 'Consent required before starting a conversation.' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Empty message.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // ─── Session expiry — discard client history if session was idle >30 min ─
  const sessionExpired = checkAndExpireSession(sessionId);
  if (sessionExpired) {
    safeLog.info('session_expired', { sid: hashSessionId(sessionId) });
  }
  touchSession(sessionId);
  const effectiveHistory = sessionExpired ? [] : (history || []);

  // Validate region
  const validRegions = new Set(store.getRegions().map(r => r.code));
  const region = validRegions.has(regionCode) ? regionCode : 'NAT';

  // ─── L1 scrub + local topic extraction ─────────────────────────────────
  const scrubbed = scrubPII(message);
  const detectedTopics = extractTopics(scrubbed);
  const lang = detectLanguage(scrubbed);
  const isCrisis = detectedTopics.some(t => CRISIS_TOPICS.has(t));
  const harmfulKeywordLang  = detectHarmfulKeywords(scrubbed);
  const crisisKeywordLang   = detectCrisisKeywords(scrubbed, lang);
  const distressKeywordLang = detectDistressKeywords(scrubbed);

  // ─── Record anonymous analytics (topics + region + language + hour) ────
  try {
    if (detectedTopics.length > 0) {
      store.recordEventsBatch(detectedTopics.map(topicCode => ({
        sessionUuid: hashSessionId(sessionId), regionCode: region, topicCode, language: lang, isCrisis: isCrisis && CRISIS_TOPICS.has(topicCode)
      })));
    } else {
      // record a generic "unmatched" hit under HIV bucket for session counting? No — skip.
      // We still want session counts; insert a tiny counter row against HIV as the catch-all.
      // Better: don't invent data. Leave it empty if no topic matched.
    }
  } catch (e) {
    safeLog.warn('analytics insert failed', { err: String(e?.message).slice(0, 120) });
  }

  // ─── SSE headers ───────────────────────────────────────────────────────
  res.set({
    'Content-Type':      'text/event-stream; charset=utf-8',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  const sse = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Announce metadata up-front; crisis flag true for Level 3 triggers only
  const isLevel3 = !!(harmfulKeywordLang || crisisKeywordLang);
  sse('meta', { lang, region, crisis: isCrisis || isLevel3, topics: detectedTopics });

  // ─── LEVEL 3: Harmful content block — never reaches Ollama ───────────────
  if (harmfulKeywordLang) {
    safeLog.info('chat_event', { sid: hashSessionId(sessionId), level: 3, crisis: true, responseType: 'hardcoded' });
    sse('token', { t: CRISIS_SAFETY_MSG[harmfulKeywordLang] });
    sse('done', {});
    try { res.end(); } catch { /* client disconnected */ }
    return;
  }

  // ─── LEVEL 3: Crisis keyword hardblock — never reaches Ollama ─────────────
  if (crisisKeywordLang) {
    safeLog.info('chat_event', { sid: hashSessionId(sessionId), level: 3, crisis: true, responseType: 'hardcoded' });
    sse('token', { t: CRISIS_SAFETY_MSG[crisisKeywordLang] });
    sse('done', {});
    try { res.end(); } catch { /* client disconnected */ }
    return;
  }

  // If TOPIC_PATTERNS crisis (softer signals), prepend resources before model responds
  if (isCrisis) {
    const crisisNote = lang === 'es'
      ? "Antes de seguir: si estás en peligro ahora, por favor llamá al 111. Para hablar las 24 horas: Lifeline 0800 543 354 o mensaje/llamada al 1737. Estoy acá con vos."
      : lang === 'mi'
      ? "I mua i te haere — mēnā he taumaha, tēnā waea ki te 111. Mō te kōrero 24/7: Lifeline 0800 543 354, kuputuhi rānei ki 1737. Kei konei ahau i a koe."
      : "Before we go further — if you're in immediate danger right now, please call 111. To talk any time: Lifeline 0800 543 354 or text/call 1737. I'm right here with you.";
    sse('crisis_resources', { text: crisisNote });
  }

  // ─── LEVEL 1 / LEVEL 2 — reaches Ollama ───────────────────────────────────
  const level = distressKeywordLang ? 2 : 1;
  safeLog.info('chat_event', { sid: hashSessionId(sessionId), level, crisis: isCrisis, responseType: 'model' });

  // ─── Build phi3:mini (Ollama) message list ────────────────────────────
  const messages = [
    { role: 'system', content: NOVA_SYSTEM_PROMPT }
  ];
  // System prompt always first; history capped at last 8 turns (empty if session expired)
  if (Array.isArray(effectiveHistory)) {
    for (const h of effectiveHistory.slice(-8)) {
      if (h?.role === 'user' || h?.role === 'assistant') {
        const content = typeof h.content === 'string' ? scrubPII(h.content).slice(0, 500) : '';
        if (content) messages.push({ role: h.role, content });
      }
    }
  }
  const userContent = lang === 'es'
    ? `Responde únicamente en español. Mensaje del usuario: ${scrubbed}`
    : scrubbed;
  messages.push({ role: 'user', content: userContent });

  // ─── Queue + stream ────────────────────────────────────────────────────
  const hardController = new AbortController();
  const hardTimer = setTimeout(() => hardController.abort('hard-timeout'), STREAM_HARD_TIMEOUT_MS);
  let emittedAnyToken = false;

  try {
    await ollamaQueue.add(async () => {
      // Breaker wraps ONLY the handshake fetch+response
      const numPredict = detectedTopics.some(t => STIGMA_TOPICS.has(t)) ? 75 : OLLAMA_NUM_PREDICT;
      const response = await ollamaBreaker.fire({
        messages, stream: true, signal: hardController.signal, numPredict
      });

      // Stream tokens
      for await (const chunk of consumeOllamaNdjson(response)) {
        if (chunk.message?.content) {
          emittedAnyToken = true;
          sse('token', { t: chunk.message.content });
        }
        if (chunk.done) {
          // Level 2: append support note after model response
          if (distressKeywordLang) {
            sse('token', { t: '\n\n' + (DISTRESS_SUPPORT_MSG[lang] || DISTRESS_SUPPORT_MSG.en) });
          }
          sse('done', {
            total_duration_ms: chunk.total_duration ? Math.round(chunk.total_duration / 1e6) : null,
            eval_count: chunk.eval_count || null
          });
          break;
        }
      }

      if (!emittedAnyToken) {
        sse('fallback', { text: pickFallback('error', lang), reason: 'empty-stream' });
      }
    });
  } catch (err) {
    hardController.abort(); // cancel any in-flight Ollama fetch so it doesn't block the next request
    const reason = err?.code === 'EOPENBREAKER' || /circuit (breaker )?open/i.test(err?.message || '')
      ? 'breakerOpen'
      : /timeout/i.test(err?.message || '') ? 'timeout' : 'error';
    if (!emittedAnyToken) {
      sse('fallback', { text: pickFallback(reason, lang), reason });
    } else {
      sse('done', {}); // partial response: clean close so frontend stops the streaming indicator
    }
    safeLog.warn('chat error', {
      reason,
      err: String(err?.message || err).slice(0, 140),
      queueSize: ollamaQueue.size, queuePending: ollamaQueue.pending
    });
  } finally {
    clearTimeout(hardTimer);
    try { res.end(); } catch { /* client disconnected */ }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/feedback', chatLimiter, (req, res) => {
  const { sessionId, regionCode, rating } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  if (rating !== 1 && rating !== -1) return res.status(400).json({ error: 'rating must be 1 or -1' });

  try {
    const validRegions = new Set(store.getRegions().map(r => r.code));
    const region = validRegions.has(regionCode) ? regionCode : 'NAT';
    store.recordFeedback({ sessionUuid: hashSessionId(sessionId), regionCode: region, rating });
    res.json({ ok: true });
  } catch (e) {
    safeLog.warn('feedback insert failed', { err: String(e?.message).slice(0, 120) });
    res.status(500).json({ error: 'Could not record feedback' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — ADMIN AUTH
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const admin = store.getAdmin(username);
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signAdminToken(username);
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MS,
    path: '/',
  });
  res.json({ ok: true, username, expiresIn: ADMIN_SESSION_MS });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ username: req.adminUser });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-INSIGHTS — computed server-side from summary data, no DB changes
// ═══════════════════════════════════════════════════════════════════════════
function generateInsights(summary) {
  const sessions = summary.totals?.sessions || 0;
  const messages = summary.totals?.messages || 0;
  const crises   = summary.totals?.crises   || 0;
  const insights = [];

  // a) Crisis rate
  const crisis_pct = sessions > 0 ? (crises / sessions * 100) : 0;
  if (crisis_pct === 0) {
    insights.push({ type: 'crisis', level: 'green', title: 'Crisis rate: 0%', body: 'Healthy — no immediate referrals triggered in this dataset.' });
  } else if (crisis_pct < 5) {
    insights.push({ type: 'crisis', level: 'amber', title: `Crisis rate: ${crisis_pct.toFixed(1)}%`, body: 'Monitor — within normal range. Review referral logs if trend rises.' });
  } else {
    insights.push({ type: 'crisis', level: 'red',   title: `Crisis rate: ${crisis_pct.toFixed(1)}%`, body: 'Alert — above 5% baseline. Review Burnett Foundation escalation protocols immediately.' });
  }

  // b) Top topic vs NZ illustrative baseline
  const deduped = [...(summary.topics_deduped || [])].sort((a, b) => b.session_count - a.session_count);
  const top = deduped[0];
  const NZ_BASELINES = { hiv_general: 42, mental_health_general: 38, stigma_general: 24, suicidal_ideation: 8, medication_art: 18, sexual_health: 28 };
  if (top && top.session_count > 0 && sessions > 0) {
    const pct  = +(top.session_count / sessions * 100).toFixed(0);
    const base = NZ_BASELINES[top.code] || 20;
    const diff = Math.round(pct - base);
    insights.push({ type: 'topic', level: Math.abs(diff) > 15 ? 'amber' : 'green',
      title: `Top topic: ${top.label_en} — ${pct}% of sessions`,
      body:  `NZ clinic baseline ~${base}%. Difference: ${diff > 0 ? '+' : ''}${diff}pp.` });
  } else {
    insights.push({ type: 'topic', level: 'green', title: 'Top topic: no data yet', body: 'Start sessions to see topic distribution analysis.' });
  }

  // c) Engagement
  const eps = sessions > 0 ? (messages / sessions) : 0;
  if (sessions === 0) {
    insights.push({ type: 'engagement', level: 'green', title: 'Engagement: awaiting data', body: 'No sessions recorded yet.' });
  } else if (eps < 1.5) {
    insights.push({ type: 'engagement', level: 'amber', title: `Low engagement — ${eps.toFixed(1)} events/session`, body: 'Typical for first-touch users. Consider onboarding improvements or guided prompts.' });
  } else if (eps <= 3) {
    insights.push({ type: 'engagement', level: 'green', title: `Typical engagement — ${eps.toFixed(1)} events/session`, body: 'Users exploring multiple topics per session. Healthy interaction pattern.' });
  } else {
    insights.push({ type: 'engagement', level: 'green', title: `High engagement — ${eps.toFixed(1)} events/session`, body: 'Strong retention signal — users returning for multiple topic areas.' });
  }

  // d) Peak hour
  const ph = summary.peak_hour;
  if (ph) {
    const hr = parseInt(ph.hr, 10);
    const ctx = hr >= 22 || hr < 5  ? 'Late night — may indicate isolation or crisis states. Ensure 24/7 crisis line visibility.'
              : hr >= 5  && hr < 9  ? 'Early morning — pre-work mental health check-in. Consider morning push notifications.'
              : hr >= 9  && hr < 17 ? 'Business hours — clinic referral pathway likely active. Coordinate with GP/specialist availability.'
              :                       'Evening — post-work support-seeking window. Peak staffing alignment recommended.';
    insights.push({ type: 'peak', level: 'green', title: `Peak activity: ${ph.hr}:00 NZT (${ph.n} event${ph.n !== 1 ? 's' : ''})`, body: ctx });
  } else {
    insights.push({ type: 'peak', level: 'green', title: 'Peak hour: insufficient data', body: 'More sessions needed to identify peak activity windows.' });
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — DASHBOARD (protected)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/admin/summary', requireAdmin, (_req, res) => {
  try {
    const summary = store.getDashboardSummary();
    summary.insights   = generateInsights(summary);
    summary.piiEvents  = { ...piiCounters };
    res.json(summary);
  }
  catch (e) {
    safeLog.error('summary error', { err: String(e?.message).slice(0, 140) });
    res.status(500).json({ error: 'Could not build summary' });
  }
});

app.get('/api/admin/export.csv', requireAdmin, (_req, res) => {
  const s = store.getDashboardSummary();
  const rows = [
    'topic_code,topic_label,category,count',
    ...(s.top_topics || []).map(r =>
      [r.code, r.label_en, r.category, r.n]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
  ];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="nova-analytics.csv"');
  res.send(rows.join('\n'));
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — ADMIN AI ANALYST (phi3:mini (Ollama) in analyst mode over aggregate data)
// ═══════════════════════════════════════════════════════════════════════════
const ADMIN_ANALYST_PROMPT = `You are NOVA Analyst, a data assistant for the Mātauranga NOVA dashboard administrator.

You receive a JSON summary of strictly ANONYMOUS aggregate analytics (sessions, topics by region, languages, crisis activations). You never see individual user messages — they do not exist in storage.

Your job:
- Answer the admin's question concisely (2–4 sentences).
- Cite numbers directly from the JSON; do not invent figures.
- If the requested breakdown isn't present, say so.
- When discussing crisis activations, always remind the admin that each number is a human and users were surfaced Lifeline 0800 543 354 / 1737 / 111 at the moment of detection.

Respond in the language of the admin's question (English or Spanish).`;

app.post('/api/admin/analyst', requireAdmin, adminChatLimiter, async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'question required' });
  if (question.length > 500) return res.status(400).json({ error: 'question too long (max 500)' });

  const summary = store.getDashboardSummary();
  const lang = detectLanguage(question);

  const messages = [
    { role: 'system', content: ADMIN_ANALYST_PROMPT },
    { role: 'user', content: `DATA:\n${JSON.stringify(summary)}\n\nQUESTION: ${question.slice(0, 500)}` }
  ];

  res.set({
    'Content-Type':      'text/event-stream; charset=utf-8',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  const sse = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('hard-timeout'), STREAM_HARD_TIMEOUT_MS);
  let gotToken = false;

  try {
    await ollamaQueue.add(async () => {
      const response = await ollamaBreaker.fire({
        messages, stream: true, signal: controller.signal
      });
      for await (const chunk of consumeOllamaNdjson(response)) {
        if (chunk.message?.content) { gotToken = true; sse('token', { t: chunk.message.content }); }
        if (chunk.done) { sse('done', {}); break; }
      }
      if (!gotToken) sse('fallback', { text: pickFallback('error', lang) });
    });
  } catch (e) {
    controller.abort(); // cancel in-flight Ollama fetch
    sse('fallback', { text: pickFallback('error', lang), reason: String(e?.message).slice(0, 120) });
  } finally {
    clearTimeout(timer);
    try { res.end(); } catch { /* noop */ }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — ADMIN ACTIONS (Social Stress Indicator status tracking)
// ═══════════════════════════════════════════════════════════════════════════
const ACTIONS_FILE = path.join(__dirname, 'data', 'actions.json');
const ALLOWED_ACTION_KEYS = new Set([
  'Internal_Stigma', 'External_Discrimination', 'Bullying', 'Online_Hate',
  'Workplace_Discrimination', 'Medical_Discrimination', 'WINZ', 'Housing_Council',
  'Legal_Rights', 'Immigration', 'Loneliness', 'Anxiety', 'Depression',
]);
const ALLOWED_STATUSES = new Set(['Pending', 'In Progress', 'Completed']);

function loadActions() {
  try { return JSON.parse(readFileSync(ACTIONS_FILE, 'utf8')); }
  catch { return {}; }
}
function saveActions(data) {
  writeFileSync(ACTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/admin/actions', requireAdmin, (_req, res) => {
  res.json(loadActions());
});

app.post('/api/admin/actions', requireAdmin, (req, res) => {
  const { key, status } = req.body || {};
  if (!ALLOWED_ACTION_KEYS.has(key))    return res.status(400).json({ error: 'invalid key' });
  if (!ALLOWED_STATUSES.has(status))    return res.status(400).json({ error: 'invalid status' });
  const actions = loadActions();
  actions[key] = { status, updatedAt: new Date().toISOString() };
  try {
    saveActions(actions);
    res.json({ ok: true });
  } catch (e) {
    safeLog.error('actions save error', { err: String(e?.message).slice(0, 80) });
    res.status(500).json({ error: 'Could not save action' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — ADMIN ASSISTANT (AI analyst with caller-supplied sanitized context)
// ═══════════════════════════════════════════════════════════════════════════
const ADMIN_ASSISTANT_PROMPT = `You are NOVA Assistant, a strategic intelligence tool for Mātauranga NOVA — an HIV support platform in Aotearoa New Zealand (Burnett Foundation).

You receive a JSON snapshot of ANONYMOUS aggregate analytics (sessions, topics, languages, crisis activations, PII events blocked). You never see individual user messages — they do not exist in storage.

Your job:
- Provide concise, actionable insights (3–5 sentences).
- Cite numbers directly from the context; do not invent figures.
- Focus on public health implications and potential institutional actions.
- When discussing crisis activations, note that each user was surfaced Lifeline 0800 543 354 / 1737 / 111 at the moment of detection.
- All data is Zero Data Retention compliant under NZ Privacy Act 2020 / HIPC 2020.

Respond in the language of the question (English, Spanish, or te reo Māori).`;

app.post('/api/admin/assistant', requireAdmin, adminChatLimiter, async (req, res) => {
  const { question, context } = req.body || {};
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'question required' });
  if (question.length > 500) return res.status(400).json({ error: 'question too long (max 500)' });

  // Sanitize caller-supplied context — only pass allowed aggregate fields, never user text
  const safeContext = {
    topics:            Array.isArray(context?.topics)
                         ? context.topics.slice(0, 50).map(t => ({ code: t.code, n: t.n, category: t.category }))
                         : [],
    languages:         context?.languages && typeof context.languages === 'object' ? context.languages : {},
    crisisActivations: typeof context?.crisisActivations === 'number' ? context.crisisActivations : 0,
    piiEvents:         context?.piiEvents && typeof context.piiEvents === 'object' ? context.piiEvents : {},
  };

  const lang = detectLanguage(question);
  const messages = [
    { role: 'system', content: ADMIN_ASSISTANT_PROMPT },
    { role: 'user',   content: `CONTEXT:\n${JSON.stringify(safeContext)}\n\nQUESTION: ${question.slice(0, 500)}` },
  ];

  res.set({
    'Content-Type':      'text/event-stream; charset=utf-8',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const sse = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('hard-timeout'), STREAM_HARD_TIMEOUT_MS);
  let gotToken = false;

  try {
    await ollamaQueue.add(async () => {
      const response = await ollamaBreaker.fire({ messages, stream: true, signal: controller.signal });
      for await (const chunk of consumeOllamaNdjson(response)) {
        if (chunk.message?.content) { gotToken = true; sse('token', { t: chunk.message.content }); }
        if (chunk.done) { sse('done', {}); break; }
      }
      if (!gotToken) sse('fallback', { text: pickFallback('error', lang) });
    });
  } catch (e) {
    controller.abort();
    sse('fallback', { text: pickFallback('error', lang), reason: String(e?.message).slice(0, 120) });
  } finally {
    clearTimeout(timer);
    try { res.end(); } catch { /* noop */ }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — PUBLIC SAFETY PAGE
// ═══════════════════════════════════════════════════════════════════════════
app.get('/safety', (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-cache');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NOVA — Safety Information</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; scroll-behavior: smooth; }
  body {
    background: #010d03;
    color: #dff0e1;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    line-height: 1.7;
    min-height: 100vh;
    padding: 0 0 60px;
  }
  a { color: rgba(30,220,130,.85); text-decoration: none; }
  a:hover { text-decoration: underline; }

  header {
    border-bottom: 1px solid rgba(13,153,96,.18);
    background: rgba(1,13,3,.9);
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    width: 38px; height: 38px;
    border-radius: 11px;
    background: linear-gradient(135deg,#0d9960,#078046 55%,#c8941a);
    display: flex; align-items: center; justify-content: center;
    font-family: Georgia, serif; font-size: 20px; color: #010d03; font-weight: 400;
    flex-shrink: 0;
    box-shadow: 0 0 20px rgba(200,148,26,.28);
  }
  .logo-text { font-size: 18px; font-weight: 300; letter-spacing: .02em; }
  .logo-text span { color: rgba(200,148,26,.9); }
  .logo-sub { font-size: 11px; color: rgba(223,240,225,.36); letter-spacing: .04em; margin-top: 1px; }

  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 0; }

  section { margin-bottom: 48px; }
  h1 { font-size: 28px; font-weight: 300; color: #dff0e1; margin-bottom: 8px; letter-spacing: -.01em; }
  h2 {
    font-size: 15px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
    color: rgba(13,153,96,.9); margin-bottom: 14px;
    padding-bottom: 8px; border-bottom: 1px solid rgba(13,153,96,.15);
  }
  p { color: rgba(223,240,225,.72); font-size: 15px; margin-bottom: 12px; }
  p:last-child { margin-bottom: 0; }
  strong { color: rgba(223,240,225,.92); font-weight: 500; }

  .card {
    background: linear-gradient(145deg,rgba(3,18,8,.82),rgba(2,14,6,.72));
    border: 1px solid rgba(13,153,96,.16);
    border-radius: 16px;
    padding: 22px 24px;
    margin-bottom: 14px;
  }
  .card-red { border-color: rgba(220,60,60,.22); background: rgba(220,60,60,.04); }
  .card-gold { border-color: rgba(200,148,26,.22); background: rgba(200,148,26,.04); }

  .pill-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .pill-list li {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 14.5px; color: rgba(223,240,225,.68);
  }
  .pill-list li::before { content: "✗"; color: rgba(220,60,60,.7); font-size: 14px; flex-shrink: 0; margin-top: 2px; }
  .pill-list.yes li::before { content: "✓"; color: rgba(13,153,96,.85); }

  .level-grid { display: flex; flex-direction: column; gap: 10px; }
  .level {
    display: grid; grid-template-columns: 90px 1fr;
    gap: 14px; align-items: start;
    background: rgba(3,18,8,.7); border: 1px solid rgba(13,153,96,.13);
    border-radius: 12px; padding: 16px 18px;
  }
  .level-badge {
    font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 20px; text-align: center;
    white-space: nowrap;
  }
  .l1 { background: rgba(13,153,96,.14); color: rgba(30,220,130,.9); border: 1px solid rgba(13,153,96,.3); }
  .l2 { background: rgba(200,148,26,.12); color: rgba(240,188,56,.9); border: 1px solid rgba(200,148,26,.3); }
  .l3 { background: rgba(220,60,60,.1);  color: rgba(248,110,110,.9); border: 1px solid rgba(220,60,60,.3); }
  .level-desc { font-size: 14px; color: rgba(223,240,225,.65); line-height: 1.55; }
  .level-desc strong { color: rgba(223,240,225,.88); }

  .contacts { display: flex; flex-direction: column; gap: 10px; }
  .contact {
    display: flex; align-items: center; gap: 16px;
    background: rgba(220,60,60,.06); border: 1px solid rgba(220,60,60,.18);
    border-radius: 12px; padding: 14px 18px;
  }
  .contact-num { font-size: 17px; font-weight: 700; color: rgba(248,110,110,.95); min-width: 130px; font-family: monospace; }
  .contact-desc { font-size: 13.5px; color: rgba(248,110,110,.6); }

  .byline {
    margin-top: 48px; padding-top: 24px;
    border-top: 1px solid rgba(13,153,96,.12);
    font-size: 12px; color: rgba(223,240,225,.28);
    letter-spacing: .05em; text-align: center;
  }

  @media (max-width: 520px) {
    main { padding: 32px 16px 0; }
    h1 { font-size: 22px; }
    .level { grid-template-columns: 1fr; gap: 8px; }
    .contact { flex-direction: column; align-items: flex-start; gap: 4px; }
    .contact-num { min-width: unset; }
  }
</style>
</head>
<body>

<header>
  <div class="logo">N</div>
  <div>
    <div class="logo-text">Mātauranga <span>NOVA</span></div>
    <div class="logo-sub">Safety &amp; Privacy Information</div>
  </div>
</header>

<main>

  <section>
    <h1>How NOVA keeps you safe</h1>
    <p>This page explains what NOVA is, what it does not do, how it protects your privacy, and what happens when it detects you might be struggling.</p>
  </section>

  <section>
    <h2>What NOVA is and is not</h2>
    <div class="card">
      <p><strong>NOVA is</strong> an AI companion built to provide information and emotional support around HIV and sexual health in Aotearoa New Zealand. It is warm, private, and available any time.</p>
    </div>
    <div class="card card-red">
      <p><strong>NOVA is not</strong> a doctor, nurse, therapist, or crisis counsellor. It cannot diagnose, prescribe, or replace professional care. If you are in danger, please call 111 or 1737 right now.</p>
    </div>
  </section>

  <section>
    <h2>What data NOVA does NOT collect</h2>
    <ul class="pill-list">
      <li>IP addresses — stripped from every request before any processing</li>
      <li>Message content — nothing you type is stored anywhere</li>
      <li>Identity — no names, emails, or device fingerprints</li>
      <li>Conversation history — sessions clear on tab close and expire after 30 minutes of inactivity</li>
    </ul>
    <div class="card card-gold" style="margin-top:14px">
      <p>Only anonymous aggregate counters are kept: region, topic category, and language code. These are used to understand where support is needed most — never to identify you.</p>
    </div>
  </section>

  <section>
    <h2>How the crisis protocol works</h2>
    <p>Every message is checked against three escalation levels before reaching the AI model:</p>
    <div class="level-grid">
      <div class="level">
        <span class="level-badge l1">Level 1</span>
        <div class="level-desc"><strong>Normal conversation.</strong> No distress signals detected. NOVA responds as usual — information, support, te reo Māori warmth.</div>
      </div>
      <div class="level">
        <span class="level-badge l2">Level 2</span>
        <div class="level-desc"><strong>Indirect distress detected</strong> (e.g. "nobody cares", "I feel invisible", "I'm a burden"). NOVA responds with empathy <em>and</em> appends a support note with 1737 and Youthline.</div>
      </div>
      <div class="level">
        <span class="level-badge l3">Level 3</span>
        <div class="level-desc"><strong>Crisis or harm keywords detected</strong> (e.g. suicidal intent, methods of self-harm). The AI model is <em>never called</em>. NOVA returns only a hardcoded safety message with crisis numbers — instantly, every time.</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Emergency contacts</h2>
    <div class="contacts">
      <div class="contact">
        <div class="contact-num">111</div>
        <div class="contact-desc">Emergency services — police, ambulance, fire</div>
      </div>
      <div class="contact">
        <div class="contact-num">1737</div>
        <div class="contact-desc">Free call or text, 24/7 — mental health support</div>
      </div>
      <div class="contact">
        <div class="contact-num">0800 543 354</div>
        <div class="contact-desc">Lifeline — crisis support, 24/7</div>
      </div>
      <div class="contact">
        <div class="contact-num">0800 376 633</div>
        <div class="contact-desc">Youthline — free, confidential support for young people</div>
      </div>
    </div>
  </section>

  <div class="byline">
    Built by Emanuel Figueroa · Submitted to the Burnett Foundation Innovation Challenge 2026<br>
    NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga
  </div>

</main>
</body>
</html>`);
});

// ═══════════════════════════════════════════════════════════════════════════
// FRONTEND STATIC SERVE (production build)
// ═══════════════════════════════════════════════════════════════════════════
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
try {
  app.use(express.static(FRONTEND_DIST, { maxAge: '1h', etag: true }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
      if (err) res.status(404).send('Not found');
    });
  });
} catch { safeLog.warn('Frontend dist not found — API-only mode', {}); }

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLER (never leaks stack traces or user input)
// ═══════════════════════════════════════════════════════════════════════════
app.use((err, _req, res, _next) => {
  safeLog.error('unhandled', { err: String(err?.message || err).slice(0, 140) });
  res.status(500).json({ error: 'Internal error' });
});

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP + GRACEFUL SHUTDOWN
// ─── Startup KV-cache primer ───────────────────────────────────────────────
// Runs through the ollamaQueue (priority=1) so it gets exclusive Ollama
// access. Subsequent user requests with the same system-prompt prefix skip
// prompt re-evaluation (~7s TTFB instead of ~220s cold).
async function primOllamaKVCache() {
  // Runs OUTSIDE ollamaQueue — warmup must never block incoming user requests.
  // On slow hardware (2 vCPU) a long system prompt can take >300s to evaluate;
  // running inside the queue would starve all chat requests until timeout.
  try {
    safeLog.info('KV cache primer starting…');
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      OLLAMA_MODEL,
        stream:     false,
        messages:   [
          { role: 'system', content: NOVA_SYSTEM_PROMPT },
          { role: 'user',   content: 'ready' }
        ],
        keep_alive: OLLAMA_KEEP_ALIVE,
        options:    { num_ctx: OLLAMA_NUM_CTX, num_predict: 1 }
      }),
      signal: AbortSignal.timeout(600_000) // 10 min — background, non-blocking
    });
    if (res.ok) {
      const d = await res.json();
      safeLog.info('KV cache primed', {
        prompt_eval_ms: Math.round((d.prompt_eval_duration || 0) / 1e6),
        model: OLLAMA_MODEL
      });
      return true;
    }
    safeLog.warn('KV cache primer HTTP error', { status: res.status });
    return false;
  } catch (e) {
    safeLog.warn('KV cache primer failed', { err: String(e?.message).slice(0, 120) });
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
const server = app.listen(PORT, '127.0.0.1', () => {
  safeLog.info('══════════════════════════════════════════════════════════');
  safeLog.info('  Mātauranga NOVA — Backend Live');
  safeLog.info(`  Port:    ${PORT}`);
  safeLog.info(`  Model:   ${OLLAMA_MODEL} (num_ctx=${OLLAMA_NUM_CTX}, num_predict=${OLLAMA_NUM_PREDICT})`);
  safeLog.info(`  Ollama:  ${OLLAMA_URL}`);
  safeLog.info(`  Layers:  L1=PII-scrub  L2=rate-limit  L3=zero-retention  L4=helmet`);
  safeLog.info('══════════════════════════════════════════════════════════');
  // KV cache primer disabled: with the V9-Compact system prompt (~750 tokens)
  // and 4096 context, prompt pre-evaluation ties up Ollama during startup and
  // blocks real user requests. The keep-alive interval below maintains model
  // residency; the first chat bears the prompt-eval cost (~15s on this CPU).
  // primOllamaKVCache() is kept for future use on faster hardware.

  setInterval(async () => {
    try {
      await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'phi3:mini',
          prompt: '',
          keep_alive: '5m'
        }),
        signal: AbortSignal.timeout(10000)
      });
    } catch {}
  }, 4 * 60 * 1000).unref();
});

async function shutdown(signal) {
  safeLog.info(`${signal} received, draining queue…`);
  ollamaQueue.pause();
  try { await ollamaQueue.onIdle(); } catch { /* noop */ }
  server.close(() => {
    try { store.close(); } catch { /* noop */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // force exit after 10s
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  safeLog.error('uncaughtException', { err: String(err?.message || err).slice(0, 140) });
  shutdown('uncaughtException').catch(() => process.exit(1));
});
process.on('unhandledRejection', (err) => safeLog.error('unhandledRejection', { err: String(err?.message || err).slice(0, 140) }));
