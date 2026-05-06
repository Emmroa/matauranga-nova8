const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

dotenv.config();
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// L1: PRIVACIDAD
const scrubPII = (text) => {
    return text.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/gi, '[EMAIL-OCULTO]')
               .replace(/\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4,}\b/g, '[TEL-OCULTO]');
};

// L5: DETECCIÓN DE CRISIS
const checkCrisis = (text) => {
    const triggers = ['suicid', 'morir', 'matar', 'hacerme daño', 'ayuda urgente', 'lastimarme', 'quitarme la vida'];
    return triggers.some(word => text.toLowerCase().includes(word));
};

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const safeMessage = scrubPII(message);
    
    if (checkCrisis(safeMessage)) {
        return res.json({ 
            response: `🚨 <strong>Kia ora. Parece que estás pasando por un momento difícil.</strong><br><br>` +
                      `Por favor, habla con alguien ahora mismo:<br>` +
                      `• <a href="tel:0800543354" style="color: #10b981; font-weight: bold; text-decoration: underline;">Llamar a Lifeline (0800 543 354)</a><br>` +
                      `• <a href="sms:1737" style="color: #10b981; font-weight: bold; text-decoration: underline;">Enviar texto al 1737</a><br><br>` +
                      `No estás solo.` 
        });
    }

    try {
        const response = await fetch(`http://127.0.0.1:11434/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3:latest',
                prompt: `Eres NOVA, un amigo de Aotearoa. Sé MUY breve (1-2 oraciones). Si el usuario está triste, sé empático. Si está normal, sé relajado y usa "Kia ora" o "Mate". No hables de salud sexual a menos que te pregunten. Usuario: ${safeMessage}`,
                stream: false,
                options: { num_predict: 80, temperature: 0.7 }
            })
        });
        const data = await response.json();
        res.json({ response: data.response });
    } catch (error) {
        res.status(500).json({ response: "¡Ups! Mi conexión parpadeó un segundo. ¿Me repites eso?" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 NOVA v9.3 (SafeLinks) Activa en puerto ${PORT}`);
});

