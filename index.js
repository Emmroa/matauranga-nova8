require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Demasiados mensajes. Espera un momento." }
});
app.use('/chat', limiter);

// Stats para el dashboard (sigue funcionando)
let stats = {
  totalSessions: 0,
  thisMonthSessions: 0,
  languages: { en: 0, es: 0, mi: 0 },
  crisisActivations: 0
};

// Scrubbing
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REMOVIDO]')
    .replace(/\b(?:0[0-9]{1,2}[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{3,4}\b/g, '[TELÉFONO REMOVIDO]');
}

// Mensaje demo cuando no hay crédito en Gemini
const DEMO_REPLY = "Kia ora. Este es un prototipo para el Burnett Foundation Innovation Challenge 2026. El chat completo con IA está temporalmente limitado por cuota de API. En la versión final con funding, NOVA responderá en tiempo real con privacidad total y detección de los 7 moments. ¿Quieres que te muestre cómo funcionaría el flujo completo?";

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje vacío" });

  const cleaned = scrubPII(message);
  stats.totalSessions++;
  stats.thisMonthSessions++;

  // Respuesta demo (sin gastar crédito)
  res.json({ reply: DEMO_REPLY });
});

// Stats endpoint (funciona para el dashboard)
app.get('/stats', (req, res) => res.json(stats));

// Servir las páginas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 NOVA Demo Mode corriendo en puerto ${PORT}`));
