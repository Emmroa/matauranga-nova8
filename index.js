// ─────────────────────────────────────────────────────────
// MĀTAURANGA NOVA — Backend (index.js)
// Servidor Express + Gemini 1.5 Flash
// ─────────────────────────────────────────────────────────

// 1. Cargar variables de entorno PRIMERO (antes de todo lo demás)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Validación de API Key al arrancar ──────────────────────
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ ERROR CRÍTICO: GOOGLE_API_KEY no está definida en el archivo .env");
  console.error("   Crea un archivo .env con: GOOGLE_API_KEY=tu_clave_aqui");
  process.exit(1); // Detener el servidor si no hay clave
}

// ── Inicializar cliente de Gemini ──────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  // Instrucciones de sistema para darle personalidad a Nova
  systemInstruction: `Eres Nova, una tutora de IA amigable, clara y alentadora del ecosistema educativo Mātauranga Nova.
Tu rol es ayudar a estudiantes a aprender, resolver dudas y explorar conceptos de forma accesible.
Responde siempre en el mismo idioma que el usuario (español o inglés).
Sé concisa, empática y usa ejemplos concretos cuando sea útil.
Nunca inventes información; si no sabes algo, dilo con honestidad.`,
});

// ── Configurar Express ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Parsea JSON en el body de las requests
app.use(express.static(path.join(__dirname, "public"))); // Sirve el frontend

// ─────────────────────────────────────────────────────────
// ENDPOINT PRINCIPAL: POST /chat
// Recibe: { prompt: "texto del usuario" }
// Devuelve: { reply: "respuesta de Nova" }
// ─────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  // Extraer y validar el prompt
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({
      error: "El campo 'prompt' es requerido y no puede estar vacío.",
    });
  }

  try {
    console.log(`📨 Prompt recibido: "${prompt.trim().substring(0, 80)}..."`);

    // Llamar a la API de Gemini
    const result = await model.generateContent(prompt.trim());

    // Extraer el texto de forma segura (evita undefined)
    const responseText =
      result?.response?.text?.() ??
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      null;

    // Si Gemini no devolvió texto legible
    if (!responseText) {
      console.warn("⚠️  Gemini devolvió una respuesta vacía o sin texto.");
      return res.status(502).json({
        error: "El modelo de IA no generó una respuesta en este momento. Intenta de nuevo.",
      });
    }

    console.log(`✅ Respuesta generada (${responseText.length} caracteres)`);

    // Respuesta limpia al frontend
    res.json({ reply: responseText });

  } catch (error) {
    // Manejo detallado de errores de la API de Google
    console.error("❌ Error al llamar a la API de Gemini:", error.message);

    // Diferenciar tipos de error para dar mensajes útiles
    if (error.message?.includes("API_KEY_INVALID")) {
      return res.status(401).json({
        error: "La API Key de Google no es válida. Verifica tu archivo .env.",
      });
    }
    if (error.message?.includes("QUOTA_EXCEEDED") || error.status === 429) {
      return res.status(429).json({
        error: "Se superó el límite de uso de la API. Intenta en unos minutos.",
      });
    }

    // Error genérico (no expone detalles internos al cliente)
    res.status(500).json({
      error: "Error interno del servidor. Por favor intenta de nuevo.",
    });
  }
});

// ── Ruta de salud (útil para verificar que el servidor corre) ──
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Mātauranga Nova API",
    model: "gemini-1.5-flash",
    timestamp: new Date().toISOString(),
  });
});

// ── Iniciar servidor ───────────────────────────────────────
app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✨ Mātauranga Nova — Servidor activo`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🤖 Modelo: gemini-1.5-flash`);
  console.log(`💬 Chat endpoint: POST http://localhost:${PORT}/chat`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
