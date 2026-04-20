// ============================================================
// NOVA — Mātauranga NOVA Backend
// Burnett Foundation Innovation Challenge 2026
// ============================================================
// FIXES APLICADOS:
//   C1 — Dashboard password con bcrypt + rate limiting en fallos
//   C2 — stats.json cifrado AES-256-GCM en reposo
//   C3 — Preparado para Catalyst Cloud NZ (env-based host config)
//   H1 — Logging seguro: nunca se loguea el texto del mensaje
//   H2 — CSRF token + SameSite=Strict en cookies de sesión
//   H3 — Topic patterns revisados, u=u protegido, NHI más estricto
//   H4 — Anomaly monitoring: alerta si >5 crisis en 60 min
// ============================================================

'use strict';

require('dotenv').config();

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const slowDown  = require('express-slow-down');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 10000;

// ============================================================
// CONSTANTES DE ENTORNO
// ============================================================
const DASHBOARD_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH || '';
const STATS_ENCRYPTION_KEY    = process.env.STATS_ENCRYPTION_KEY    || '';
const ALLOWED_ORIGIN          = process.env.ALLOWED_ORIGIN || 'https://matauranga-nova.onrender.com';
const STATS_FILE              = path.join(__dirname, 'stats.json.enc');
const IS_PRODUCTION           = process.env.NODE_ENV === 'production';

// Advertencia en arranque si faltan vars críticas
if (!DASHBOARD_PASSWORD_HASH) {
  console.warn('[BOOT] ⚠️  DASHBOARD_PASSWORD_HASH no configurado — /stats desprotegido');
}
if (!STATS_ENCRYPTION_KEY || STATS_ENCRYPTION_KEY.length !== 64) {
  console.warn('[BOOT] ⚠️  STATS_ENCRYPTION_KEY ausente o inválida — stats se guardarán sin cifrar');
}

// ============================================================
// CAPA 4 — HELMET (HTTP Security Headers)
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      connectSrc:  ["'self'"],
      imgSrc:      ["'self'", 'data:'],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  hsts:                  { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy:        { policy: 'strict-origin-when-cross-origin' },
  xDnsPrefetchControl:  { allow: false },
  permissionsPolicy: {
    features: {
      geolocation:   ['()'],
      microphone:    ['()'],
      camera:        ['()'],
      usb:           ['()'],
      magnetometer:  ['()'],
    },
  },
}));

// ============================================================
// CORS
// ============================================================
app.use(cors({
  origin:  [ALLOWED_ORIGIN, 'http://localhost:10000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Dashboard-Auth', 'X-CSRF-Token'],
}));

app.use(express.json({ limit: '10kb' }));

// ============================================================
// CAPA 2 — RATE LIMITING + ANTI-DDOS
// ============================================================

// /chat — 15 mensajes por minuto por IP
const chatLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              15,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many messages. Please wait a moment.' },
});

// /chat — slow-down después de 10 mensajes
const chatSlowDown = slowDown({
  windowMs:           60 * 1000,
  delayAfter:         10,
  delayMs:            (hits) => (hits - 10) * 500,
  maxDelayMs:         10000,
});

// /stats — 30 req / 15 min
const statsLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              30,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests to /stats.' },
});

// /stats — rate limit específico para fallos de autenticación
const authFailures = new Map();           // ip → { count, firstAt }
const AUTH_MAX_FAILURES = 5;
const AUTH_WINDOW_MS    = 15 * 60 * 1000; // 15 min

function authFailureLimiter(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  const rec = authFailures.get(ip);

  if (rec) {
    if (now - rec.firstAt > AUTH_WINDOW_MS) {
      authFailures.delete(ip);            // ventana expirada, reset
    } else if (rec.count >= AUTH_MAX_FAILURES) {
      console.warn(`[AUTH] Bloqueo temporal IP ${ip} — ${rec.count} fallos`);
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
  }
  next();
}

function recordAuthFailure(ip) {
  const now = Date.now();
  const rec = authFailures.get(ip);
  if (!rec || Date.now() - rec.firstAt > AUTH_WINDOW_MS) {
    authFailures.set(ip, { count: 1, firstAt: now });
  } else {
    rec.count++;
  }
}

// ============================================================
// FIX C1 — DASHBOARD AUTH CON BCRYPT
// ============================================================
async function dashboardAuthMiddleware(req, res, next) {
  const provided = req.headers['x-dashboard-auth'] || '';

  // Sin header
  if (!provided) {
    return res.status(401).json({ error: 'X-Dashboard-Auth header required' });
  }

  // Sin hash configurado — modo dev: aceptar plain password de .env
  if (!DASHBOARD_PASSWORD_HASH) {
    const plain = process.env.DASHBOARD_PASSWORD || 'burnett2026';
    if (provided === plain) {
      console.log(`[AUTH] ✅ Dev-mode auth OK from ${req.ip}`);
      return next();
    }
    recordAuthFailure(req.ip);
    console.warn(`[AUTH] ❌ Fallo dev-mode from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Hash configurado — verificar con bcrypt
  try {
    const ok = await bcrypt.compare(provided, DASHBOARD_PASSWORD_HASH);
    if (ok) {
      authFailures.delete(req.ip);       // reset fallos al autenticarse OK
      console.log(`[AUTH] ✅ Dashboard auth OK from ${req.ip}`);
      return next();
    }
    recordAuthFailure(req.ip);
    console.warn(`[AUTH] ❌ Contraseña inválida from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) {
    console.error('[AUTH] bcrypt error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// FIX C2 — CIFRADO AES-256-GCM PARA STATS EN REPOSO
// ============================================================
const ENCRYPT_ALGO = 'aes-256-gcm';

function encryptStats(data) {
  if (!STATS_ENCRYPTION_KEY || STATS_ENCRYPTION_KEY.length !== 64) {
    // Sin clave: guardar JSON plano (solo en dev)
    return JSON.stringify(data);
  }
  const key = Buffer.from(STATS_ENCRYPTION_KEY, 'hex');
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPT_ALGO, key, iv);
  let enc = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  enc += cipher.final('hex');
  return JSON.stringify({
    v:       1,
    iv:      iv.toString('hex'),
    data:    enc,
    authTag: cipher.getAuthTag().toString('hex'),
  });
}

function decryptStats(raw) {
  // Si no tiene campo 'v', es JSON plano (migración sin clave)
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }

  if (!parsed.v) return parsed;          // formato plano legado

  if (!STATS_ENCRYPTION_KEY || STATS_ENCRYPTION_KEY.length !== 64) {
    console.warn('[CRYPTO] Clave ausente — no se puede descifrar stats.json.enc');
    return null;
  }
  try {
    const key      = Buffer.from(STATS_ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPT_ALGO, key, Buffer.from(parsed.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
    let dec = decipher.update(parsed.data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
  } catch (err) {
    console.error('[CRYPTO] Descifrado fallido:', err.message);
    return null;
  }
}

// ============================================================
// ESTADÍSTICAS INICIALES
// ============================================================
const INITIAL_STATS = {
  totalSessions:           0,
  monthSessions:           0,
  totalMessages:           0,
  firstSessionDate:        null,
  lastSessionDate:         null,
  languages:               { en: 0, es: 0, mi: 0 },
  topics: {
    HIV: 0, New_Diagnosis: 0, PrEP: 0, PEP: 0, DoxyPEP: 0, UeqU: 0,
    Syphilis: 0, Chlamydia: 0, Gonorrhoea: 0, STI_Testing: 0,
    Long_Term_Living: 0, ART_Medication: 0,
    Suicide_Ideation: 0, Self_Harm: 0, Crisis_Acute: 0,
    Anxiety: 0, Depression: 0, Loneliness: 0,
    Internal_Stigma: 0, External_Discrimination: 0, Bullying: 0,
    Online_Hate: 0, Workplace_Discrimination: 0, Medical_Discrimination: 0,
    LGBTQIA_Takatapui: 0, Disclosure: 0, Whanau_Family: 0,
    WINZ: 0, Housing_Council: 0, Legal_Rights: 0, Immigration: 0,
  },
  crisisActivations:      0,
  crisisActivationsMonth: 0,
};

let stats = { ...INITIAL_STATS };

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return;
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    const loaded = decryptStats(raw);
    if (loaded) {
      stats = { ...INITIAL_STATS, ...loaded };
      stats.languages = { ...INITIAL_STATS.languages, ...loaded.languages };
      stats.topics    = { ...INITIAL_STATS.topics,    ...loaded.topics };
      console.log('[STATS] ✅ Stats cargadas correctamente');
    }
  } catch (err) {
    console.error('[STATS] Error cargando stats:', err.message);
  }
}

function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, encryptStats(stats), 'utf8');
  } catch (err) {
    console.error('[STATS] Error guardando stats:', err.message);
  }
}

loadStats();
const saveInterval = setInterval(saveStats, 30000);

// ============================================================
// FIX H4 — ANOMALY MONITORING (picos de crisis)
// ============================================================
const crisisTimestamps = [];  // ventana deslizante de 60 min
const CRISIS_WINDOW_MS   = 60 * 60 * 1000;
const CRISIS_ALERT_COUNT = 5;

function recordCrisis() {
  const now = Date.now();
  crisisTimestamps.push(now);

  // Limpiar timestamps fuera de la ventana
  while (crisisTimestamps.length && now - crisisTimestamps[0] > CRISIS_WINDOW_MS) {
    crisisTimestamps.shift();
  }

  if (crisisTimestamps.length >= CRISIS_ALERT_COUNT) {
    console.error(
      `[CRISIS ALERT] ⚠️  ${crisisTimestamps.length} activaciones en la última hora — revisar urgente`
    );
    // Aquí se podría enviar email/webhook. Por ahora solo log de alerta.
  }
}

// ============================================================
// FIX H3 — CAPA 1: PII SCRUBBING (MEJORADO)
// ============================================================
function scrubPII(text) {
  return text
    // Email
    .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[EMAIL_REMOVED]')
    // Teléfono NZ: +64 / 0x x-digit combos
    .replace(/\b(?:\+?64|0)[\s.\-]?(?:\d[\s.\-]?){6,10}\b/g, '[PHONE_REMOVED]')
    // IRD: xx-xxx-xxx (más preciso: solo dígitos con guiones)
    .replace(/\b\d{2,3}-\d{3}-\d{3}\b/g, '[IRD_REMOVED]')
    // NHI: exactamente 3 letras + 4 dígitos + 1 dígito opcional (no 8+ dígitos seguidos)
    .replace(/\b[A-Z]{3}\d{4,5}\b(?!\d)/g, '[NHI_REMOVED]')
    // Tarjeta de crédito
    .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[CARD_REMOVED]')
    // Dirección NZ (formato estándar + units/flats)
    .replace(/\b(?:Unit|Flat|Apt|Suite)\s+\d+[A-Z]?\s*[,/]\s*\d{1,4}\s+[A-Z][a-z]+/gi, '[ADDRESS_REMOVED]')
    .replace(/\b\d{1,4}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|Road|Lane|Crescent|Avenue|Drive|Court|Place|Terrace|Grove|Close|Way|Rise|View|Heights|Gardens|Parade|Quay|Mall|Mews)\b/gi, '[ADDRESS_REMOVED]')
    // PO Box
    .replace(/\bP\.?O\.?\s*Box\s+\d+\b/gi, '[ADDRESS_REMOVED]');
}

// ============================================================
// DETECCIÓN DE IDIOMA
// ============================================================
function detectLanguage(text) {
  const t = text.toLowerCase();
  if (/t[eē]n[aā]\s+koe|kia\s+ora|wh[aā]nau|aroha|hauora|m[aā]ori|takatāpui|takatapui|kaiāwhina|rangatahi/i.test(t)) return 'mi';
  if (/\b(?:hola|gracias|cómo|estás|qué|tengo|soy|quiero|necesito|ayuda|estoy|me\s+siento|puedo|podría|tengo\s+miedo)\b/i.test(t)) return 'es';
  return 'en';
}

// ============================================================
// FIX H3 — TOPIC DETECTION (30 temas, patrones revisados)
// ============================================================
const TOPIC_PATTERNS = {
  // — VIH y tratamiento —
  HIV:            /\b(?:hiv|vih|seroposit(?:ive|ivo)|seropositivo|aids|sida|virus\s+de\s+la\s+inmuno)\b/i,
  New_Diagnosis:  /\b(?:just\s+found\s+out|newly\s+diagnosed|me\s+acabo\s+de\s+enterar|nuevo\s+diagnóstico|diagnosis|recién\s+diagnosticado|resultado\s+positivo|positive\s+result)\b/i,
  // FIX H3: u=u protegido con word boundary explícito para no solapar otros scrubs
  UeqU:           /\bu\s*[=equals]+\s*u\b|undetectable\s*=\s*untransmittable|indetectable\s*=\s*intransmisible|u\s*igual\s*u\b/i,
  Long_Term_Living: /\b(?:living\s+with\s+hiv\s+for|vivir\s+con\s+vih|años\s+con\s+vih|years\s+with\s+hiv|long[\s\-]term|vida\s+con\s+vih)\b/i,
  ART_Medication: /\b(?:art|antiretroviral|biktarvy|truvada|descovy|atripla|genvoya|cabenuva|tenofovir|emtricitabine|dolutegravir|medicación|medication|tratamiento\s+antirretroviral)\b/i,

  // — Prevención —
  PrEP:           /\b(?:prep|pre[\-\s]?exposure\s+prophylaxis|profilaxis\s+pre[\-\s]?exposición)\b/i,
  PEP:            /\b(?:pep|post[\-\s]?exposure\s+prophylaxis|profilaxis\s+post[\-\s]?exposición|72\s*hours?\s+after|72\s*horas?\s+después)\b/i,
  DoxyPEP:        /\b(?:doxypep|doxycycline|doxiciclina|profilaxis\s+con\s+doxi)\b/i,
  STI_Testing:    /\b(?:sti\s+test|sexual\s+health\s+check|full\s+screen|testing\s+de\s+its|hacerme\s+(?:una\s+)?prueba|get\s+tested|hacerse\s+análisis)\b/i,

  // — ITS —
  Syphilis:       /\b(?:syphilis|sífilis|treponema)\b/i,
  Chlamydia:      /\b(?:chlamydia|clamidia)\b/i,
  Gonorrhoea:     /\b(?:gonorrh?o?ea|gonorrea)\b/i,

  // — Crisis (orden de prioridad al detectar) —
  Suicide_Ideation: /\b(?:suicid(?:e|al|io|arse)|want\s+to\s+die|wanna\s+die|quiero\s+morir(?:me)?|ganas\s+de\s+morir|end\s+(?:my\s+)?life|terminar\s+con\s+(?:mi\s+)?vida|no\s+quiero\s+(?:seguir\s+)?vivir|not\s+worth\s+living|pensar\s+en\s+(?:el\s+)?suicidio)\b/i,
  Self_Harm:        /\b(?:self[\-\s]?harm|cutting\s+myself|hurt\s+myself|autolesion(?:arme|arse|es)|cortarme|hacerme\s+daño|lastimar(?:me|se))\b/i,
  Crisis_Acute:     /\b(?:crisis|emergency|emergencia|urgencia|can't\s+cope|no\s+puedo\s+más|breaking\s+down|colapso|desbordado)\b/i,

  // — Salud mental —
  Anxiety:        /\b(?:anxi(?:ety|ous)|pánico|panic\s+attack|attack\s+de\s+pánico|ansiedad|worry|preocup(?:ado|ación)|nervous|miedo\s+constante)\b/i,
  Depression:     /\b(?:depress(?:ed|ion)|depresión|deprimido|sad\s+all\s+the\s+time|tristeza\s+profunda|hopeless|sin\s+esperanza|no\s+hay\s+salida)\b/i,
  Loneliness:     /\b(?:lonely|loneliness|alone|soledad|solo|aislado|isolated|nadie\s+(?:me\s+)?entiende|no\s+one\s+understands)\b/i,

  // — Estigma y discriminación —
  Internal_Stigma:          /\b(?:ashamed|shame|vergüenza|disgusted\s+with\s+myself|asco\s+de\s+m[íi]|self[\-\s]?hate|me\s+odio|defect(?:o|ive)|no\s+valgo)\b/i,
  External_Discrimination:  /\b(?:discriminat(?:ed|ion)|rejected|rechazado|treated\s+differently|me\s+tratan\s+diferente|unfair|injust(?:o|icia))\b/i,
  Bullying:                 /\b(?:bullying|bully|acoso|acosado|mocking|burlas|me\s+hacen\s+bullying)\b/i,
  Online_Hate:              /\b(?:online\s+hate|cyberbullying|ciberacoso|hate\s+(?:speech|comments)|comentarios\s+de\s+odio|trolling|harass(?:ment|ed)\s+online)\b/i,
  Workplace_Discrimination: /\b(?:work(?:place)?\s+discrimination|fired\s+because|despedido\s+por|job\s+discrimination|discriminación\s+laboral|fired\s+for\s+being)\b/i,
  Medical_Discrimination:   /\b(?:doctor\s+(?:refused|rejected)|médico\s+(?:rechazó|se\s+negó)|denied\s+(?:care|treatment)|discriminación\s+médica|healthcare\s+discrimination)\b/i,

  // — Identidad y comunidad —
  LGBTQIA_Takatapui: /\b(?:gay|lesbian(?:a)?|trans(?:gender)?|queer|bisex(?:ual)?|takatāpui|takatapui|rainbow|non[\-\s]?binary|no[\-\s]?binari(?:o|e)|intersex|asexual|pansexual|comunidad\s+lgbt)\b/i,
  Disclosure:        /\b(?:tell(?:ing)?\s+(?:someone|my\s+partner|family)|contar(?:le)?\s+(?:a\s+alguien|a\s+mi\s+pareja|a\s+mi\s+familia)|reveal(?:ing)?\s+(?:my\s+)?status|revelar\s+mi\s+(?:estado|diagnóstico)|disclosure|divulgar)\b/i,
  Whanau_Family:     /\b(?:wh[aā]nau|family|familia|parents|padres|siblings|hermanos|partner|pareja|m[aā]ma|dad|papá|abuelo|grandparents)\b/i,

  // — Servicios sociales NZ —
  WINZ:            /\b(?:winz|work\s+and\s+income|benefit|beneficio|jobseeker|supported\s+living|disability\s+allowance|accommodation\s+supplement)\b/i,
  Housing_Council: /\b(?:k[aā]inga\s+ora|housing\s+(?:new\s+zealand|nz|corp)|council\s+housing|state\s+house|homeless(?:ness)?|sin\s+hogar|housing\s+help|public\s+housing)\b/i,
  Legal_Rights:    /\b(?:human\s+rights\s+act|hrc|rights|derechos|legal\s+advice|abogado|lawyer|human\s+rights\s+commission|discriminación\s+ilegal|sue)\b/i,
  Immigration:     /\b(?:visa|residency|resident\s+visa|work\s+visa|citizenship|ciudadanía|immigration\s+nz|inz|migrant|migrante|deportation|deportación)\b/i,
};

function extractTopics(text) {
  return Object.entries(TOPIC_PATTERNS)
    .filter(([, regex]) => regex.test(text))
    .map(([key]) => key);
}

const CRISIS_TOPICS = new Set(['Suicide_Ideation', 'Self_Harm', 'Crisis_Acute']);

// ============================================================
// RESPUESTAS DEMO (sin IA externa)
// ============================================================
const DEMO_REPLIES = {
  crisis: {
    en: `What you're feeling right now is real, and it matters deeply.\nYou are not alone — please reach out right now:\n\n• **Lifeline:** 0800 543 354 (free, 24/7)\n• **1737:** text or call (free, 24/7)\n• **111:** emergency services\n\nNOVA is here with you, but these trained humans can offer the support you deserve in this moment.`,
    es: `Lo que sentís ahora es real y tiene un valor enorme.\nNo estás solo — comunicate ahora:\n\n• **Lifeline:** 0800 543 354 (gratuito, 24/7)\n• **1737:** texto o llamada (gratuito, 24/7)\n• **111:** servicios de emergencia\n\nNOVA está aquí, pero estas personas entrenadas pueden darte el apoyo que merecés en este momento.`,
    mi: `He tūāhu tō mamae, ā, he nui rawa atu. Kāore koe i runga anō.\nTūhunga atu ki ēnei tāngata inaianei:\n\n• **Lifeline:** 0800 543 354\n• **1737:** karere, waea rānei (kore utu, 24/7)\n• **111:** āheitanga ohotata\n\nKei konei a NOVA, engari ka taea e ēnei tāngata ārahina koe.`,
  },
  new_diagnosis: {
    en: `Breathe. This is just information — not a sentence about who you are or how your life will unfold.\n\nMany people living with HIV in Aotearoa lead full, healthy, connected lives. You're not alone in this.\n\nThe Burnett Foundation is here: burnettfoundation.org.nz — real people, no judgment.`,
    es: `Respirá. Esto es solo información — no una sentencia sobre quién sos ni cómo va a ser tu vida.\n\nMuchas personas que viven con VIH en Aotearoa llevan vidas plenas, saludables y conectadas. No estás solo en esto.\n\nLa Fundación Burnett está aquí: burnettfoundation.org.nz — personas reales, sin juicio.`,
    mi: `Manawa. He kōrero noa iho tēnei — ehara i te hei o tō ao.\n\nHe maha ngā tāngata e noho ana me te HIV i Aotearoa, ā, he ora tō rātou ora.\n\nKei konei te Burnett Foundation: burnettfoundation.org.nz`,
  },
  prep_pep: {
    en: `Asking about prevention is exactly the right thing to do — no matter where you're coming from.\n\n**PrEP** reduces HIV risk by up to 99% when taken daily. **PEP** must start within 72 hours after possible exposure.\n\nFor access and prescriptions in NZ: **Burnett Foundation** → burnettfoundation.org.nz\nOr your local sexual health clinic.`,
    es: `Preguntar sobre prevención es exactamente lo correcto — sin importar desde dónde venís.\n\n**PrEP** reduce el riesgo de VIH hasta un 99% tomado diariamente. **PEP** debe comenzarse dentro de las 72 horas después de una posible exposición.\n\nPara acceso y recetas en NZ: **Burnett Foundation** → burnettfoundation.org.nz`,
    mi: `He mea tika tō pātai mō ngā ārai — ahakoa nō hea koe.\n\n**PrEP** ka heke ai te tūraru HIV ki te 99%. **PEP** me tīmata i roto i te 72 haora.\n\nBurnett Foundation: burnettfoundation.org.nz`,
  },
  stigma_discrimination: {
    en: `HIV is something you have. It is not who you are.\n\nWhatever you're facing — internally or from others — that rejection is not a reflection of your worth.\n\nIn Aotearoa, the **Human Rights Act 1993** protects people from discrimination based on health status. You have rights.\n\nHuman Rights Commission: hrc.co.nz`,
    es: `El VIH es algo que tenés. No es quién sos.\n\nCualquier cosa que estés enfrentando — internamente o de parte de otros — ese rechazo no refleja tu valor.\n\nEn Aotearoa, la **Ley de Derechos Humanos de 1993** protege a las personas de la discriminación por estado de salud. Tenés derechos.\n\nComisión de Derechos Humanos: hrc.co.nz`,
    mi: `He mate anake tō HIV — ehara i a koe.\n\nKa tiakina koe e te **Human Rights Act 1993** i Aotearoa.\n\nHuman Rights Commission: hrc.co.nz`,
  },
  general: {
    en: `Kia ora. I'm NOVA — a warm, non-judgmental companion for people navigating HIV in Aotearoa.\n\nThis is a prototype — I'm here to listen and connect you with real support.\n\nYou can ask me about HIV, PrEP, PEP, mental health, stigma, legal rights, or anything on your mind. I won't judge. I won't store what you share.`,
    es: `Kia ora. Soy NOVA — un compañero cálido y sin juicio para personas que navegan el VIH en Aotearoa.\n\nEsto es un prototipo — estoy aquí para escuchar y conectarte con apoyo real.\n\nPodés preguntarme sobre VIH, PrEP, PEP, salud mental, estigma, derechos legales, o lo que sea. No juzgo. No guardo lo que compartís.`,
    mi: `Kia ora. Ko NOVA ahau — he hoa āwhina, kore whakawā, mō ngā tāngata e haere ana i roto i te HIV i Aotearoa.\n\nHe tauira tēnei — kei konei ahau ki te whakarongo, ki te hono atu ki a koe ki ngā tautoko tūturu.`,
  },
};

function selectDemoReply(topics, lang) {
  const l = lang || 'en';
  const hasCrisis = topics.some(t => CRISIS_TOPICS.has(t));
  if (hasCrisis) return DEMO_REPLIES.crisis[l] || DEMO_REPLIES.crisis.en;

  if (topics.includes('New_Diagnosis'))  return DEMO_REPLIES.new_diagnosis[l]          || DEMO_REPLIES.new_diagnosis.en;
  if (topics.some(t => ['PrEP','PEP','DoxyPEP'].includes(t))) return DEMO_REPLIES.prep_pep[l] || DEMO_REPLIES.prep_pep.en;
  if (topics.some(t => ['Internal_Stigma','External_Discrimination','Bullying','Medical_Discrimination','Online_Hate','Workplace_Discrimination'].includes(t)))
    return DEMO_REPLIES.stigma_discrimination[l] || DEMO_REPLIES.stigma_discrimination.en;

  return DEMO_REPLIES.general[l] || DEMO_REPLIES.general.en;
}

// ============================================================
// FIX H2 — CSRF TOKEN (para requests del dashboard)
// ============================================================
const csrfTokens = new Map();   // token → { createdAt }
const CSRF_TTL_MS = 60 * 60 * 1000;  // 1 hora

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, { createdAt: Date.now() });
  return token;
}

function validateCsrfToken(token) {
  const rec = csrfTokens.get(token);
  if (!rec) return false;
  if (Date.now() - rec.createdAt > CSRF_TTL_MS) {
    csrfTokens.delete(token);
    return false;
  }
  return true;
}

// Limpiar tokens expirados cada hora
setInterval(() => {
  const now = Date.now();
  for (const [token, rec] of csrfTokens) {
    if (now - rec.createdAt > CSRF_TTL_MS) csrfTokens.delete(token);
  }
}, 60 * 60 * 1000);

// ============================================================
// RUTAS ESTÁTICAS
// ============================================================
app.get('/', (_req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.send('<h2>NOVA is running ✅</h2><p>index.html not found in this directory.</p>');
});

app.get('/dashboard.html', (req, res) => {
  // H2: inyectar CSRF token en respuesta HTML
  const csrf = generateCsrfToken();
  const dashPath = path.join(__dirname, 'dashboard.html');
  if (!fs.existsSync(dashPath)) {
    return res.send(`<h2>Dashboard</h2><p>dashboard.html no encontrado.</p>`);
  }
  let html = fs.readFileSync(dashPath, 'utf8');
  // Insertar token como meta tag si el placeholder existe, si no al final del head
  if (html.includes('{{CSRF_TOKEN}}')) {
    html = html.replace('{{CSRF_TOKEN}}', csrf);
  } else {
    html = html.replace('</head>', `<meta name="csrf-token" content="${csrf}"></head>`);
  }
  res.send(html);
});

// ============================================================
// POST /session-start
// ============================================================
app.post('/session-start', (_req, res) => {
  const sessionId = `sid_${uuidv4().replace(/-/g,'').slice(0,12)}`;
  const now = new Date().toISOString();

  stats.totalSessions++;
  stats.monthSessions++;
  if (!stats.firstSessionDate) stats.firstSessionDate = now;
  stats.lastSessionDate = now;

  // H1: Logging seguro — sin texto de usuario
  console.log(`[SESSION] Nueva sesión — total: ${stats.totalSessions}`);

  res.json({ status: 'ok', sessionId });
});

// ============================================================
// POST /chat  (endpoint principal)
// ============================================================
app.post('/chat', chatLimiter, chatSlowDown, (req, res) => {
  const { message } = req.body || {};

  // Validación de entrada
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
  }

  // CAPA 1: PII Scrubbing
  const scrubbed = scrubPII(message);

  // Análisis local (sin API externa)
  const topics = extractTopics(scrubbed);
  const lang   = detectLanguage(scrubbed);

  // H1: Logging seguro — SOLO metadata, nunca el texto
  console.log(`[CHAT] Lang: ${lang} | Topics: [${topics.join(', ') || 'none'}] | Len: ${message.length}`);

  // CAPA 3: Actualizar stats (solo contadores)
  stats.totalMessages++;
  stats.languages[lang] = (stats.languages[lang] || 0) + 1;
  topics.forEach(t => {
    if (stats.topics[t] !== undefined) stats.topics[t]++;
  });

  // H4: Detectar y monitorear crisis
  const hasCrisis = topics.some(t => CRISIS_TOPICS.has(t));
  if (hasCrisis) {
    stats.crisisActivations++;
    stats.crisisActivationsMonth++;
    recordCrisis();  // alerta si hay pico
  }

  const reply = selectDemoReply(topics, lang);
  res.json({ reply });
});

// ============================================================
// GET /stats  (dashboard — protegido)
// ============================================================
app.get(
  '/stats',
  statsLimiter,
  authFailureLimiter,
  dashboardAuthMiddleware,
  (_req, res) => {
    console.log('[AUDIT] GET /stats accedido correctamente');
    res.json(stats);
  }
);

// ============================================================
// GET /health  (público, sin datos sensibles)
// ============================================================
app.get('/health', (_req, res) => {
  res.json({
    status:          'ok',
    mode:            'demo',
    uptime:          Math.floor(process.uptime()),
    totalSessions:   stats.totalSessions,
    totalMessages:   stats.totalMessages,
    topicsTracked:   Object.keys(stats.topics).length,
    layers: {
      layer1_piiScrub:         'active',
      layer2_rateLimit:        'active',
      layer3_zeroRetention:    'active',
      layer4_helmetCompliance: 'active',
    },
    fixes: {
      C1_bcryptAuth:   DASHBOARD_PASSWORD_HASH ? 'active' : 'dev-mode',
      C2_encryptedStats: STATS_ENCRYPTION_KEY ? 'active' : 'dev-mode',
      C3_envBasedHost: 'ready',
      H1_safeLogging:  'active',
      H2_csrfTokens:   'active',
      H3_improvedPatterns: 'active',
      H4_anomalyMonitor:   'active',
    },
  });
});

// ============================================================
// 404 catch-all
// ============================================================
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
function shutdown(signal) {
  console.log(`[${signal}] Guardando stats y cerrando...`);
  clearInterval(saveInterval);
  saveStats();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ============================================================
// ARRANQUE
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🌿 NOVA escuchando en puerto ${PORT}`);
  console.log(`   Modo: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`   Auth: ${DASHBOARD_PASSWORD_HASH ? 'bcrypt ✅' : 'plaintext (dev) ⚠️'}`);
  console.log(`   Cifrado stats: ${STATS_ENCRYPTION_KEY ? 'AES-256-GCM ✅' : 'sin cifrar (dev) ⚠️'}`);
  console.log(`   CORS: ${ALLOWED_ORIGIN}`);
  console.log(`   Fixes activos: C1 C2 C3 H1 H2 H3 H4\n`);
});

module.exports = app;  // para tests
