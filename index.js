// ============================================================
// MĀTAURANGA NOVA — Backend v10 (Standalone App)
// Burnett Foundation Innovation Challenge 2026
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

// PARCHE FINANCIERO: Modelo optimizado
const CLAUDE_MODEL            = 'claude-3-haiku-20240307'; 

const SESSION_TTL_MS          = 5 * 60 * 1000;   // 5 min inactivity
const SESSION_WARN_MS         = 4.5 * 60 * 1000; // 4:30 warn
const MAX_HISTORY_TURNS       = 20;

if (!ANTHROPIC_API_KEY)       console.warn('[BOOT] ⚠️  ANTHROPIC_API_KEY not set — AI calls will fail');

// ── Load System Prompt ──────────────────────────────────────
let SYSTEM_PROMPT = '';
const PROMPT_FILE = path.join(__dirname, 'NOVA_SYSTEM_PROMPT.txt');
try {
  SYSTEM_PROMPT = fs.readFileSync(PROMPT_FILE, 'utf8');
} catch {
  SYSTEM_PROMPT = `You are Mātauranga-NOVA, a warm Kiwi HIV companion. Safe-by-Default framework.`;
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
    },
  },
}));

app.use(cors({ origin: [ALLOWED_ORIGIN, 'http://localhost:10000', 'http://127.0.0.1:10000'] }));
app.use(express.json({ limit: '10kb' }));

// ============================================================
// LAYER 2 — RATE LIMITING + ANTI-DDOS
// ============================================================
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 15 });
const chatSlowDown = slowDown({ windowMs: 60 * 1000, delayAfter: 10, delayMs: (hits) => (hits - 10) * 500 });
const statsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

const authFailures  = new Map();
function authFailureLimiter(req, res, next) { next(); } // Simplify for deployment

// ============================================================
// LAYER 1 — PII SCRUBBING
// ============================================================
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(?:\+?64|0)[\s.\-]?(?:\d[\s.\-]?){6,10}\b/g, '[PHONE]')
    .replace(/\b\d{2,3}-\d{3}-\d{3}\b/g, '[IRD]')
    .replace(/\b[A-Z]{3}\d{4,5}\b(?!\d)/g, '[NHI]');
}

// ============================================================
// LAYER 5 — HIGH-RISK QUERY INTERCEPTION
// ============================================================
const CRISIS_PATTERNS = [ /\b(?:suicid|want\s+to\s+die|quiero\s+morir|self[\-\s]?harm|kill\s+myself)\b/i ];
function isHighRiskQuery(text) { return CRISIS_PATTERNS.some(p => p.test(text)); }

function getCrisisResponse(lang) {
  return `I hear you. That sounds incredibly heavy right now.\n\n**Please connect with someone right now:**\n- 📞 **Lifeline**: 0800 543 354\n- 📱 **1737**: text or call\n- 🚨 **Emergency services**: 111`;
}

// ============================================================
// LAYER 6 — MEDICAL OUTPUT INTERCEPTION
// ============================================================
const MEDICAL_OUT_PATTERNS = [ /\b\d+\s*mg\b/i, /\b(?:take|administer|dose)\s+\d+/i ];
function hasMedicalOutputRisk(text) { return MEDICAL_OUT_PATTERNS.some(p => p.test(text)); }
function getMedicalRedirectResponse(lang) {
  return `That's a question for a doctor or the **Burnett Foundation**.\n\n🌐 burnettfoundation.org.nz\n📞 09 309 3989`;
}

function detectLanguage(text) { return 'en'; }
function detectMoment(text) { return 0; }
function extractTopics(text) { return []; }

// ============================================================
// STATS ENCRYPTION & STATE
// ============================================================
const INITIAL_STATS = { totalSessions: 0, totalMessages: 0, crisisActivations: 0, medicalInterceptions: 0 };
let stats = JSON.parse(JSON.stringify(INITIAL_STATS));

const sessions = new Map();
function getOrCreateSession(sessionId) {
  const now = Date.now();
  if (sessions.has(sessionId)) { const s = sessions.get(sessionId); s.lastActive = now; return s; }
  const s = { history: [], lang: 'en', lastActive: now };
  sessions.set(sessionId, s);
  return s;
}

function appendToHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY_TURNS * 2) session.history.splice(0, 2);
}

// ============================================================
// ANTHROPIC STREAMING CALL
// ============================================================
function callAnthropicStream(messages, res) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) { resolve('Demo Mode: Set ANTHROPIC_API_KEY'); return; }

    const body = JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1024, temperature: 0.3, stream: true, system: SYSTEM_PROMPT, messages });
    const options = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) } };

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
          } catch {}
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
// STATIC FILES
// ============================================================
app.get('/', (_req, res) => {
  const p = path.join(__dirname, 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.send('<h2>NOVA ✅</h2><p>index.html not found.</p>');
});

app.post('/session-start', (_req, res) => {
  const sessionId = `sid_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  getOrCreateSession(sessionId);
  stats.totalSessions++;
  res.json({ status: 'ok', sessionId });
});

app.post('/session-end', (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId && sessions.has(sessionId)) sessions.delete(sessionId);
  res.json({ status: 'ok' });
});

// ============================================================
// POST /chat — MAIN WITH SENTIMENT ANALYSIS
// ============================================================
app.post('/chat', chatLimiter, chatSlowDown, async (req, res) => {
  const { message, sessionId } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required.' });

  const scrubbed  = scrubPII(message);
  const lang      = detectLanguage(scrubbed);
  stats.totalMessages++;

  // ── SENTIMENT LOGIC FOR CANVAS ─────────────────────────────
  let sentiment = 'neutral';
  if (isHighRiskQuery(scrubbed) || /\b(?:stigma|ashamed|angry|sad|depress|hate)\b/i.test(scrubbed)) {
    sentiment = 'alert'; // Se vuelve ROJA
  } else if (/\b(?:thanks|gracias|happy|help|good|love|aroha)\b/i.test(scrubbed)) {
    sentiment = 'warm';  // Se vuelve VERDE/ORO
  }

  // ── LAYER 5: Crisis pre-intercept ──────────────────────────
  if (isHighRiskQuery(scrubbed)) {
    stats.crisisActivations++;
    return res.json({ reply: getCrisisResponse(lang), crisis: true, streaming: false, sentiment: 'alert' });
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // ENVÍA EL METADATO DE SENTIMIENTO AL FRONTEND ANTES DE GENERAR EL TEXTO
  res.write(`data: ${JSON.stringify({ type: 'metadata', sentiment })}\n\n`);

  const session = sessionId ? getOrCreateSession(sessionId) : { history: [], lang, lastActive: Date.now() };
  appendToHistory(session, 'user', scrubbed);

  try {
    let fullReply = await callAnthropicStream(session.history, res);

    if (hasMedicalOutputRisk(fullReply)) {
      stats.medicalInterceptions++;
      const safeReply = getMedicalRedirectResponse(lang);
      res.write(`data: ${JSON.stringify({ type: 'replace', text: safeReply })}\n\n`);
      fullReply = safeReply;
    }

    appendToHistory(session, 'assistant', fullReply);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'delta', text: 'Error connecting.' })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

// START
app.listen(PORT, () => console.log(`🌿 NOVA Standalone v10 listening on port ${PORT}`));
module.exports = app;

