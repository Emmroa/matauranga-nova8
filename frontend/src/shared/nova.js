// ═══════════════════════════════════════════════════════════════════════════
// nova.js — NOVA shared utilities (plain JS/ES module, no JSX)
// NeuralCanvas · DepthLayer · i18n UI · consent helpers
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useEffect } from 'react';

// ─── Consent (sessionStorage — cleared on tab close) ──────────────────────
const KEY = 'nova_consent_v2';

export function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function loadConsent() {
  try { const r = sessionStorage.getItem(KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

export function saveConsent(p) {
  try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
}

export function clearConsent() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

// ─── i18n ──────────────────────────────────────────────────────────────────
export const UI = {
  en: {
    appTitle:      'Mātauranga NOVA',
    tagline:       'A private companion for HIV in Aotearoa New Zealand',
    start:         'Start a conversation',
    dashboardLink: 'Dashboard',
    newChat:       'New chat',
    consentTitle:  'Before we begin',
    consentZero:   'Nothing you type is stored. Only anonymous counters — region, topic, language. Never your words.',
    consentAI:     'NOVA is an AI companion built by Emanuel Figueroa. It is NOT a doctor, nurse or therapist, and does not replace professional care.',
    consentCrisis: 'If you are in immediate danger, please call 111. For 24/7 support: Lifeline 0800 543 354 or text/call 1737.',
    iAgree:        'I understand — start the chat',
    decline:       'Not now',
    placeholder:   "Share what's on your mind…",
    thanks:        'Thanks for the signal.',
  },
  es: {
    appTitle:      'Mātauranga NOVA',
    tagline:       'Un acompañante privado para conversar sobre VIH en Aotearoa',
    start:         'Iniciar conversación',
    dashboardLink: 'Panel de control',
    newChat:       'Nueva charla',
    consentTitle:  'Antes de comenzar',
    consentZero:   'Nada de lo que escribís se guarda. Solo contadores anónimos — región, tema, idioma. Nunca tus palabras.',
    consentAI:     'NOVA es una IA companion creada por Emanuel Figueroa. NO es médica, enfermera ni terapeuta, y no reemplaza la atención profesional.',
    consentCrisis: 'Si estás en peligro inmediato, llamá al 111. Apoyo 24/7: Lifeline 0800 543 354 o mensaje/llamada al 1737.',
    iAgree:        'Entiendo — iniciar chat',
    decline:       'Ahora no',
    placeholder:   '¿Qué te pasa?',
    thanks:        'Gracias por el feedback.',
  },
  mi: {
    appTitle:      'Mātauranga NOVA',
    tagline:       'He hoa kōrero tūmataiti mō te HIV i Aotearoa',
    start:         'Tīmata kōrero',
    dashboardLink: 'Papatohu',
    newChat:       'Kōrero hou',
    consentTitle:  'I mua i te tīmata',
    consentZero:   'Kāore he mea e tiakina ana o ō kupu. Ko ngā tatauranga muna anake e puritia ana.',
    consentAI:     'He atamai mimitahi a NOVA nā Emanuel Figueroa. EHARA ia i te tākuta, i te nēhi, i te kaiāwhina.',
    consentCrisis: 'Mēnā he taumaha, tēnā waea ki te 111. Mō te tautoko 24/7: Lifeline 0800 543 354, kuputuhi rānei ki 1737.',
    iAgree:        'Āe — tīmatahia te kōrero',
    decline:       'Kaore i tēnei wā',
    placeholder:   'He aha tō whakaaro…',
    thanks:        'Ngā mihi.',
  },
};

export const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'mi', label: 'Te Reo' },
  { code: 'es', label: 'Español' },
];

// ═══════════════════════════════════════════════════════════════════════════
// NeuralCanvas — 3D animated plexus (green neurons · gold synapses)
// Written with React.createElement to avoid JSX in a .js module.
// ═══════════════════════════════════════════════════════════════════════════
export function NeuralCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = window.innerWidth;
    let H = window.innerHeight;
    let mx = W / 2;
    let my = H / 2;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();

    const onMouse = (e) => { mx = e.clientX; my = e.clientY; };
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);

    const FOCAL   = 900;
    const N       = 72;
    const MAX_D   = 370;
    const MAX_DSQ = MAX_D * MAX_D;

    const nodes = Array.from({ length: N }, () => ({
      x:  (Math.random() - 0.5) * 1800,
      y:  (Math.random() - 0.5) * 1300,
      z:  Math.random() * 650 + 100,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.28,
      vz: (Math.random() - 0.5) * 0.18,
      gold: Math.random() < 0.28,
    }));

    const proj = (x, y, z) => {
      const s = FOCAL / (FOCAL + z);
      return { px: W / 2 + x * s, py: H / 2 + y * s, s };
    };

    let raf;
    let lastT = 0;

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const dt  = Math.min(t - lastT, 40);
      lastT = t;
      const spd = dt / 16;

      ctx.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx * spd;
        n.y += n.vy * spd;
        n.z += n.vz * spd;
        if (n.x < -820 || n.x > 820) n.vx *= -1;
        if (n.y < -630 || n.y > 630) n.vy *= -1;
        if (n.z < 80   || n.z > 760) n.vz *= -1;

        const dMx = mx - W / 2 - n.x * 0.14;
        const dMy = my - H / 2 - n.y * 0.14;
        const mDist = Math.sqrt(dMx * dMx + dMy * dMy);
        if (mDist < 380) {
          n.vx += dMx * 0.000028 * spd;
          n.vy += dMy * 0.000028 * spd;
        }
        n.vx *= 0.99985;
        n.vy *= 0.99985;
      }

      // Edges
      for (let i = 0; i < N; i++) {
        const a = nodes[i];
        const { px: ax, py: ay, s: as } = proj(a.x, a.y, a.z);
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          const dsq = dx * dx + dy * dy + dz * dz;
          if (dsq > MAX_DSQ) continue;
          const { px: bx, py: by, s: bs } = proj(b.x, b.y, b.z);
          const scl   = Math.min(as, bs);
          const ratio = 1 - Math.sqrt(dsq) / MAX_D;
          const alpha = ratio * 0.52 * Math.min(scl * 2.2, 1);
          const isGold = a.gold || b.gold;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = isGold
            ? `rgba(200,148,26,${Math.min(alpha * 0.88, 0.52)})`
            : `rgba(16,185,129,${Math.min(alpha * 0.82, 0.44)})`;
          ctx.lineWidth = Math.max(0.25, scl * 0.75);
          ctx.stroke();
        }
      }

      // Nodes
      for (const n of nodes) {
        const { px, py, s } = proj(n.x, n.y, n.z);
        const r   = Math.max(0.7, s * 2.9);
        const a   = Math.min(0.94, s * 2.4);
        const rgb = n.gold ? '200,148,26' : '16,185,129';

        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3.8);
        g.addColorStop(0, `rgba(${rgb},${a * 0.32})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.beginPath();
        ctx.arc(px, py, r * 3.8, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return React.createElement('canvas', {
    ref,
    style: {
      position:      'fixed',
      inset:         0,
      width:         '100%',
      height:        '100%',
      pointerEvents: 'none',
      zIndex:        0,
      opacity:       0.68,
    },
  });
}

// ─── Depth vignette ────────────────────────────────────────────────────────
export function DepthLayer() {
  return React.createElement('div', {
    'aria-hidden': 'true',
    style: {
      position:      'fixed',
      inset:         0,
      zIndex:        1,
      pointerEvents: 'none',
      background: [
        'radial-gradient(ellipse 80% 55% at 50% 100%, rgba(1,13,3,.75) 0%, transparent 58%)',
        'radial-gradient(ellipse 65% 45% at 50% 0%,   rgba(1,13,3,.52) 0%, transparent 52%)',
        'radial-gradient(ellipse 50% 80% at 0%   50%, rgba(1,13,3,.28) 0%, transparent 55%)',
        'radial-gradient(ellipse 50% 80% at 100% 50%, rgba(1,13,3,.28) 0%, transparent 55%)',
      ].join(', '),
    },
  });
}
