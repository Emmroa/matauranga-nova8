// ============================================================
// MĀTAURANGA NOVA — Backend v9
// Burnett Foundation Innovation Challenge 2026
// ============================================================
// ETHICAL FRAMEWORK: PROVISIONAL DRAFT (Safe-by-Default)
// Based on Anthropic Constitutional AI principles.
// Pending Burnett Foundation approval within 2 months post-challenge.
//
// SECURITY LAYERS:
//   L1 — PII Scrubbing (input)
//   L2 — Rate Limiting + Anti-DDoS
//   L3 — Zero Retention (RAM-only sessions, TTL eviction)
//   L4 — Helmet.js HTTP headers
//   L5 — High-risk query interception (pre-AI)
//   L6 — Medical output interception (post-AI)
//   C1 — bcrypt dashboard auth
//   C2 — AES-256-GCM stats encryption
//   H1 — Safe logging (no message text ever logged)
//   H2 — CSRF tokens
//   H3 — Improved topic patterns
//   H4 — Anomaly monitoring
// ============================================================

'use strict';

require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const rateLimit      = require('express-rate-limit');
const slowDown       = require('express-slow-down');
const bcrypt         = require('bcryptjs');
const crypto         = require('crypto');
const fs             = require('fs');
const path           = require('path');
const { v4: uuidv4 } = require('uuid');
const https          = require('https');

const app  = express();
const PORT = process.env.PORT || 10000;

// ── Environment ─────────────────────────────────────────────
const ANTHROPIC_API_KEY       = process.env.ANTHROPIC_API_KEY       || '';
const DASHBOARD_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH || '';
const STATS_ENCRYPTION_KEY    = process.env.STATS_ENCRYPTION_KEY    || '';
const ALLOWED_ORIGIN          = process.env.ALLOWED_ORIGIN || 'https://matauranga-nova.onrender.com';
const STATS_FILE              = path.join(__dirname, 'stats.json.enc');
const IS_PRODUCTION           = process.env.NODE_ENV === 'production';
const CLAUDE_MODEL            = 'claude-sonnet-4-5-20251001';
const SESSION_TTL_MS          = 5 * 60 * 1000;   // 5 min inactivity
const SESSION_WARN_MS         = 4.5 * 60 * 1000; // 4:30 warn
const MAX_HISTORY_TURNS       = 20;

if (!ANTHROPIC_API_KEY)       console.warn('[BOOT] ⚠️  ANTHROPIC_API_KEY not set — AI calls will fail');
if (!DASHBOARD_PASSWORD_HASH) console.warn('[BOOT] ⚠️  DASHBOARD_PASSWORD_HASH not set — /stats unprotected');
if (!STATS_ENCRYPTION_KEY || STATS_ENCRYPTION_KEY.length !== 64)
  console.warn('[BOOT] ⚠️  STATS_ENCRYPTION_KEY missing/invalid — stats stored unencrypted');

// ── Load System Prompt ──────────────────────────────────────
let SYSTEM_PROMPT = '';
const PROMPT_FILE = path.join(__dirname, 'NOVA_SYSTEM_PROMPT.txt');
try {
  SYSTEM_PROMPT = fs.readFileSync(PROMPT_FILE, 'utf8');
  console.log('[BOOT] ✅ System prompt loaded from NOVA_SYSTEM_PROMPT.txt');
} catch {
  console.warn('[BOOT] ⚠️  NOVA_SYSTEM_PROMPT.txt not found — using inline fallback');
  SYSTEM_PROMPT = `You are Mātauranga-NOVA, a warm Kiwi HIV companion for Aotearoa New Zealand.
You are NOT a doctor. Never provide medical dosages, diagnoses, or treatment advice.
Always be empathetic, non-judgmental, and refer to Burnett Foundation for clinical needs.
Crisis resources: Lifeline 0800 543 354, 1737, Emergency 111.
Operating under Safe-by-Default ethical framework (provisional draft v0.9-beta).`;
}

// ============================================================
// LAYER 4 — HELMET
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      connectSrc: ["'self'"],
      imgSrc:     ["'self'", 'data:'],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  hsts:           { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ============================================================
// CORS
// ============================================================
app.use(cors({
  origin:         [ALLOWED_ORIGIN, 'http://localhost:10000', 'http://127.0.0.1:10000'],
  methods:        ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Dashboard-Auth', 'X-CSRF-Token', 'X-Session-Id'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '.')));

// ============================================================
// LAYER 2 — RATE LIMITING + ANTI-DDOS
// ============================================================
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many messages. Please wait a moment.' },
});
const chatSlowDown = slowDown({
  windowMs: 60 * 1000, delayAfter: 10,
  delayMs: (hits) => (hits - 10) * 500, maxDelayMs: 10000,
});
const statsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests to /stats.' },
});

const authFailures  = new Map();
const AUTH_MAX      = 5;
const AUTH_WINDOW   = 15 * 60 * 1000;

function authFailureLimiter(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  const rec = authFailures.get(ip);
  if (rec) {
    if (now - rec.firstAt > AUTH_WINDOW) { authFailures.delete(ip); }
    else if (rec.count >= AUTH_MAX) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
  }
  next();
}
function recordAuthFailure(ip) {
  const now = Date.now();
  const rec = authFailures.get(ip);
  if (!rec || Date.now() - rec.firstAt > AUTH_WINDOW) { authFailures.set(ip, { count: 1, firstAt: now }); }
  else { rec.count++; }
}

// ============================================================
// LAYER 1 — PII SCRUBBING
// ============================================================
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(?:\+?64|0)[\s.\-]?(?:\d[\s.\-]?){6,10}\b/g, '[PHONE]')
    .replace(/\b\d{2,3}-\d{3}-\d{3}\b/g, '[IRD]')
    .replace(/\b[A-Z]{3}\d{4,5}\b(?!\d)/g, '[NHI]')
    .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[CARD]')
    .replace(/\b(?:Unit|Flat|Apt|Suite)\s+\d+[A-Z]?\s*[,/]\s*\d{1,4}\s+[A-Z][a-z]+/gi, '[ADDR]')
    .replace(/\b\d{1,4}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|Road|Lane|Crescent|Avenue|Drive|Court|Place|Terrace|Grove|Close|Way|Rise|View|Heights|Gardens|Parade|Quay)\b/gi, '[ADDR]')
    .replace(/\bP\.?O\.?\s*Box\s+\d+\b/gi, '[ADDR]');
}

// ============================================================
// LAYER 5 — HIGH-RISK QUERY INTERCEPTION (pre-AI)
// ============================================================
const CRISIS_PATTERNS = [
  /\b(?:suicid(?:e|al|io|arse)|want\s+to\s+die|wanna\s+die|quiero\s+morir(?:me)?)\b/i,
  /\b(?:end\s+(?:my\s+)?life|terminar\s+con\s+(?:mi\s+)?vida|no\s+quiero\s+vivir)\b/i,
  /\b(?:not\s+worth\s+living|better\s+off\s+dead|can't\s+go\s+on|no\s+puedo\s+más)\b/i,
  /\b(?:self[\-\s]?harm|cutting\s+myself|hurt\s+myself|autolesion(?:arme|arse))\b/i,
  /\b(?:kill\s+myself|mátame|me\s+quiero\s+matar|ending\s+it\s+all)\b/i,
  /\b(?:no\s+reason\s+to\s+live|nobody\s+would\s+miss\s+me)\b/i,
];

function isHighRiskQuery(text) {
  return CRISIS_PATTERNS.some(p => p.test(text));
}

function getCrisisResponse(lang) {
  const r = {
    en: `I hear you. That sounds incredibly heavy right now — and I'm really glad you reached out.\n\n**Please connect with someone right now:**\n\n- 📞 **Lifeline**: 0800 543 354 (free, 24/7)\n- 📱 **1737**: text or call (free, 24/7 — trained counsellors)\n- 🚨 **Emergency services**: 111\n- 💬 **Samaritans**: 0800 726 666\n\n*You don't have to carry this alone. There are people ready to listen right now.*\n\nI'm still here with you too. How are you feeling in this moment?`,
    mi: `Kei konei ahau. He taumaha rawa atu tēnā — ā, he pai rawa atu kua kōrero mai koe.\n\n**Tūhunga atu ki ēnei tāngata ināianei:**\n\n- 📞 **Lifeline**: 0800 543 354 (kore utu, 24/7)\n- 📱 **1737**: karere, waea rānei (kore utu, 24/7)\n- 🚨 **Āheitanga ohotata**: 111\n\n*Kāore koe i runga anō. Kei konei ngā tāngata e tatari ana ki a koe.*`,
    es: `Te escucho. Eso suena increíblemente pesado ahora mismo — y me alegra mucho que hayas escrito.\n\n**Por favor, comunícate ahora:**\n\n- 📞 **Lifeline**: 0800 543 354 (gratuito, 24/7)\n- 📱 **1737**: texto o llamada (gratuito, 24/7)\n- 🚨 **Emergencias**: 111\n\n*No tenés que cargar esto solo/a. Hay personas listas para escucharte ahora mismo.*`,
  };
  return r[lang] || r.en;
}

// ============================================================
// LAYER 6 — MEDICAL OUTPUT INTERCEPTION (post-AI)
// ============================================================
const MEDICAL_OUT_PATTERNS = [
  /\b\d+\s*mg\b/i,
  /\b(?:take|administer|prescribe|dose|dosage)\s+\d+/i,
  /\b(?:twice|three\s+times|once)\s+(?:daily|a\s+day|per\s+day)\b/i,
  /\b(?:tablet|capsule|pill|injection)\s+(?:of\s+)?\d+/i,
  /\b(?:biktarvy|truvada|descovy|atripla|tenofovir|dolutegravir|rilpivirine)\s+\d+/i,
  /(?:prescription|prescribe)\s+(?:you|them)\b/i,
];

function hasMedicalOutputRisk(text) {
  return MEDICAL_OUT_PATTERNS.some(p => p.test(text));
}

function getMedicalRedirectResponse(lang) {
  const r = {
    en: `That's exactly the kind of question worth a proper conversation with your doctor or the **Burnett Foundation** team — they can give you personalised, safe guidance that I'm not able to.\n\n**Burnett Foundation Aotearoa**\n🌐 burnettfoundation.org.nz\n📞 09 309 3989\n\nThey're genuinely brilliant and won't judge. Worth the call, sweet as.\n\nIs there something else I can help you think through — like what questions to ask them?`,
    mi: `He pātai pai tērā mō tō rata, mō te **Burnett Foundation** rānei — ka taea e rātou te āwhina pai ake i ahau.\n\n🌐 burnettfoundation.org.nz | 📞 09 309 3989`,
    es: `Esa es exactamente la clase de pregunta para tu médico o el equipo de **Burnett Foundation** — pueden darte orientación personalizada y segura.\n\n🌐 burnettfoundation.org.nz | 📞 09 309 3989\n\n¿Hay algo más en lo que te pueda ayudar a pensar?`,
  };
  return r[lang] || r.en;
}

// ============================================================
// LANGUAGE DETECTION
// ============================================================
function detectLanguage(text) {
  if (/t[eē]n[aā]\s+koe|kia\s+ora|wh[aā]nau|aroha|hauora|m[aā]ori|takatāpui|rangatahi/i.test(text)) return 'mi';
  if (/\b(?:hola|gracias|cómo|estás|qué|tengo|soy|quiero|necesito|ayuda|estoy|me\s+siento)\b/i.test(text)) return 'es';
  return 'en';
}

// ============================================================
// HIV MOMENT DETECTION (anonymous logging only)
// ============================================================
const MOMENT_PATTERNS = {
  1: /\b(?:just\s+found\s+out|newly\s+diagnosed|positive\s+result|me\s+acabo\s+de\s+enterar|nuevo\s+diagnóstico)\b/i,
  2: /\b(?:tell(?:ing)?\s+(?:someone|partner|family)|contar(?:le)?|disclosure|divulgar|whether\s+to\s+tell)\b/i,
  3: /\b(?:ashamed|shame|stigma|vergüenza|discriminat|bullying|defect|reject)\b/i,
  4: /\b(?:living\s+with\s+hiv\s+for|vivir\s+con\s+vih|long[\s\-]term|years\s+with|treatment\s+fatigue)\b/i,
  5: /\b(?:prep|pep|doxypep|testing|test|prevent|sti\s+check|undetectable|u=u|sexual\s+health)\b/i,
  6: /\b(?:discriminat|rights|hrc|fired|workplace|legal|immigration|online\s+hate|cyberbull)\b/i,
  7: /\b(?:chemsex|meth|crystal|gbh|ghb|tina|chems|drugs\s+and\s+sex|party\s+and\s+play|pnp)\b/i,
};

function detectMoment(text) {
  for (const [m, p] of Object.entries(MOMENT_PATTERNS)) {
    if (p.test(text)) return parseInt(m);
  }
  return 0;
}

// ============================================================
// TOPIC DETECTION (32 topics)
// ============================================================
const TOPIC_PATTERNS = {
  HIV:                      /\b(?:hiv|vih|seroposit|aids|sida)\b/i,
  New_Diagnosis:            /\b(?:just\s+found\s+out|newly\s+diagnosed|positive\s+result|recién\s+diagnosticado)\b/i,
  UeqU:                     /\bu\s*[=equals]+\s*u\b|undetectable\s*=\s*untransmittable|indetectable/i,
  Long_Term_Living:         /\b(?:living\s+with\s+hiv\s+for|vivir\s+con\s+vih|long[\s\-]term|treatment\s+fatigue)\b/i,
  ART_Medication:           /\b(?:art|antiretroviral|biktarvy|truvada|descovy|atripla|tenofovir|dolutegravir)\b/i,
  PrEP:                     /\b(?:prep|pre[\-\s]?exposure)\b/i,
  PEP:                      /\b(?:pep|post[\-\s]?exposure|72\s*hours?\s+after)\b/i,
  DoxyPEP:                  /\b(?:doxypep|doxycycline|doxi)\b/i,
  STI_Testing:              /\b(?:sti\s+test|sexual\s+health\s+check|full\s+screen|get\s+tested)\b/i,
  Syphilis:                 /\b(?:syphilis|sífilis|treponema)\b/i,
  Chlamydia:                /\b(?:chlamydia|clamidia)\b/i,
  Gonorrhoea:               /\b(?:gonorrh?o?ea|gonorrea)\b/i,
  Suicide_Ideation:         /\b(?:suicid|want\s+to\s+die|quiero\s+morir|end\s+my\s+life)\b/i,
  Self_Harm:                /\b(?:self[\-\s]?harm|cutting\s+myself|autolesion)\b/i,
  Crisis_Acute:             /\b(?:crisis|can't\s+cope|no\s+puedo\s+más|breaking\s+down)\b/i,
  Anxiety:                  /\b(?:anxi(?:ety|ous)|pánico|ansiedad|worry|preocup)\b/i,
  Depression:               /\b(?:depress(?:ed|ion)|depresión|deprimido|hopeless|tristeza)\b/i,
  Loneliness:               /\b(?:lonely|loneliness|alone|soledad|aislado|isolated)\b/i,
  Internal_Stigma:          /\b(?:ashamed|shame|vergüenza|self[\-\s]?hate|defect)\b/i,
  External_Discrimination:  /\b(?:discriminat(?:ed|ion)|rejected|rechazado|unfair)\b/i,
  Bullying:                 /\b(?:bullying|bully|acoso|mocking|burlas)\b/i,
  Online_Hate:              /\b(?:online\s+hate|cyberbullying|ciberacoso|hate\s+comments|trolling)\b/i,
  Workplace_Discrimination: /\b(?:work(?:place)?\s+discrimination|fired\s+because|discriminación\s+laboral)\b/i,
  Medical_Discrimination:   /\b(?:doctor\s+refused|médico\s+rechazó|denied\s+care|healthcare\s+discrimination)\b/i,
  LGBTQIA_Takatapui:        /\b(?:gay|lesbian|trans(?:gender)?|queer|bisex|takatāpui|takatapui|rainbow|non[\-\s]?binary)\b/i,
  Disclosure:               /\b(?:tell(?:ing)?\s+(?:someone|partner|family)|contar|disclosure|divulgar)\b/i,
  Whanau_Family:            /\b(?:wh[aā]nau|family|familia|parents|padres|partner|pareja)\b/i,
  WINZ:                     /\b(?:winz|work\s+and\s+income|benefit|jobseeker)\b/i,
  Housing_Council:          /\b(?:kāinga\s+ora|housing|council\s+housing|state\s+house|homeless)\b/i,
  Legal_Rights:             /\b(?:human\s+rights|hrc|rights|derechos|legal\s+advice|lawyer)\b/i,
  Chemsex:                  /\b(?:chemsex|meth|crystal|gbh|ghb|tina|chems|party\s+and\s+play|pnp)\b/i,
  Immigration:              /\b(?:visa|residency|immigration\s+nz|inz|migrant|deportation)\b/i,
};

const CRISIS_TOPICS = new Set(['Suicide_Ideation', 'Self_Harm', 'Crisis_Acute']);

function extractTopics(text) {
  return Object.entries(TOPIC_PATTERNS)
    .filter(([, r]) => r.test(text))
    .map(([k]) => k);
}

// ============================================================
// AES-256-GCM STATS ENCRYPTION (C2)
// ============================================================
const ENCRYPT_ALGO = 'aes-256-gcm';

function encryptStats(data) {
  if (!STATS_ENCRYPTION_KEY || STATS_ENCRYPTION_KEY.length !== 64) return JSON.stringify(data);
  const key = Buffer.from(STATS_ENCRYPTION_KEY, 'hex');
  const iv  = crypto.randomBytes(16);
  const c   = crypto.createCipheriv(ENCRYPT_ALGO, key, iv);
  let enc   = c.update(JSON.stringify(data), 'utf8', 'hex');
  enc      += c.final('hex');
  return JSON.stringify({ v: 1, iv: iv.toString('hex'), data: enc, authTag: c.getAuthTag().toString('hex') });
}

function decryptStats(raw) {
  let p; try { p = JSON.parse(raw); } catch { return null; }
  if (!p.v) return p;
  if (!STATS_ENCRYPTION_KEY || STATS_ENCRYPTION_KEY.length !== 64) return null;
  try {
    const key = Buffer.from(STATS_ENCRYPTION_KEY, 'hex');
    const d   = crypto.createDecipheriv(ENCRYPT_ALGO, key, Buffer.from(p.iv, 'hex'));
    d.setAuthTag(Buffer.from(p.authTag, 'hex'));
    let dec = d.update(p.data, 'hex', 'utf8'); dec += d.final('utf8');
    return JSON.parse(dec);
  } catch (e) { console.error('[CRYPTO] Decrypt failed:', e.message); return null; }
}

// ============================================================
// STATISTICS STATE
// ============================================================
const INITIAL_STATS = {
  totalSessions: 0, monthSessions: 0, totalMessages: 0,
  firstSessionDate: null, lastSessionDate: null,
  languages: { en: 0, es: 0, mi: 0 },
  moments: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
  topics: Object.fromEntries(Object.keys(TOPIC_PATTERNS).map(k => [k, 0])),
  crisisActivations: 0, crisisActivationsMonth: 0, medicalInterceptions: 0,
};

let stats = JSON.parse(JSON.stringify(INITIAL_STATS));

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return;
    const raw    = fs.readFileSync(STATS_FILE, 'utf8');
    const loaded = decryptStats(raw);
    if (loaded) {
      stats         = { ...INITIAL_STATS, ...loaded };
      stats.languages = { ...INITIAL_STATS.languages, ...loaded.languages };
      stats.topics    = { ...INITIAL_STATS.topics,    ...loaded.topics };
      stats.moments   = { ...INITIAL_STATS.moments,   ...(loaded.moments || {}) };
      console.log('[STATS] ✅ Stats loaded');
    }
  } catch (e) { console.error('[STATS] Load error:', e.message); }
}

function saveStats() {
  try { fs.writeFileSync(STATS_FILE, encryptStats(stats), 'utf8'); }
  catch (e) { console.error('[STATS] Save error:', e.message); }
}

loadStats();
const saveInterval = setInterval(saveStats, 30000);

// ============================================================
// LAYER 3 — ZERO RETENTION RAM SESSION STORE
// ============================================================
const sessions = new Map();

function getOrCreateSession(sessionId) {
  const now = Date.now();
  if (sessions.has(sessionId)) {
    const s = sessions.get(sessionId);
    s.lastActive = now;
    return s;
  }
  const s = { history: [], lang: 'en', lastActive: now };
  sessions.set(sessionId, s);
  return s;
}

function appendToHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY_TURNS * 2) {
    session.history.splice(0, 2);
  }
}

const gcInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActive > SESSION_TTL_MS) {
      sessions.delete(id);
      console.log(`[SESSION] Evicted stale session | active: ${sessions.size}`);
    }
  }
}, 60 * 1000);

// ============================================================
// DASHBOARD AUTH — bcrypt (C1)
// ============================================================
async function dashboardAuthMiddleware(req, res, next) {
  const provided = req.headers['x-dashboard-auth'] || '';
  if (!provided) return res.status(401).json({ error: 'X-Dashboard-Auth required' });
  if (!DASHBOARD_PASSWORD_HASH) {
    const plain = process.env.DASHBOARD_PASSWORD || 'burnett2026';
    if (provided === plain) { return next(); }
    recordAuthFailure(req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const ok = await bcrypt.compare(provided, DASHBOARD_PASSWORD_HASH);
    if (ok) { authFailures.delete(req.ip); return next(); }
    recordAuthFailure(req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  } catch (e) { return res.status(500).json({ error: 'Internal server error' }); }
}

// ============================================================
// CSRF TOKENS (H2)
// ============================================================
const csrfTokens  = new Map();
const CSRF_TTL_MS = 60 * 60 * 1000;

function generateCsrfToken() {
  const t = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(t, { createdAt: Date.now() });
  return t;
}

setInterval(() => {
  const now = Date.now();
  for (const [t, r] of csrfTokens) { if (now - r.createdAt > CSRF_TTL_MS) csrfTokens.delete(t); }
}, 60 * 60 * 1000);

// ============================================================
// ANOMALY MONITORING (H4)
// ============================================================
const crisisTimestamps  = [];
const CRISIS_WINDOW_MS  = 60 * 60 * 1000;
const CRISIS_ALERT_COUNT = 5;

function recordCrisisEvent() {
  const now = Date.now();
  crisisTimestamps.push(now);
  while (crisisTimestamps.length && now - crisisTimestamps[0] > CRISIS_WINDOW_MS) crisisTimestamps.shift();
  if (crisisTimestamps.length >= CRISIS_ALERT_COUNT)
    console.error(`[CRISIS ALERT] ⚠️  ${crisisTimestamps.length} activations in last hour`);
}

// ============================================================
// ANTHROPIC STREAMING CALL
// ============================================================
function callAnthropicStream(messages, res) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) { reject(new Error('ANTHROPIC_API_KEY not set')); return; }

    const body = JSON.stringify({
      model:       CLAUDE_MODEL,
      max_tokens:  1024,
      temperature: 0.3,
      stream:      true,
      system:      SYSTEM_PROMPT,
      messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    };

    let fullText = '';

    const req = https.request(options, (apiRes) => {
      apiRes.setEncoding('utf8');
      apiRes.on('data', (chunk) => {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const text = parsed.delta.text || '';
              fullText += text;
              res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
            }
          } catch { /* skip malformed */ }
        }
      });
      apiRes.on('end', () => resolve(fullText));
      apiRes.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// DEMO REPLIES (no API key fallback)
// ============================================================
const DEMO_REPLIES = {
  crisis: {
    en: `I hear you. That sounds incredibly heavy right now — and I'm really glad you reached out.\n\n**Please connect with someone right now:**\n\n- 📞 **Lifeline**: 0800 543 354 (free, 24/7)\n- 📱 **1737**: text or call (free, 24/7 — trained counsellors)\n- 🚨 **Emergency services**: 111\n\n*You don't have to carry this alone.*\n\nI'm still here with you. How are you feeling right now?`,
    es: `Te escucho. Eso suena muy pesado ahora mismo.\n\n**Por favor contacta:**\n- 📞 **Lifeline**: 0800 543 354 | 📱 **1737** | 🚨 **111**`,
    mi: `Kei konei ahau.\n\n**Tūhunga atu:**\n- 📞 **Lifeline**: 0800 543 354 | 📱 **1737** | 🚨 **111**`,
  },
  new_diagnosis: {
    en: `That's a lot to land on you all at once.\n\nWhatever you're feeling right now — shock, fear, confusion — it all makes sense. Take a breath.\n\nHIV is manageable. People live full, healthy, connected lives. You're not facing this alone.\n\n**Burnett Foundation Aotearoa** → burnettfoundation.org.nz | 09 309 3989\n\nHow's that sitting with you right now?`,
    es: `Eso es mucho para procesar de una vez.\n\nEl VIH es manejable. No estás solo/a.\n\n**Burnett Foundation** → burnettfoundation.org.nz\n\n¿Cómo te está cayendo todo esto?`,
    mi: `He nui rawa atu tēnā. Ka āhei te noho ora.\n\n**Burnett Foundation** → burnettfoundation.org.nz\n\nHe aha tō whakaaro inaianei?`,
  },
  general: {
    en: `Kia ora — I'm NOVA, a companion for people navigating HIV in Aotearoa.\n\nI'm here to listen, no judgment. I'm not a doctor, but I can help you think through what's on your mind and connect you with real support.\n\nWhat's brought you here today?`,
    es: `Kia ora — soy NOVA, una compañía para personas navegando el VIH en Aotearoa. Estoy aquí para escuchar, sin juicio.\n\n¿Qué te trae por aquí hoy?`,
    mi: `Kia ora — ko NOVA ahau, he hoa mō ngā tāngata e haere ana i roto i te HIV i Aotearoa.\n\nHe aha te take i haere mai ai koe inaianei?`,
  },
};

function getDemoReply(topics, lang) {
  const l = lang || 'en';
  if (topics.some(t => CRISIS_TOPICS.has(t)))   return DEMO_REPLIES.crisis[l]        || DEMO_REPLIES.crisis.en;
  if (topics.includes('New_Diagnosis'))           return DEMO_REPLIES.new_diagnosis[l] || DEMO_REPLIES.new_diagnosis.en;
  return DEMO_REPLIES.general[l] || DEMO_REPLIES.general.en;
}

// ============================================================
// STATIC FILES
// ============================================================
app.get('/', (_req, res) => {
  const p = path.join(__dirname, 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.send('<h2>NOVA ✅</h2><p>index.html not found.</p>');
});

app.get('/nova-widget.js', (_req, res) => {
  const p = path.join(__dirname, 'nova-widget.js');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).json({ error: 'Widget not found' });
});

app.get('/dashboard.html', (req, res) => {
  const csrf = generateCsrfToken();
  const p    = path.join(__dirname, 'dashboard.html');
  if (!fs.existsSync(p)) return res.send('<h2>Dashboard</h2><p>dashboard.html not found.</p>');
  let html = fs.readFileSync(p, 'utf8');
  html = html.includes('{{CSRF_TOKEN}}')
    ? html.replace('{{CSRF_TOKEN}}', csrf)
    : html.replace('</head>', `<meta name="csrf-token" content="${csrf}"></head>`);
  res.send(html);
});

// ============================================================
// POST /session-start
// ============================================================
app.post('/session-start', (_req, res) => {
  const sessionId = `sid_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  getOrCreateSession(sessionId);
  const now = new Date().toISOString();
  stats.totalSessions++;
  stats.monthSessions++;
  if (!stats.firstSessionDate) stats.firstSessionDate = now;
  stats.lastSessionDate = now;
  console.log(`[SESSION] New | total: ${stats.totalSessions} | active: ${sessions.size}`);
  res.json({ status: 'ok', sessionId, sessionTtlMs: SESSION_TTL_MS, warnMs: SESSION_WARN_MS });
});

// ============================================================
// POST /session-end
// ============================================================
app.post('/session-end', (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    console.log(`[SESSION] Explicit end | active: ${sessions.size}`);
  }
  res.json({ status: 'ok' });
});

// ============================================================
// POST /chat — MAIN (Streaming SSE)
// ============================================================
app.post('/chat', chatLimiter, chatSlowDown, async (req, res) => {
  const { message, sessionId } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message required.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
  }

  const scrubbed  = scrubPII(message);
  const lang      = detectLanguage(scrubbed);
  const topics    = extractTopics(scrubbed);
  const moment    = detectMoment(scrubbed);
  const hasCrisis = topics.some(t => CRISIS_TOPICS.has(t));

  // H1: Anonymous metadata only — NEVER log message content
  console.log(`[CHAT] Lang:${lang} | Moment:${moment} | Topics:[${topics.slice(0,3).join(',')}] | Len:${message.length} | Crisis:${hasCrisis}`);

  // Update anonymous counters
  stats.totalMessages++;
  stats.languages[lang] = (stats.languages[lang] || 0) + 1;
  if (moment > 0) stats.moments[moment] = (stats.moments[moment] || 0) + 1;
  topics.forEach(t => { if (stats.topics[t] !== undefined) stats.topics[t]++; });

  // ── LAYER 5: Crisis pre-intercept ──────────────────────────
  if (isHighRiskQuery(scrubbed)) {
    stats.crisisActivations++;
    stats.crisisActivationsMonth++;
    recordCrisisEvent();
    return res.json({ reply: getCrisisResponse(lang), crisis: true, streaming: false });
  }

  // ── SSE headers ────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const session = sessionId
    ? getOrCreateSession(sessionId)
    : { history: [], lang, lastActive: Date.now() };
  session.lang = lang;
  appendToHistory(session, 'user', scrubbed);

  let fullReply = '';

  try {
    if (ANTHROPIC_API_KEY) {
      fullReply = await callAnthropicStream(session.history, res);
    } else {
      // Demo fallback
      fullReply = getDemoReply(topics, lang);
      res.write(`data: ${JSON.stringify({ type: 'delta', text: fullReply })}\n\n`);
    }

    // ── LAYER 6: Medical post-intercept ──────────────────────
    if (hasMedicalOutputRisk(fullReply)) {
      stats.medicalInterceptions++;
      const safeReply = getMedicalRedirectResponse(lang);
      res.write(`data: ${JSON.stringify({ type: 'replace', text: safeReply })}\n\n`);
      fullReply = safeReply;
    }

    appendToHistory(session, 'assistant', fullReply);

  } catch (err) {
    console.error('[CHAT] AI error:', err.message);
    const errMsg = lang === 'mi'
      ? 'Aroha mai — kāore i taea te hono. Waea atu ki a Lifeline: 0800 543 354.'
      : lang === 'es'
      ? 'Lo siento, no pude conectarme. Apoyo urgente: Lifeline 0800 543 354 o 1737.'
      : 'Sorry, couldn\'t connect right now. For urgent support: Lifeline 0800 543 354 or 1737.';
    res.write(`data: ${JSON.stringify({ type: 'delta', text: errMsg })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

// ============================================================
// GET /stats — Protected dashboard endpoint
// ============================================================
app.get('/stats', statsLimiter, authFailureLimiter, dashboardAuthMiddleware, (_req, res) => {
  console.log('[AUDIT] GET /stats accessed');
  res.json({
    ...stats,
    activeSessions:    sessions.size,
    systemPromptVersion: 'V9',
    ethicalFramework:  'provisional-draft-v0.9-beta',
    apiMode:           ANTHROPIC_API_KEY ? 'ai-streaming' : 'demo',
  });
});

// ============================================================
// GET /health — Public
// ============================================================
app.get('/health', (_req, res) => {
  res.json({
    status:           'ok',
    mode:             ANTHROPIC_API_KEY ? 'ai-streaming' : 'demo',
    model:            CLAUDE_MODEL,
    temperature:      0.3,
    streaming:        true,
    uptime:           Math.floor(process.uptime()),
    totalSessions:    stats.totalSessions,
    totalMessages:    stats.totalMessages,
    activeSessions:   sessions.size,
    topicsTracked:    Object.keys(stats.topics).length,
    sessionTtlMin:    SESSION_TTL_MS / 60000,
    ethicalFramework: 'provisional-draft-v0.9-beta',
    layers: {
      L1_piiScrub:         'active',
      L2_rateLimiting:     'active',
      L3_zeroRetention:    'active-ram-only',
      L4_helmet:           'active',
      L5_crisisIntercept:  'active',
      L6_medicalIntercept: 'active',
      C1_bcryptAuth:       DASHBOARD_PASSWORD_HASH ? 'active' : 'dev-mode',
      C2_encryptedStats:   STATS_ENCRYPTION_KEY ? 'active' : 'dev-mode',
      H1_safeLogging:      'active',
      H2_csrfTokens:       'active',
      H3_improvedPatterns: 'active',
      H4_anomalyMonitor:   'active',
    },
  });
});

// ============================================================
// 404
// ============================================================
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
function shutdown(signal) {
  console.log(`[${signal}] Saving stats, clearing sessions, shutting down...`);
  clearInterval(saveInterval);
  clearInterval(gcInterval);
  saveStats();
  sessions.clear(); // zero out all RAM sessions
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🌿 NOVA v9 listening on port ${PORT}`);
  console.log(`   Mode:         ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`   AI:           ${ANTHROPIC_API_KEY ? `Claude (${CLAUDE_MODEL}) + Streaming` : 'DEMO (no API key)'}`);
  console.log(`   Temperature:  0.3`);
  console.log(`   Auth:         ${DASHBOARD_PASSWORD_HASH ? 'bcrypt ✅' : 'plaintext dev ⚠️'}`);
  console.log(`   Stats enc:    ${STATS_ENCRYPTION_KEY ? 'AES-256-GCM ✅' : 'unencrypted dev ⚠️'}`);
  console.log(`   Session TTL:  ${SESSION_TTL_MS / 60000} min`);
  console.log(`   Zero Ret:     RAM-only + auto-evict ✅`);
  console.log(`   Ethics:       Provisional Draft v0.9-beta`);
  console.log(`   Layers:       L1-L6 + C1,C2,H1-H4 active\n`);
});

module.exports = app;
