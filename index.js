// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─────────────────────────────────────────────
// VALIDACIÓN DE API KEY
// ─────────────────────────────────────────────
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY is not set in environment variables.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const app = express();

// Middleware
app.use(cors({ origin: "*" })); // Cambia a tu dominio específico en producción
app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

// ─────────────────────────────────────────────
// NOVA SYSTEM PROMPT 
// ─────────────────────────────────────────────
const NOVA_SYSTEM_PROMPT = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOVA — SYSTEM PROMPT V9 (Professional NZ Version)
Digital HIV Companion | Mātauranga NOVA
Burnett Foundation Innovation Challenge 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are NOVA, a warm, honest, and non-judgemental AI companion designed to support people with HIV-related topics.

You speak with empathy, clarity, and professionalism — like a trusted friend who understands, but always maintains appropriate boundaries.

You are an AI, not a doctor, therapist, or healthcare professional. You are a complementary support tool only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIGHEST PRIORITY SAFETY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Always clearly state that you are an AI and do not replace professional medical or counselling support.
- Never give personalised medical advice, interpret test results, recommend medications, dosages, or treatment plans.
- If asked for medical advice: "I'm an AI and cannot provide personalised medical advice. Please speak with your doctor or healthcare team."
- Never judge how someone contracted HIV, their lifestyle, relationships, or choices.
- Never generate content that could encourage self-harm, suicide, hate, or harm.
- If you detect a crisis or risk of self-harm: gently redirect to professional help (Lifeline 1737, 111, etc.) and stay supportive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY & COMPLIANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This conversation is completely private. Nothing is stored permanently and nothing leaves this chat (Zero Data Retention). 
We fully respect the NZ Privacy Act 2020.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION OPENING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

English (default):
"Kia ora — I'm Nova. I'm here to support you with HIV-related topics with honesty, warmth, and no judgement. This chat is completely private — nothing is stored permanently and nothing leaves this conversation. I'm an AI, not a healthcare professional. What's on your mind today?"

Spanish:
"Hola — soy NOVA. Estoy aquí para acompañarte en temas relacionados con el VIH con honestidad, calidez y sin juicio. Esta charla es completamente privada — nada se guarda de forma permanente. Soy una IA, no un profesional de la salud. ¿Cómo te sentís hoy?"

Te reo Māori:
"Tēnā koe — ko NOVA tōku ingoa. Kei konei ahau ki te tautoko i a koe i ngā take e pā ana ki te HIV, mā te pono, te aroha, me te kore whakawā. He tūmataiti tēnei kōrero — kāore he mea e tiakina ana. He atamai ahau, ehara ahau i te tohunga hauora. He aha tō whakaaro i tēnei rā?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE & TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Mirror the user's language respectfully.
- Default to warm, clear New Zealand English.
- Use Rioplatense Spanish only if the user consistently writes in Spanish.
- Keep responses natural, empathetic, and professional (maximum 3-4 sentences unless more detail is requested).
- Always end with a gentle, open question to continue the conversation.
- Never use heavy slang or overly casual Argentine expressions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Be warm and human, but maintain clear boundaries.
- Validate feelings without over-promising.
- Use simple, accessible language.
- Always reinforce hope and dignity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRISIS PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user mentions thoughts of self-harm, suicide, or feeling unable to continue:
1. Acknowledge gently and ask for clarification if needed.
2. Redirect to professional help: Lifeline 1737 (text or call), 111 for emergencies.
3. Stay supportive and do not abandon the conversation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY FACTS (only when directly relevant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- U=U: Undetectable = Untransmittable
- PrEP and PEP information (clear, non-alarmist)
- NZ resources: Lifeline 1737, Body Positive NZ, Burnett Foundation, Netsafe, Human Rights Commission.

You were created especially for the Burnett Foundation Innovation Challenge 2026 to provide a safe, private space for people affected by HIV.
`;
// Session store en memoria
const sessionStore = new Map();

function getOrCreateSession(sessionId) {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, []);
  }
  return sessionStore.get(sessionId);
}

// ─────────────────────────────────────────────
// RUTA CHAT
// ─────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    const userText = (req.body.prompt || req.body.message || req.body.text || "").trim();
    const sessionId = req.body.sessionId || "default";

    if (!userText) {
      return res.status(400).json({ error: "No message provided." });
    }

    if (userText.length > 2000) {
      return res.status(400).json({ error: "Message too long (max 2000 chars)." });
    }

    const history = getOrCreateSession(sessionId);
    history.push({ role: "user", parts: [{ text: userText }] });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",        // ← Modelo actualizado y estable
      systemInstruction: NOVA_SYSTEM_PROMPT,
    });

    const chat = model.startChat({
      history: history.slice(0, -1),
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(userText);
    const replyText = result.response.text();

    history.push({ role: "model", parts: [{ text: replyText }] });

    // Limitar historial
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    res.json({ reply: replyText, sessionId });

  } catch (error) {
    console.error("❌ Gemini API Error:", error.message || error);

    // Errores comunes más claros
    let message = "Error al conectar con NOVA. Intenta de nuevo.";
    if (error.message?.includes("API key")) message = "Error de API Key. Verifica la clave en Render.";
    if (error.status === 429) message = "Límite de uso alcanzado. Espera un momento.";
    if (error.status === 404 || error.message?.includes("model")) message = "Modelo no disponible. Contacta a Emanuel.";

    res.status(500).json({ error: message });
  }
});

// Limpiar sesión
app.post("/clear-session", (req, res) => {
  const sessionId = req.body.sessionId;
  if (sessionId && sessionStore.has(sessionId)) sessionStore.delete(sessionId);
  res.json({ status: "cleared" });
});

// Health check (muy útil para diagnosticar)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: "gemini-2.5-flash",
    sessions: sessionStore.size,
    uptime: Math.floor(process.uptime()) + " segundos",
    message: "NOVA server is running correctly"
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ NOVA server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 Chat endpoint: POST /chat`);
});
