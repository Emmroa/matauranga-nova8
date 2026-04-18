// ═══════════════════════════════════════════════════════════
// NOVA — Mātauranga Backend
// Burnett Foundation Innovation Challenge 2026
// Quad-Layer Security Architecture
// Built by Emanuel Figueroa
// ═══════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
// ═══════════════════════════════════════════════════════════
// CAPA 4 — HELMET (headers HTTP de seguridad)
// ═══════════════════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

app.use(cors({
  origin: [
    'https://matauranga-nova8.onrender.com',
    'http://localhost:10000'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Dashboard-Auth']
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════
// CAPA 2 — RATE LIMITING + ANTI-DDoS
// ═══════════════════════════════════════════════════════════
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados mensajes. Por favor esperá un momento." }
});

const chatSlowDown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 10,
  delayMs: (hits) => (hits - 10) * 500,
  maxDelayMs: 10000,
  validate: { delayMs: false }
});

app.use('/chat', chatLimiter, chatSlowDown);

const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts." }
});
app.use('/stats', dashboardLimiter);

// ═══════════════════════════════════════════════════════════
// CAPA 3 — PERSISTENCIA DE STATS (archivo JSON)
// ═══════════════════════════════════════════════════════════
const STATS_FILE = path.join(__dirname, 'stats.json');

const INITIAL_STATS = {
  totalSessions: 0,
  monthSessions: 0,
  totalMessages: 0,
  firstSessionDate: null,
  lastSessionDate: null,
  languages: { en: 0, es: 0, mi: 0 },
  topics: {
    HIV: 0, New_Diagnosis: 0, PrEP: 0, PEP: 0, DoxyPEP: 0, UeqU: 0,
    Syphilis: 0, Chlamydia: 0, Gonorrhoea: 0, STI_Testing: 0,
    Long_Term_Living: 0, ART_Medication: 0,
    Suicide_Ideation: 0, Self_Harm: 0, Crisis_Acute: 0,
    Anxiety: 0, Depression: 0, Loneliness: 0,
    Internal_Stigma: 0, External_Discrimination: 0, Bullying: 0,
    Online_Hate: 0, Workplace_Discrimination: 0, Medical_Discrimination: 0,
    LGBTQIA_Takatapui: 0, Disclosure: 0, Whanau_Family: 0,
    WINZ: 0, Housing_Council: 0, Legal_Rights: 0, Immigration: 0
  },
  crisisActivations: 0,
  crisisActivationsMonth: 0
};

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      return { ...INITIAL_STATS, ...loaded, topics: { ...INITIAL_STATS.topics, ...loaded.topics } };
    }
  } catch (err) {
    console.log('⚠️ Stats file invalid, using fresh stats');
  }
  return { ...INITIAL_STATS };
}

function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('❌ Could not save stats:', err.message);
  }
}

let stats = loadStats();
setInterval(saveStats, 30000);

// ═══════════════════════════════════════════════════════════
// CAPA 1 — PII SCRUBBING
// ═══════════════════════════════════════════════════════════
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REMOVED]')
    .replace(/\b(?:\+?64|0)[-.\s]?(?:\d[-.\s]?){6,10}\b/g, '[PHONE_REMOVED]')
    .replace(/\b\d{2,3}-\d{3}-\d{3}\b/g, '[IRD_REMOVED]')
    .replace(/\b[A-Z]{3}\d{4}\b/g, '[NHI_REMOVED]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_REMOVED]')
    .replace(/\b\d{1,4}\s+[A-Z][a-z]+\s+(Street|Road|Avenue|Lane|Drive|Place|Crescent|St|Rd|Ave|Ln|Dr|Pl|Cr)\b/gi, '[ADDRESS_REMOVED]');
}

// ═══════════════════════════════════════════════════════════
// TOPIC EXTRACTION (análisis local, no usa IA externa)
// ═══════════════════════════════════════════════════════════
const TOPIC_PATTERNS = {
  HIV:              /\b(vih|hiv|seropositiv|positivo al|positive result|aids|sida)\b/i,
  New_Diagnosis:    /\b(just (found out|got diagnosed|tested positive)|me acabo de enterar|recien diagnostic|nuevo diagnostic)\b/i,
  PrEP:             /\b(prep|pre[\s-]?exposure prophylaxis|profilaxis pre[\s-]?exposici[oó]n)\b/i,
  PEP:              /\b(pep|post[\s-]?exposure|72 hours|72 horas|exposure last night|anoche tuve)\b/i,
  DoxyPEP:          /\b(doxypep|doxy[\s-]?pep|doxycycline|doxiciclina)\b/i,
  UeqU:             /\b(u=u|u equals u|undetectable\s?=\s?untransmittable|indetectable|viral load undetect)\b/i,
  Syphilis:         /\b(syphilis|s[ií]filis|treponema)\b/i,
  Chlamydia:        /\b(chlamydia|clamidia)\b/i,
  Gonorrhoea:       /\b(gonorrhoea|gonorrhea|gonorrea)\b/i,
  STI_Testing:      /\b(sti test|std test|prueba (de )?its|full screen|sexual health (check|screen))\b/i,
  Long_Term_Living: /\b(living with hiv for|tengo vih hace|living long[\s-]?term|a[nñ]os con vih|diagnosed \d+ years)\b/i,
  ART_Medication:   /\b(art|antiretroviral|antirretroviral|tenofovir|dolutegravir|biktarvy)\b/i,
  Suicide_Ideation: /\b(suicid|kill myself|end (my|it) (all|life)|matarme|me quiero morir|no quiero vivir|want to die|acabar con todo)\b/i,
  Self_Harm:        /\b(self[\s-]?harm|hurt myself|cutting|cortarme|hacerme da[nñ]o|lastimarme)\b/i,
  Crisis_Acute:     /\b(no puedo m[aá]s|can'?t do this anymore|can'?t cope|estoy colapsando|breakdown|falling apart|no aguanto)\b/i,
  Anxiety:          /\b(anxiety|anxious|panic|ansiedad|ansioso|ataque de p[aá]nico|overwhelm)\b/i,
  Depression:       /\b(depress|depresi[oó]n|depressed|deprimido|hopeless|sin esperanza|no hope)\b/i,
  Loneliness:       /\b(lonely|loneliness|solo|soledad|aislado|isolated|no one|nadie)\b/i,
  Internal_Stigma:       /\b(ashamed|verg[uü]enza|self[\s-]?hate|shame|disgusting|asqueroso|soy sucio|worthless)\b/i,
  External_Discrimination: /\b(discriminat|discrimin[aá]|rechaz|rejected|prejudice|prejuicio|they treat me)\b/i,
  Bullying:              /\b(bully|bullied|bullying|acoso|me molestan|harassment|hostig)\b/i,
  Online_Hate:           /\b(online hate|cyberbully|ciberacoso|hate speech|trolling|insultos online|ataques en redes)\b/i,
  Workplace_Discrimination: /\b(fired|me despid|discrimin(ated|aron) at work|boss found out|trabajo discrimin|workplace hiv)\b/i,
  Medical_Discrimination:   /\b(doctor refused|m[eé]dico se neg[oó]|denied treatment|hospital discriminat|clinic refused)\b/i,
  LGBTQIA_Takatapui: /\b(gay|lesbian|bisexual|bi|trans|transgender|queer|non[\s-]?binary|takat[aā]pui|lgbt|rainbow whanau)\b/i,
  Disclosure:        /\b(tell (my|him|her|them)|decirle|contarle|disclos|come out|revelarle|should i tell)\b/i,
  Whanau_Family:     /\b(wh[aā]nau|family|familia|parents|padres|mum|dad|mam[aá]|pap[aá]|hermano|hermana|sibling)\b/i,
  WINZ:            /\b(winz|work and income|benefit|subsidio|jobseeker|supported living|disability allowance)\b/i,
  Housing_Council: /\b(housing|council|vivienda|k[aā]inga ora|homeless|sin casa|rent (assistance|help)|housing nz)\b/i,
  Legal_Rights:    /\b(human rights|derechos humanos|legal advice|asesor[ií]a legal|lawyer|abogado|hrc|discriminaci[oó]n legal)\b/i,
  Immigration:     /\b(immigration|inmigraci[oó]n|visa|residency|residencia|work permit|hiv visa)\b/i
};

function extractTopics(text) {
  const found = [];
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(text)) found.push(topic);
  }
  return found;
}

// ═══════════════════════════════════════════════════════════
// DEMO REPLIES
// ═══════════════════════════════════════════════════════════
const DEMO_REPLIES = {
  crisis: "Lo que sentís es real y no tenés que llevarlo solo. Si estás en peligro inmediato llamá al 111. Para hablar 24/7: Lifeline 0800 543 354 o texto/llamada 1737. Este prototipo demo no reemplaza apoyo profesional real — por favor contactá estos recursos ahora.",
  diagnosis: "Kia ora. Respirá. Esto es solo información, no una sentencia sobre tu vida. En la versión final con IA completa, NOVA te acompañaría en este momento sin apurar nada. Por ahora este es un prototipo — pero el apoyo real está disponible en Burnett Foundation (burnettfoundation.org.nz) y Body Positive NZ.",
  prep: "PrEP es altamente efectivo para prevenir HIV. En NZ se accede a través de tu médico de cabecera o Burnett Foundation. Si tuviste una exposición en las últimas 72 horas, consultá sobre PEP urgente. Este es un prototipo demo — la versión completa con IA te guiaría con más detalle.",
  stigma: "Lo que te están haciendo sentir no te define. El estigma viene de la ignorancia, no de vos. Si estás enfrentando discriminación en NZ, el Human Rights Act 1993 te protege. Este es un prototipo — la versión completa te daría apoyo específico para tu situación.",
  default: "Kia ora. Este es un prototipo para el Burnett Foundation Innovation Challenge 2026. El chat completo con IA está temporalmente limitado por cuota de API. En la versión final, NOVA responderá en tiempo real con privacidad total y detección de los 7 Moments. ¿Querés que te muestre cómo funcionaría el flujo completo?"
};

function selectDemoReply(topics) {
  if (topics.includes('Suicide_Ideation') || topics.includes('Self_Harm') || topics.includes('Crisis_Acute')) return DEMO_REPLIES.crisis;
  if (topics.includes('New_Diagnosis')) return DEMO_REPLIES.diagnosis;
  if (topics.includes('PrEP') || topics.includes('PEP') || topics.includes('DoxyPEP')) return DEMO_REPLIES.prep;
  if (topics.includes('Internal_Stigma') || topics.includes('External_Discrimination') || topics.includes('Bullying')) return DEMO_REPLIES.stigma;
  return DEMO_REPLIES.default;
}

function detectLanguage(text) {
  if (/\b(t[eē]n[aā] koe|kia ora|wh[aā]nau|aroha|hauora|m[aā]ori)\b/i.test(text)) return 'mi';
  if (/\b(hola|gracias|c[oó]mo|est[aá]s|qu[eé]|tengo|soy|me|te|por favor)\b/i.test(text)) return 'es';
  return 'en';
}

// ═══════════════════════════════════════════════════════════
// CHAT ENDPOINT
// ═══════════════════════════════════════════════════════════
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Empty message." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "Message too long (max 2000 chars)." });
    }

    // [CAPA 1] Scrub PII
    const scrubbed = scrubPII(message);

    // Extract topics locally
    const detectedTopics = extractTopics(scrubbed);
    const lang = detectLanguage(scrubbed);

    // Update stats (counters only — NEVER the text)
    stats.totalMessages++;
    if (!stats.firstSessionDate) stats.firstSessionDate = new Date().toISOString();
    stats.lastSessionDate = new Date().toISOString();
    if (stats.languages[lang] !== undefined) stats.languages[lang]++;
    detectedTopics.forEach(topic => {
      if (stats.topics[topic] !== undefined) stats.topics[topic]++;
    });

    // Crisis auto-detection
    if (detectedTopics.some(t => ['Suicide_Ideation', 'Self_Harm', 'Crisis_Acute'].includes(t))) {
      stats.crisisActivations++;
      stats.crisisActivationsMonth++;
    }

    // Safe log — NEVER includes message content
    console.log(`📊 Session | Lang: ${lang} | Topics: [${detectedTopics.join(', ') || 'none'}]`);

    const reply = selectDemoReply(detectedTopics);
    res.json({ reply });

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({ error: "Internal error. Could not process message." });
  }
});

app.post('/session-start', (req, res) => {
  stats.totalSessions++;
  stats.monthSessions++;
  saveStats();
  res.json({ status: 'ok', sessionId: 'sid_' + Date.now().toString(36) });
});

// ═══════════════════════════════════════════════════════════
// STATS ENDPOINT (protegido con password)
// ═══════════════════════════════════════════════════════════
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'burnett2026';

app.get('/stats', (req, res) => {
  const auth = req.headers['x-dashboard-auth'];
  if (auth !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json(stats);
});

// Health check (público, sin datos sensibles)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'demo',
    uptime: Math.floor(process.uptime()),
    totalSessions: stats.totalSessions,
    totalMessages: stats.totalMessages,
    topicsTracked: Object.keys(stats.topics).length,
    layers: {
      layer1_piiScrub: 'active',
      layer2_rateLimit: 'active',
      layer3_zeroRetention: 'active',
      layer4_helmetCompliance: 'active'
    }
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((req, res) => {
  res.status(404).send(`
    <html><body style="background:#040c07;color:#f0ead4;font-family:sans-serif;text-align:center;padding:80px">
      <h1 style="color:#c9973a;font-size:48px">404</h1>
      <p>Page not found · Page kāore e kitea</p>
      <a href="/" style="color:#2dd4a7">← Back to NOVA</a>
    </body></html>
  `);
});

process.on('SIGTERM', () => { saveStats(); process.exit(0); });
process.on('SIGINT', () => { saveStats(); process.exit(0); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🚀 NOVA Mātauranga — Burnett Foundation 2026');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Port: ${PORT}`);
  console.log(`  Mode: Demo (no API credit)`);
  console.log(`  Topics tracked: ${Object.keys(stats.topics).length}`);
  console.log(`  Security layers: 4 active`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});

