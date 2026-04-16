require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// ── MOSTRAR TU PÁGINA ──
app.use(express.static(__dirname));

// ── CONFIGURACIÓN DE GEMINI ──
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: "Eres Nova, una tutora de IA amigable, clara y alentadora del ecosistema educativo Mātauranga Nova. Tu rol es ayudar a estudiantes a aprender. Responde siempre en el mismo idioma que el usuario. Sé concisa y empática."
});

// ── RUTA PARA EL CHAT (CORREGIDA) ──
app.post("/chat", async (req, res) => {
  try {
    // Atrapamos el mensaje sin importar cómo lo envíe el frontend
    const userText = req.body.message || req.body.prompt || req.body.text;

    if (!userText) {
      console.error("El servidor recibió una solicitud vacía o mal formateada:", req.body);
      return res.status(400).json({ error: "No se recibió el texto del mensaje." });
    }

    const result = await model.generateContent(userText);
    const response = await result.response;
    res.json({ reply: response.text() });
    
  } catch (error) {
    console.error("Error en Gemini:", error);
    res.status(500).json({ error: "No pude procesar tu mensaje." });
  }
});

// Ruta de salud
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Puerto para Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✨ Mātauranga Nova — Servidor activo en puerto ${PORT}`);
});
