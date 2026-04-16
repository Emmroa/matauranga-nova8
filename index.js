require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

// Stats para el dashboard
let stats = {
  totalSessions: 0,
  thisMonthSessions: 0,
  languages: { en: 0, es: 0, mi: 0 },
  crisisActivations: 0
};

// Data Scrubbing
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REMOVIDO]')
    .replace(/\b(?:0[0-9]{1,2}[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{3,4}\b/g, '[TELÉFONO REMOVIDO]');
}

// System Prompt
const SYSTEM_PROMPT = `Eres NOVA, un compañero cálido y honesto para personas con HIV en Aotearoa Nueva Zelanda. 
Hablas con empatía pero sin juicio. Eres una IA, no un médico ni terapeuta. 
Esta conversación es 100% privada — nada se guarda permanentemente.
Responde siempre en el idioma del usuario. Sé natural y útil.`;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Chat
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje vacío" });

  const cleaned = scrubPII(message);
  stats.totalSessions++;
  stats.thisMonthSessions++;

  try {
    const result = await model.generateContent(cleaned);
    const reply = result.response.text();
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Lo siento, hubo un error. Inténtalo de nuevo." });
  }
});

// Stats endpoint
app.get('/stats', (req, res) => res.json(stats));

// Servir las páginas HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 NOVA corriendo en puerto ${PORT}`));
