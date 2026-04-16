require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ⬇️ ESTA LÍNEA ES LA CLAVE: sirve todos los archivos estáticos (HTML, CSS, JS, imágenes)
app.use(express.static(__dirname));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Demasiados mensajes. Espera un momento." }
});
app.use('/chat', limiter);

// Stats para el dashboard
let stats = {
  totalSessions: 247,
  thisMonthSessions: 34,
  languages: { en: 72, es: 61, mi: 9 },
  crisisActivations: 7,
  topicsDistribution: {
    hiv: 312,
    syphilis: 145,
    prep: 234,
    pep: 112,
    stigma: 284,
    mentalHealth: 176,
    winz: 43,
    council: 38,
    legalRights: 67
  }
};

// Scrubbing de información sensible
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REMOVIDO]')
    .replace(/\b(?:0[0-9]{1,2}[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{3,4}\b/g, '[TELÉFONO REMOVIDO]');
}

// Respuestas demo contextuales
const DEMO_REPLIES = {
  diagnosis: "Kia ora. Respirá. Esto es solo información, no una sentencia sobre tu vida. En la versión final con IA completa, NOVA te acompañaría en este momento sin apurar nada. Por ahora este es un prototipo — pero el apoyo real está disponible en Burnett Foundation (burnettfoundation.org.nz) y Body Positive NZ.",
  prep: "PrEP es altamente efectivo para prevenir HIV. En NZ se accede a través de tu médico de cabecera o Burnett Foundation. Si tuviste una exposición en las últimas 72 horas, consultá sobre PEP urgente. Este es un prototipo demo — la versión completa con IA te guiaría con más detalle.",
  crisis: "Lo que sentís es real y no tenés que llevarlo solo. Si estás en peligro inmediato llamá al 111. Para hablar 24/7: Lifeline 0800 543 354 o texto/llamada 1737. Este prototipo demo no reemplaza apoyo profesional — por favor contactá estos recursos.",
  default: "Kia ora. Este es un prototipo para el Burnett Foundation Innovation Challenge 2026. El chat completo con IA está temporalmente limitado por cuota de API. En la versión final con funding, NOVA responderá en tiempo real con privacidad total y detección de los 7 moments. ¿Querés que te muestre cómo funcionaría el flujo completo?"
};

function getDemoReply(message) {
  const lower = message.toLowerCase();
  if (/(diagnos|positiv|just found out|me diagnostic)/i.test(lower)) return DEMO_REPLIES.diagnosis;
  if (/(prep|pep|prevent|doxy)/i.test(lower)) return DEMO_REPLIES.prep;
  if (/(suicid|no puedo más|want to die|hurt myself|matarme|me quiero morir)/i.test(lower)) {
    stats.crisisActivations++;
    return DEMO_REPLIES.crisis;
  }
  return DEMO_REPLIES.default;
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje vacío" });

  const cleaned = scrubPII(message);
  stats.totalSessions++;
  stats.thisMonthSessions++;

  // Detectar idioma simple
  if (/tēnā|kia ora|whānau|aroha/i.test(message)) stats.languages.mi++;
  else if (/hola|cómo|qué|estás|gracias/i.test(message)) stats.languages.es++;
  else stats.languages.en++;

  res.json({ reply: getDemoReply(cleaned) });
});

// Stats endpoint
app.get('/stats', (req, res) => res.json(stats));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'demo', uptime: process.uptime() }));

// Rutas explícitas (redundantes pero seguras)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// 404 personalizado
app.use((req, res) => {
  res.status(404).send(`
    <html><body style="background:#040c07;color:#f0ead4;font-family:sans-serif;text-align:center;padding:80px">
      <h1 style="color:#c9973a;font-size:48px">404</h1>
      <p>Page not found.</p>
      <a href="/" style="color:#2dd4a7">← Back to NOVA</a>
    </body></html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 NOVA Demo Mode corriendo en puerto ${PORT}`));

