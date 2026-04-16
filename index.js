require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// 1. MUESTRA TU ARCHIVO HTML SIN IMPORTAR DÓNDE ESTÉ
app.use(express.static(__dirname));

// 2. CONFIGURACIÓN CORRECTA DE GEMINI (Sin el "-latest")
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: "Eres Nova, una tutora de IA amigable, clara y alentadora del ecosistema educativo Mātauranga Nova. Tu rol es ayudar a estudiantes a aprender. Responde siempre en el mismo idioma que el usuario. Sé concisa y empática."
});

// 3. RUTA DEL CHAT (A prueba de errores)
app.post("/chat", async (req, res) => {
  try {
    // Atrapa el texto sin importar cómo lo envíe tu HTML
    const userText = req.body.prompt || req.body.message || req.body.text;

    if (!userText || typeof userText !== "string" || userText.trim() === "") {
      console.error("Mensaje vacío recibido del frontend");
      return res.status(400).json({ error: "No se recibió texto." });
    }

    const result = await model.generateContent(userText.trim());
    const responseText = result?.response?.text?.() || "Sin respuesta";
    
    res.json({ reply: responseText });
    
  } catch (error) {
    console.error("Error en Gemini:", error.message);
    res.status(500).json({ error: "No pude procesar tu mensaje." });
  }
});

// Ruta de salud
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 4. CONFIGURACIÓN DEL PUERTO PARA RENDER
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✨ Mātauranga Nova — Servidor activo en puerto ${PORT}`);
});
