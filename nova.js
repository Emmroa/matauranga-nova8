// ═══════════════════════════════════════════════════════════════════════════
// shared/nova.js — Shared constants, helpers and hooks for NOVA
// Import from Landing.jsx, Chat.jsx and App.jsx
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

// ─── i18n ──────────────────────────────────────────────────────────────────
export const UI = {
  en: {
    appTitle:      'Mātauranga NOVA',
    tagline:       'A private companion for HIV-related kōrero in Aotearoa New Zealand',
    start:         'Start a conversation',
    dashboardLink: 'Dashboard',
    consentTitle:  'Before we begin',
    consentZero:   'Nothing you type is stored. Only anonymous counts — region, topic, language — are kept. Never your words.',
    consentAI:     'NOVA is an AI companion. It is NOT a doctor, nurse or therapist, and does not replace professional care.',
    consentCrisis: 'If you are in immediate danger, call 111. For 24/7 support: Lifeline 0800 543 354 or text/call 1737.',
    iAgree:        'I understand — start the chat',
    decline:       'Not now',
    languageLabel: 'Language',
    placeholder:   "Share what's on your mind…",
    send:          'Send',
    thinking:      'NOVA is thinking…',
    helpful:       'Helpful',
    notHelpful:    'Not helpful',
    newChat:       'New chat',
    thanks:        'Thanks',
    madeBy:        'Built by Emanuel Figueroa · Burnett Foundation Aotearoa · Privacy Act 2020',
  },
  es: {
    appTitle:      'Mātauranga NOVA',
    tagline:       'Un espacio privado para hablar de VIH en Aotearoa Nueva Zelanda',
    start:         'Iniciar conversación',
    dashboardLink: 'Panel',
    consentTitle:  'Antes de comenzar',
    consentZero:   'Nada de lo que escribas se guarda. Solo conteos anónimos — región, tema, idioma. Nunca tus palabras.',
    consentAI:     'NOVA es una IA. NO es médico, enfermero ni terapeuta, y no reemplaza atención profesional.',
    consentCrisis: 'Si estás en peligro inmediato, llama al 111. Apoyo 24/7: Lifeline 0800 543 354 o texto/llamada 1737.',
    iAgree:        'Entendido — comenzar el chat',
    decline:       'Ahora no',
    languageLabel: 'Idioma',
    placeholder:   'Escribe lo que quieras…',
    send:          'Enviar',
    thinking:      'NOVA está pensando…',
    helpful:       'Útil',
    notHelpful:    'No fue útil',
    newChat:       'Nuevo chat',
    thanks:        'Gracias',
    madeBy:        'Construido por Emanuel Figueroa · Burnett Foundation Aotearoa · Privacy Act 2020',
  },
  mi: {
    appTitle:      'Mātauranga NOVA',
    tagline:       'He hoa tūmataiti mō ngā kōrero HIV ki Aotearoa',
    start:         'Tīmata he kōrero',
    dashboardLink: 'Papatohu',
    consentTitle:  'I mua i te tīmatatanga',
    consentZero:   'Kāore ō kōrero e tiakina ana. Ko ngā tatauranga waitohu anake — rohe, kaupapa, reo. Kāore āu kupu.',
    consentAI:     'He atamai mimitahi a NOVA. Ehara ia i te tākuta, nēhi, kaiāwhina rānei.',
    consentCrisis: 'Mēnā kei te raru koe, waea ki te 111. Āwhina 24/7: Lifeline 0800 543 354, tuhituhi/waea 1737.',
    iAgree:        'Ae, māua — tīmata',
    decline:       'Āpōpō',
    languageLabel: 'Reo',
    placeholder:   'Tāurutia āu whakaaro…',
    send:          'Tuku',
    thinking:      'Kei te whakaaro a NOVA…',
    helpful:       'Whaihua',
    notHelpful:    'Kāore i whaihua',
    newChat:       'Kōrero hou',
    thanks:        'Tēnā rawa atu koe',
    madeBy:        'Nā Emanuel Figueroa i hanga · Burnett Foundation Aotearoa · Privacy Act 2020',
  }
};

export const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'mi', label: 'Te reo Māori' },
];

// ─── Consent / session helpers ─────────────────────────────────────────────
const CONSENT_KEY = 'nova.consent.v2';

export function loadConsent() {
  try {
    const raw = sessionStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveConsent(obj) {
  try { sessionStorage.setItem(CONSENT_KEY, JSON.stringify(obj)); } catch { /* no-op */ }
}
export function clearConsent() {
  try { sessionStorage.removeItem(CONSENT_KEY); } catch { /* no-op */ }
}
export function newSessionId() {
  return (crypto?.randomUUID) ? crypto.randomUUID()
    : 'sid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Fallback regions (if backend unreachable) ─────────────────────────────
export const FALLBACK_REGIONS = [
  { code: 'NTH', name_en: 'Northern',          name_mi: 'Te Tai Tokerau ki Tāmaki', description: 'Northland, Waitematā, Auckland, Counties Manukau' },
  { code: 'MID', name_en: 'Midland',           name_mi: 'Te Manawa Taki',           description: 'Waikato, Bay of Plenty, Tairāwhiti, Taranaki, Lakes' },
  { code: 'CEN', name_en: 'Central',           name_mi: 'Te Ikaroa',                description: "MidCentral, Whanganui, Capital & Coast, Hutt, Hawke's Bay" },
  { code: 'STH', name_en: 'Southern',          name_mi: 'Te Waipounamu',            description: 'Nelson, West Coast, Canterbury, Otago, Southland' },
  { code: 'NAT', name_en: 'Prefer not to say', name_mi: 'Kāore au e kī',            description: '' },
];

// ─── NeuralCanvas — shared plexus 3D background ────────────────────────────
export function NeuralCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const mouse = { x: -9999, y: -9999 };
    const pulses = [];
    let t = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const N = window.innerWidth < 600 ? 52 : 95;
    const DEPTH = 700;

    const nodes = Array.from({ length: N }, (_, i) => ({
      x:  (Math.random() - .5) * canvas.width  * 1.8,
      y:  (Math.random() - .5) * canvas.height * 1.8,
      z:   Math.random() * DEPTH,
      vx: (Math.random() - .5) * .28,
      vy: (Math.random() - .5) * .28,
      vz: (Math.random() - .5) * .1,
      gold:   i < N * .18,
      bright: i < N * .05,
      pulse: 0,
      r: Math.random() * 1.6 + .7,
    }));

    let tris = [];
    const buildTris = () => {
      tris = [];
      const ps = nodes.map(n => proj(n));
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = ps[i].sx - ps[j].sx, dy = ps[i].sy - ps[j].sy;
          if (Math.sqrt(dx*dx + dy*dy) < 90)
            for (let k = j + 1; k < nodes.length; k++) {
              const dx2 = ps[i].sx - ps[k].sx, dy2 = ps[i].sy - ps[k].sy;
              const dx3 = ps[j].sx - ps[k].sx, dy3 = ps[j].sy - ps[k].sy;
              if (Math.sqrt(dx2*dx2+dy2*dy2) < 90 && Math.sqrt(dx3*dx3+dy3*dy3) < 90) {
                tris.push([i, j, k]);
                if (tris.length > 80) return;
              }
            }
        }
    };
    buildTris();
    const triTimer = setInterval(buildTris, 2200);

    const onMove  = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onTouch = e => { if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }};
    const onKey   = () => {
      pulses.push({ x: mouse.x < 0 ? canvas.width / 2 : mouse.x, y: mouse.y < 0 ? canvas.height / 2 : mouse.y, r: 0, op: .42 });
      nodes.forEach(n => { if (Math.hypot(n.x, n.y) < 300) n.pulse = .8; });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('keydown',   onKey);

    const W = () => canvas.width, H = () => canvas.height;
    const LINK = 135;

    function proj(n) {
      const fov = 380, sc = fov / (fov + n.z);
      const mx = (mouse.x - W() / 2) * .012, my = (mouse.y - H() / 2) * .012;
      return { sx: W()/2 + (n.x + mx) * sc, sy: H()/2 + (n.y + my) * sc, sc };
    }

    const frame = () => {
      t += .006;
      ctx.clearRect(0, 0, W(), H());

      // Ambient glows
      [[.15, .2, 13,153,96,.07, 320], [.8, .75, 200,148,26,.055, 260]].forEach(([ax,ay,r,g,b,a,rad]) => {
        const gx = W()*ax + Math.sin(t*.28)*45, gy = H()*ay + Math.cos(t*.22)*35;
        const gr = ctx.createRadialGradient(gx,gy,0,gx,gy,rad);
        gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        gr.addColorStop(1, 'transparent');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W(), H());
      });

      const ps = nodes.map(n => proj(n));
      const order = [...Array(N).keys()].sort((a,b) => nodes[b].z - nodes[a].z);

      // Triangles
      for (const [i,j,k] of tris) {
        const pi=ps[i],pj=ps[j],pk=ps[k];
        const isGold = nodes[i].gold||nodes[j].gold||nodes[k].gold;
        const sc = (pi.sc+pj.sc+pk.sc)/3;
        ctx.beginPath(); ctx.moveTo(pi.sx,pi.sy); ctx.lineTo(pj.sx,pj.sy); ctx.lineTo(pk.sx,pk.sy); ctx.closePath();
        ctx.fillStyle = isGold ? `rgba(200,148,26,${sc*.04})` : `rgba(13,153,96,${sc*.035})`;
        ctx.fill();
      }

      // Lines
      for (let i = 0; i < N; i++)
        for (let j = i+1; j < N; j++) {
          const dx=ps[i].sx-ps[j].sx, dy=ps[i].sy-ps[j].sy, d=Math.sqrt(dx*dx+dy*dy);
          if (d < LINK) {
            const base = (1-d/LINK)*.13, pulse = Math.max(nodes[i].pulse,nodes[j].pulse)*.32;
            const isGold = nodes[i].gold||nodes[j].gold, depth = (ps[i].sc+ps[j].sc)/2;
            ctx.beginPath(); ctx.moveTo(ps[i].sx,ps[i].sy); ctx.lineTo(ps[j].sx,ps[j].sy);
            ctx.strokeStyle = isGold ? `rgba(200,148,26,${(base+pulse)*depth})` : `rgba(13,153,96,${(base+pulse*.5)*depth*.9})`;
            ctx.lineWidth = isGold ? .88 : .68; ctx.stroke();
          }
        }

      // Pulses
      for (let i = pulses.length-1; i >= 0; i--) {
        const p = pulses[i]; p.r += 3.8; p.op -= .007;
        if (p.op <= 0) { pulses.splice(i,1); continue; }
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.strokeStyle = `rgba(200,148,26,${p.op})`; ctx.lineWidth = 1.2; ctx.stroke();
      }

      // Nodes
      for (const idx of order) {
        const n = nodes[idx], p = ps[idx];
        const dx=p.sx-mouse.x, dy=p.sy-mouse.y, d2=dx*dx+dy*dy;
        if (d2 < 9000 && d2 > 0) { const d=Math.sqrt(d2), f=((95-d)/95)*.23; n.vx+=(dx/d)*f; n.vy+=(dy/d)*f; }
        if (n.gold && d2 < 35000 && d2 > 900) { const d=Math.sqrt(d2), f=.008*(1-d/185); n.vx-=(dx/d)*f; n.vy-=(dy/d)*f; }
        n.vx*=.972; n.vy*=.972; n.vz*=.985;
        const spd = Math.sqrt(n.vx*n.vx+n.vy*n.vy);
        if (spd > 1.5) { n.vx=(n.vx/spd)*1.5; n.vy=(n.vy/spd)*1.5; }
        n.pulse = Math.max(0, n.pulse-.018);
        n.x+=n.vx; n.y+=n.vy; n.z+=n.vz;
        n.z = Math.max(0, Math.min(DEPTH, n.z));
        if (Math.abs(n.x)>W()) n.x*=-1; if (Math.abs(n.y)>H()) n.y*=-1;

        const glow = n.pulse*.5 + Math.sin(t*1.8+n.x*.01)*(n.gold?.1:.05);
        const op  = (.28+n.pulse*.45+glow)*p.sc;
        const rad = (n.r+n.pulse*2)*(n.bright?1.6:1)*p.sc;

        if (n.gold||n.bright) {
          const g = ctx.createRadialGradient(p.sx,p.sy,0,p.sx,p.sy,rad*(n.bright?5:3.5));
          g.addColorStop(0, `rgba(240,188,56,${Math.min(op,1)})`);
          g.addColorStop(.4, `rgba(200,148,26,${op*.35})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.sx,p.sy,rad*(n.bright?5:3.5),0,Math.PI*2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.sx,p.sy,Math.max(.5,rad),0,Math.PI*2);
        ctx.fillStyle = (n.gold||n.bright)
          ? `rgba(240,188,56,${Math.min(op,.9)})`
          : `rgba(13,180,100,${Math.min(op*.85,.7)})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(triTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none', opacity: .7,
      }}
    />
  );
}

// ─── Depth gradient overlay ────────────────────────────────────────────────
export function DepthLayer() {
  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
      background: `
        radial-gradient(ellipse 75% 55% at 12% 12%, rgba(13,153,96,.08) 0%, transparent 55%),
        radial-gradient(ellipse 60% 50% at 88% 85%, rgba(200,148,26,.055) 0%, transparent 55%),
        radial-gradient(ellipse 120% 100% at 50% 50%, transparent 30%, rgba(1,13,3,.92) 100%)
      `,
    }} />
  );
}
