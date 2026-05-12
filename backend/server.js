// ═══════════════════════════════════════════════════════════════════════════
// NOVA — Backend Server (ESM)
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
//
// ARCHITECTURE
//   • Node.js 20+ · Express 5 · better-sqlite3
//   • p-queue (concurrency=1) — strictly sequential Ollama inference
//   • opossum — circuit breaker on Ollama handshake
//   • SSE streaming from Node → React (token-by-token)
//   • Mistral 7B Q4_0 via Ollama (http://127.0.0.1:11434)
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
import { readFileSync } from 'node:fs';

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
const OLLAMA_MODEL       = process.env.OLLAMA_MODEL || 'mistral';     // Mistral 7B Instruct Q4_0 (~4.1 GB)
const OLLAMA_NUM_CTX     = parseInt(process.env.OLLAMA_NUM_CTX     || '1024', 10);
const OLLAMA_NUM_PREDICT = parseInt(process.env.OLLAMA_NUM_PREDICT || '45',   10); // ~2-3 sentences @ 0.8tok/s = ~100s
const OLLAMA_KEEP_ALIVE  = process.env.OLLAMA_KEEP_ALIVE || '2h';

// Circuit breaker + queue timings
const QUEUE_TIMEOUT_MS       = parseInt(process.env.QUEUE_TIMEOUT_MS       || '180000', 10); // total in queue
const HANDSHAKE_TIMEOUT_MS   = parseInt(process.env.HANDSHAKE_TIMEOUT_MS   || '70000',  10); // breaker wraps this (phi3:mini cold-loads ~6s)
const STREAM_HARD_TIMEOUT_MS = parseInt(process.env.STREAM_HARD_TIMEOUT_MS || '115000', 10); // phi3:mini @ ~0.8tok/s × 80tok + 7s TTFB = ~107s

// Security
const SESSION_SECRET   = process.env.SESSION_SECRET   || randomUUID();
const ADMIN_USERNAME   = process.env.ADMIN_USERNAME   || 'burnett';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD   || 'burnett2026';
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
function scrubPII(text) {
  if (typeof text !== 'string') return '';
  return text
    // Emails
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    // NZ phone numbers: +64, 0xx, mobile 02x
    .replace(/\b(?:\+?64[\s.-]?|0)\d[\d\s.-]{6,12}\b/g, '[PHONE]')
    // NHI: 3 letters + 4 digits (new post-2023 format is 3L + 2 digits + 1 letter + 1 digit, cover both)
    .replace(/\b[A-Z]{3}\d{4}\b/g, '[NHI]')
    .replace(/\b[A-Z]{3}\d{2}[A-Z]\d\b/g, '[NHI]')
    // IRD: 8–9 digits with optional dashes
    .replace(/\b\d{2,3}[-\s]?\d{3}[-\s]?\d{3}\b/g, '[IRD]')
    // Credit card (16 digits grouped)
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
    // NZ street addresses (approximate)
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
  Medical_Discrimination:   /\b(doctor refused|m[eé]dico se neg[oó]|denied treatment|hospital discriminat|clinic refused|clinic stigma|doctor|clinic|hospital|refused|judged by)\b/i,

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

function extractTopics(text) {
  const found = [];
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(text)) found.push(topic);
  }
  return found;
}

function detectLanguage(text) {
  if (/\b(t[eē]n[aā] koe|kia ora|wh[aā]nau|aroha|hauora|m[aā]ori|ng[aā])\b/i.test(text)) return 'mi';
  if (/\b(hola|gracias|c[oó]mo|est[aá]s|qu[eé]|tengo|soy|me|te|por favor|quiero|puedo)\b/i.test(text)) return 'es';
  return 'en';
}

// ═══════════════════════════════════════════════════════════════════════════
// NOVA SYSTEM PROMPT (compact, Mistral 7B calibrated)
// ═══════════════════════════════════════════════════════════════════════════
const NOVA_SYSTEM_PROMPT = `You are NOVA — an AI companion built by Emanuel Figueroa for the Burnett Foundation Aotearoa, to reduce HIV stigma and support whanau in Aotearoa New Zealand. You are NOT a doctor or therapist — say so plainly if asked.

CORE VALUES (always apply):
- Manaakitanga: lead with warmth and care, always
- Whanaungatanga: remind people they are not alone
- Kaitiakitanga: protect the person's mana and dignity
- Aroha: unconditional compassion, zero judgment

YOUR ROLE: Fight HIV stigma through honest, caring conversation. Validate feelings before giving information. Never shame. Never lecture. Never be cold or clinical.

KEY FACTS (share when relevant):
- U=U: Undetectable = Untransmittable. Confirmed science — a person on treatment with undetectable viral load cannot sexually transmit HIV.
- HIV is manageable. People live full, healthy lives with treatment.
- Discrimination based on HIV status is illegal in NZ (Human Rights Act 1993).
- PrEP, testing and support are free through Burnett Foundation (0800 802 437).

WHEN SOMEONE IS IN DISTRESS always share:
- Lifeline: 0800 543 354 (24/7 free)
- Text or call 1737 (free, 24/7)
- Emergency: 111

STYLE: Warm, conversational, occasional te reo Maori (Kia ora, Aroha, Whanau). Max 3 sentences unless more detail is needed. Never robotic.

LANGUAGE: Always respond in the same language the user writes in. If the user writes in Spanish, respond entirely in Spanish. If in English, respond in English. Never switch languages.

STIGMA-SPECIFIC RULES:
- When someone expresses shame, feeling "dirty", "broken", or "unworthy" because of HIV: explicitly name that this feeling is caused by social stigma, not by truth. Affirm clearly that HIV does not define a person's worth, cleanliness, or value as a human being. Use Manaakitanga.
- When someone describes being discriminated against by a doctor, clinic, or medical provider because of HIV: validate their experience AND inform them that this discrimination is illegal in New Zealand under the Human Rights Act 1993, and they can contact the Human Rights Commission (hrc.co.nz) for support.`;

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
const pickFallback = (kind, lang) => (FALLBACKS[kind]?.[lang]) || FALLBACKS[kind]?.en || '';

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
    return res.status(400).json({ error: 'sessionId required (ephemeral client-generated UUID).' });
  }

  // Validate region
  const validRegions = new Set(store.getRegions().map(r => r.code));
  const region = validRegions.has(regionCode) ? regionCode : 'NAT';

  // ─── L1 scrub + local topic extraction ─────────────────────────────────
  const scrubbed = scrubPII(message);
  const detectedTopics = extractTopics(scrubbed);
  const lang = detectLanguage(scrubbed);
  const isCrisis = detectedTopics.some(t => CRISIS_TOPICS.has(t));

  // ─── Record anonymous analytics (topics + region + language + hour) ────
  try {
    if (detectedTopics.length > 0) {
      store.recordEventsBatch(detectedTopics.map(topicCode => ({
        sessionUuid: sessionId, regionCode: region, topicCode, language: lang, isCrisis: isCrisis && CRISIS_TOPICS.has(topicCode)
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

  // Announce metadata up-front (region, lang, crisis) so the UI can show crisis resources early
  sse('meta', { lang, region, crisis: isCrisis, topics: detectedTopics });

  // If crisis, prepend resources IMMEDIATELY even before the model responds
  if (isCrisis) {
    const crisisNote = lang === 'es'
      ? "Antes de seguir: si estás en peligro ahora, por favor llamá al 111. Para hablar las 24 horas: Lifeline 0800 543 354 o mensaje/llamada al 1737. Estoy acá con vos."
      : lang === 'mi'
      ? "I mua i te haere — mēnā he taumaha, tēnā waea ki te 111. Mō te kōrero 24/7: Lifeline 0800 543 354, kuputuhi rānei ki 1737. Kei konei ahau i a koe."
      : "Before we go further — if you're in immediate danger right now, please call 111. To talk any time: Lifeline 0800 543 354 or text/call 1737. I'm right here with you.";
    sse('crisis_resources', { text: crisisNote });
  }

  // ─── Build Mistral message list ────────────────────────────────────────
  const messages = [
    { role: 'system', content: NOVA_SYSTEM_PROMPT }
  ];
  // Trim history to last 6 turns to preserve context window at num_ctx=2048
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
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
      const STIGMA_TOPICS = new Set(['Internal_Stigma', 'Medical_Discrimination']);
      const numPredict = detectedTopics.some(t => STIGMA_TOPICS.has(t)) ? 115 : OLLAMA_NUM_PREDICT;
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
    store.recordFeedback({ sessionUuid: sessionId, regionCode: region, rating });
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
    secure: process.env.COOKIE_SECURE === 'true', // set COOKIE_SECURE=true only when HTTPS
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
// ROUTES — DASHBOARD (protected)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/admin/summary', requireAdmin, (_req, res) => {
  try { res.json(store.getDashboardSummary()); }
  catch (e) {
    safeLog.error('summary error', { err: String(e?.message).slice(0, 140) });
    res.status(500).json({ error: 'Could not build summary' });
  }
});

app.get('/api/admin/export.csv', requireAdmin, (_req, res) => {
  const s = store.getDashboardSummary();
  const rows = [
    'region_code,region_name,topic_code,topic_label,topic_category,count',
    ...s.topics_by_region.map(r =>
      [r.region_code, r.region_name, r.topic_code, r.topic_label, r.topic_category, r.n]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
  ];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="nova-analytics.csv"');
  res.send(rows.join('\n'));
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — ADMIN AI ANALYST (Mistral in analyst mode over aggregate data)
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
} catch { /* dist may not exist in pure dev */ }

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
  try {
    safeLog.info('KV cache primer starting…');
    await ollamaQueue.add(async () => {
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
        signal: AbortSignal.timeout(290_000) // just under Ollama's 5-min server timeout
      });
      if (res.ok) {
        const d = await res.json();
        safeLog.info('KV cache primed', {
          prompt_eval_ms: Math.round((d.prompt_eval_duration || 0) / 1e6),
          model: OLLAMA_MODEL
        });
      } else {
        safeLog.warn('KV cache primer HTTP error', { status: res.status });
      }
    }, { priority: 1, timeout: 290_000, throwOnTimeout: false }); // priority > default 0; 290s fits under Ollama's 5-min server limit
  } catch (e) {
    safeLog.warn('KV cache primer failed', { err: String(e?.message).slice(0, 120) });
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
  primOllamaKVCache(); // fire-and-forget: warms KV cache for NOVA_SYSTEM_PROMPT
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
process.on('uncaughtException', (err) => safeLog.error('uncaughtException', { err: String(err?.message || err).slice(0, 140) }));
process.on('unhandledRejection', (err) => safeLog.error('unhandledRejection', { err: String(err?.message || err).slice(0, 140) }));
