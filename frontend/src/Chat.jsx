// ═══════════════════════════════════════════════════════════════════════════
// Chat.jsx — NOVA Private Chat Interface
// Claude.ai-style centered layout · SSE streaming · 2026
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UI, LANG_OPTIONS, NeuralCanvas, DepthLayer } from './shared/nova.js';

// ─── Keyframes ────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Outfit:wght@200;300;400;500;600&display=swap');
  @keyframes nova-breathe    { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.14);opacity:.2} }
  @keyframes nova-glow       { 0%,100%{box-shadow:0 0 20px rgba(200,148,26,.32),0 0 40px rgba(13,153,96,.16)} 50%{box-shadow:0 0 32px rgba(200,148,26,.5),0 0 60px rgba(13,153,96,.24)} }
  @keyframes nova-fadein     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes nova-from-left  { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes nova-from-right { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes nova-notice-in  { from{opacity:0;transform:translateY(-6px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes nova-pulse-ring { 0%,100%{transform:scale(.94);opacity:.6} 50%{transform:scale(1.07);opacity:.2} }
  @keyframes nova-cursor     { 0%,100%{opacity:.15} 50%{opacity:.85} }
  @keyframes nova-star-pulse { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.18);opacity:1} }
  @keyframes nova-bubble-in  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .msg-user { animation: nova-from-right .26s cubic-bezier(.34,1.56,.64,1) both }
  .msg-ai   { animation: nova-from-left  .26s cubic-bezier(.34,1.56,.64,1) both }
`;

// ─── Mini neural canvas — 40×40, matches background NeuralCanvas aesthetic ─
function MiniNeuralCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 40, H = 40;

    // 7 nodes: input(2) → hidden(3) → output(2)
    const nodes = [
      { x: 7,  y: 14, gold: false },
      { x: 7,  y: 26, gold: false },
      { x: 20, y: 7,  gold: true  },
      { x: 20, y: 20, gold: false },
      { x: 20, y: 33, gold: true  },
      { x: 33, y: 14, gold: false },
      { x: 33, y: 26, gold: true  },
    ];
    const edges = [
      [0,2],[0,3],[0,4],
      [1,2],[1,3],[1,4],
      [2,5],[2,6],
      [3,5],[3,6],
      [4,5],[4,6],
    ];
    // One particle per edge, staggered start positions
    const particles = edges.map(([from, to], i) => ({
      from, to,
      t: (i / edges.length),
      speed: 0.006 + Math.random() * 0.005,
    }));

    let raf, time = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      time += 0.022;
      ctx.clearRect(0, 0, W, H);

      // Edges
      for (const [fi, ti] of edges) {
        const a = nodes[fi], b = nodes[ti];
        const isGold = a.gold || b.gold;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isGold
          ? 'rgba(200,148,26,0.2)'
          : 'rgba(13,153,96,0.2)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      // Flowing particles along edges
      for (const p of particles) {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;
        const a = nodes[p.from], b = nodes[p.to];
        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;
        const isGold = nodes[p.from].gold || nodes[p.to].gold;
        const rgb = isGold ? '200,148,26' : '13,153,96';
        const g = ctx.createRadialGradient(px, py, 0, px, py, 3);
        g.addColorStop(0, `rgba(${rgb},0.95)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Nodes — pulse in phase with time
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = 0.55 + 0.45 * Math.sin(time + i * 0.9);
        const rgb = n.gold ? '200,148,26' : '13,153,96';
        const r = 2.0;
        // Glow halo
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.5);
        g.addColorStop(0, `rgba(${rgb},${0.3 * pulse})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        // Core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${0.65 + 0.35 * pulse})`;
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={40} height={40} style={{ display: 'block', flexShrink: 0 }} />;
}

// ─── Thinking indicator — neural canvas + italic label, no bubble ───────────
function ThinkingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', animation: 'nova-from-left .26s cubic-bezier(.34,1.56,.64,1) both' }}>
      <MiniNeuralCanvas />
      <span style={{ color: 'rgba(13,153,96,.58)', fontStyle: 'italic', fontSize: 13, fontFamily: "'Outfit', sans-serif", letterSpacing: '.01em' }}>
        Nova is thinking…
      </span>
    </div>
  );
}

// ─── Nova chat avatar — static star, response state ────────────────────────
function NovaAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0a3d20,#051a0e)',
      border: '1px solid rgba(13,153,96,.32)',
      boxShadow: '0 2px 12px rgba(0,0,0,.45), 0 0 10px rgba(200,148,26,.15)',
    }}>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="#c8941a" style={{ display: 'block' }}>
        <path d="M12 2L9.09 9.09 2 12l7.09 2.91L12 22l2.91-7.09L22 12l-7.09-2.91L12 2z"/>
      </svg>
    </div>
  );
}

// ─── Opening greeting ──────────────────────────────────────────────────────
function getWelcomeMsg(lang) {
  const text =
    lang === 'es' ? 'Hola — ¿cómo estás?' :
    lang === 'mi' ? 'Tēnā koe — kei te pēhea koe?' :
                    'Hey — how are you doing?';
  return { id: 'welcome', role: 'assistant', text };
}

// ─── PulseMark ─────────────────────────────────────────────────────────────
function PulseMark({ size = 36 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: '1px solid rgba(200,148,26,.28)', animation: 'nova-pulse-ring 3.2s ease-in-out infinite' }} />
      <div style={{ width: size, height: size, borderRadius: Math.round(size * .3), background: 'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: size * .5, fontWeight: 400, color: '#010d03', animation: 'nova-glow 4s ease-in-out infinite', position: 'relative', zIndex: 1 }}>N</div>
    </div>
  );
}

// ─── Consent modal (for direct /chat URL access) ───────────────────────────
function ChatConsentModal({ lang, setLang, onConsent, onDecline }) {
  const t = UI[lang] || UI.en;
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(1,13,3,.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 400,
        background: 'linear-gradient(155deg,rgba(6,24,11,.78),rgba(4,18,8,.68))',
        backdropFilter: 'blur(64px) saturate(210%) brightness(1.1)',
        WebkitBackdropFilter: 'blur(64px) saturate(210%) brightness(1.1)',
        border: '1px solid rgba(200,148,26,.22)',
        boxShadow: 'inset 0 2px 0 rgba(240,180,41,.2),0 40px 100px rgba(0,0,0,.65)',
        borderRadius: 24, padding: '28px 26px 22px',
        animation: 'nova-fadein .45s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <PulseMark size={38} />
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 400, color: '#dff0e1' }}>{t.consentTitle}</span>
          </div>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{ background: 'rgba(2,16,7,.7)', border: '1px solid rgba(13,153,96,.2)', color: 'rgba(223,240,225,.7)', borderRadius: 8, padding: '5px 9px', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        {[
          { bg: 'rgba(13,153,96,.08)',  border: 'rgba(13,153,96,.2)',  tc: 'rgba(30,220,130,.9)',  icon: '🛡', title: 'Zero Data Retention',    body: t.consentZero   },
          { bg: 'rgba(200,148,26,.07)', border: 'rgba(200,148,26,.2)', tc: 'rgba(240,188,56,.9)',  icon: '◈',  title: 'AI — not a professional', body: t.consentAI     },
          { bg: 'rgba(220,60,60,.07)',  border: 'rgba(220,60,60,.18)', tc: 'rgba(248,110,110,.9)', icon: '◉',  title: 'Crisis support',           body: t.consentCrisis },
        ].map(({ bg, border, tc, icon, title, body }) => (
          <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 14px', borderRadius: 12, background: bg, border: `1px solid ${border}`, marginBottom: 10 }}>
            <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: tc, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'rgba(223,240,225,.52)', lineHeight: 1.5 }}>{body}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onDecline}
            style={{ flex: 1, padding: 11, borderRadius: 11, fontSize: 13, background: 'transparent', border: '1px solid rgba(200,148,26,.2)', color: 'rgba(223,240,225,.52)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {t.decline}
          </button>
          <button onClick={() => onConsent({ regionCode: 'NAT', language: lang })}
            style={{ flex: 2, padding: 11, borderRadius: 11, fontSize: 13, fontWeight: 500, background: 'linear-gradient(135deg,rgba(13,153,96,.9),rgba(200,148,26,.85))', border: 'none', color: '#010d03', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {t.iAgree}
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(223,240,225,.2)', marginTop: 14, fontFamily: 'monospace' }}>
          NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga
        </p>
      </div>
    </div>
  );
}

// ─── Disclaimer gate (sessionStorage — once per session) ──────────────────
const DISCLAIMER_KEY = 'nova_disclaimer_v1';

function DisclaimerGate({ onAccept }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Safety disclaimer"
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(1,13,3,.97)' }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(155deg,rgba(6,24,11,.95),rgba(4,18,8,.92))',
        backdropFilter: 'blur(64px) saturate(210%)',
        WebkitBackdropFilter: 'blur(64px) saturate(210%)',
        border: '1px solid rgba(200,148,26,.24)',
        boxShadow: 'inset 0 2px 0 rgba(240,180,41,.2),0 40px 100px rgba(0,0,0,.75)',
        borderRadius: 24, padding: '32px 28px 26px',
        animation: 'nova-fadein .45s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <PulseMark size={38} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 300, color: '#dff0e1', letterSpacing: '.01em' }}>
            Before you begin
          </span>
        </div>

        <p style={{ fontSize: 14.5, color: '#dff0e1', lineHeight: 1.65, margin: '0 0 18px', fontWeight: 400 }}>
          NOVA is an AI companion, not a medical or mental health service.
        </p>

        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(220,60,60,.08)', border: '1px solid rgba(220,60,60,.24)', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(248,110,110,.75)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 10 }}>
            If you are in crisis right now, please contact:
          </div>
          {[
            { label: '111',      detail: 'Emergency' },
            { label: '1737',     detail: 'Free call or text, 24/7' },
            { label: 'Lifeline', detail: '0800 543 354' },
          ].map(({ label, detail }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(248,110,110,.9)', minWidth: 64, fontFamily: "'Outfit', monospace" }}>
                • {label}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(248,110,110,.6)' }}>— {detail}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12.5, color: 'rgba(223,240,225,.45)', lineHeight: 1.6, margin: '0 0 24px' }}>
          By continuing you understand that NOVA is an AI and may make mistakes. Nothing you type is stored or shared.
        </p>

        <button onClick={onAccept}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', letterSpacing: '.01em',
            background: 'linear-gradient(135deg,rgba(13,153,96,.9),rgba(200,148,26,.85))',
            color: '#010d03', fontFamily: "'Outfit', sans-serif",
          }}>
          I understand — Start chat
        </button>
      </div>
    </div>
  );
}

// ─── Style constants ────────────────────────────────────────────────────────
const glassHeader = {
  background: 'linear-gradient(180deg,rgba(2,18,8,.88) 0%,rgba(1,13,5,.7) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  borderBottom: '1px solid rgba(13,153,96,.14)',
};
const glassInput = {
  background: 'linear-gradient(145deg,rgba(3,20,9,.78),rgba(2,15,7,.68))',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid rgba(13,153,96,.22)',
  boxShadow: 'inset 0 1.5px 0 rgba(13,153,96,.1),0 8px 28px rgba(0,0,0,.5)',
  borderRadius: 20,
  transition: 'border-color .22s, box-shadow .22s',
};
const bubbleAI = {
  background: 'linear-gradient(160deg,rgba(5,24,12,.92),rgba(3,16,8,.88))',
  border: '1px solid rgba(13,153,96,.18)',
  borderLeft: '2px solid rgba(13,153,96,.5)',
  boxShadow: '0 4px 20px rgba(0,0,0,.45)',
  borderRadius: '4px 18px 18px 18px',
  animation: 'nova-bubble-in .22s ease both',
};
const bubbleUser = {
  background: 'linear-gradient(160deg,rgba(8,34,17,.92),rgba(5,26,12,.88))',
  border: '1px solid rgba(200,148,26,.22)',
  boxShadow: '0 4px 20px rgba(0,0,0,.45)',
  borderRadius: '18px 18px 18px 4px',
};

// ─── Chat ──────────────────────────────────────────────────────────────────
export default function Chat({ lang, setLang, consent, onConsent, onDecline }) {
  const t = UI[lang] || UI.en;
  const navigate = useNavigate();
  const [disclaimerDone, setDisclaimerDone] = useState(() => {
    try { return !!sessionStorage.getItem(DISCLAIMER_KEY); } catch { return false; }
  });
  const [messages, setMessages]     = useState(() => [getWelcomeMsg(lang)]);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const abortRef = useRef(null);
  const msgsRef  = useRef(null);
  const taRef    = useRef(null);

  const acceptDisclaimer = useCallback(() => {
    try { sessionStorage.setItem(DISCLAIMER_KEY, '1'); } catch { /* noop */ }
    setDisclaimerDone(true);
  }, []);

  const scrollBottom = useCallback(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
  }, []);
  useEffect(scrollBottom, [messages, scrollBottom]);

  const resizeTa = () => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 140) + 'px';
  };

  const newChat = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setMessages([getWelcomeMsg(lang)]); setInput(''); setSending(false); setNoticeOpen(true);
  };

  // ── SSE send ──────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !consent) return;

    const uid = `u-${Date.now()}`;
    const aid = `a-${Date.now()}`;

    setMessages(m => [...m, { id: uid, role: 'user', text: trimmed }]);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setSending(true);
    setMessages(m => [...m, { id: aid, role: 'assistant', text: '', streaming: true }]);

    const history = messages
      .filter(x => !x.streaming && x.text && x.id !== 'welcome')
      .slice(-10)
      .map(x => ({ role: x.role, content: x.text }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-Session-Id': consent.sessionId,
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId: consent.sessionId,
          regionCode: consent.regionCode || 'NAT',
          consent: true,
          history,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('ReadableStream not available');

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf = '', crisis = false, crisisText = '';

      const dispatch = (frame) => {
        if (!frame.trim()) return;
        let evt = 'message';
        const dataLines = [];
        for (const raw of frame.split('\n')) {
          const line = raw.trimEnd();
          if (line.startsWith('event:')) {
            evt = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
        if (!dataLines.length) return;
        let payload;
        try { payload = JSON.parse(dataLines.join('\n')); } catch { return; }

        switch (evt) {
          case 'meta':
            if (payload.crisis) crisis = true;
            break;
          case 'crisis_resources':
            crisisText = payload.text || '';
            break;
          case 'token':
            setMessages(m => m.map(x => x.id === aid
              ? { ...x, text: (x.text || '') + (payload.t || '') }
              : x));
            break;
          case 'fallback':
            setMessages(m => m.map(x => x.id === aid
              ? { ...x, text: payload.text, fallback: true }
              : x));
            break;
          case 'done':
            setMessages(m => m.map(x => x.id === aid
              ? { ...x, streaming: false, crisis, crisisText: crisisText || null }
              : x));
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split(/\r?\n\r?\n/);
        buf = frames.pop() ?? '';
        for (const frame of frames) dispatch(frame);
      }
      if (buf.trim()) dispatch(buf);

    } catch (e) {
      if (e.name === 'AbortError') return;
      const errMsg =
        lang === 'es' ? 'Algo falló. Tu mensaje no se guardó. Intentá de nuevo.' :
        lang === 'mi' ? 'He raru. Kāore tō kōrero i tiakina. Tēnā whakamātau anō.' :
        "Something went wrong. Your message wasn't stored anywhere. Please try again.";
      setMessages(m => m.map(x => x.id === aid
        ? { ...x, streaming: false, text: x.text || errMsg, error: true }
        : x));
    } finally {
      setSending(false);
      abortRef.current = null;
      setMessages(m => m.map(x => x.id === aid && x.streaming
        ? { ...x, streaming: false }
        : x));
    }
  }, [input, sending, consent, messages, lang]);

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const sendFeedback = async (messageId, rating) => {
    if (!consent) return;
    setMessages(m => m.map(x => x.id === messageId ? { ...x, feedback: rating } : x));
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: consent.sessionId, regionCode: consent.regionCode || 'NAT', rating }),
      });
    } catch { /* fire-and-forget */ }
  };

  // Notice shows until user sends their first message
  const showNotice = noticeOpen && !messages.some(m => m.role === 'user');

  if (!disclaimerDone) {
    return (
      <div style={{ height: '100vh', background: '#010d03', position: 'relative', overflow: 'hidden' }}>
        <style>{KEYFRAMES}</style>
        <NeuralCanvas />
        <DepthLayer />
        <DisclaimerGate onAccept={acceptDisclaimer} />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#010d03', fontFamily: "'Outfit', system-ui, sans-serif", color: '#dff0e1', position: 'relative', overflow: 'hidden' }}>
      <style>{KEYFRAMES}</style>
      <NeuralCanvas />
      <DepthLayer />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{ ...glassHeader, position: 'relative', zIndex: 20, flexShrink: 0 }}>
        <div style={{ maxWidth: 750, margin: '0 auto', padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: '#dff0e1' }}>
            <PulseMark size={34} />
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 300, letterSpacing: '.02em' }}>
                Mātauranga <span style={{ color: 'rgba(200,148,26,.88)' }}>NOVA</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(223,240,225,.36)', letterSpacing: '.04em' }}>Private · Zero data retention</div>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={lang} onChange={e => setLang(e.target.value)}
              style={{ background: 'rgba(2,16,7,.7)', border: '1px solid rgba(13,153,96,.16)', color: 'rgba(223,240,225,.7)', borderRadius: 8, padding: '5px 9px', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
              {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <Link to="/dashboard"
              style={{ padding: '6px 14px', borderRadius: 9, fontSize: 12, color: 'rgba(200,148,26,.8)', border: '1px solid rgba(200,148,26,.2)', background: 'rgba(200,148,26,.06)', textDecoration: 'none' }}>
              {t.dashboardLink}
            </Link>
            <button onClick={newChat}
              style={{ padding: '6px 14px', borderRadius: 9, fontSize: 12, color: 'rgba(223,240,225,.5)', border: '1px solid rgba(13,153,96,.16)', background: 'rgba(2,16,7,.5)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
              {t.newChat}
            </button>
          </div>
        </div>
      </header>

      {/* ── PRIVACY NOTICE BANNER ───────────────────────────────────────── */}
      {showNotice && (
        <div style={{ position: 'relative', zIndex: 15, flexShrink: 0, animation: 'nova-notice-in .4s ease both' }}>
          <div style={{ maxWidth: 750, margin: '0 auto', padding: '10px 14px 0' }}>
            <div style={{ borderRadius: 16, background: 'linear-gradient(145deg,rgba(3,20,9,.82),rgba(2,15,7,.72))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(200,148,26,.2)', boxShadow: 'inset 0 1px 0 rgba(200,148,26,.14),0 8px 28px rgba(0,0,0,.5)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 400, color: '#dff0e1' }}>Before we talk</span>
                  <button onClick={() => setNoticeOpen(false)}
                    style={{ width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(200,148,26,.1)', color: 'rgba(200,148,26,.7)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                  {[
                    { bg: 'rgba(13,153,96,.08)',  border: 'rgba(13,153,96,.18)',  tc: 'rgba(30,220,130,.88)',  icon: '🛡', title: 'Zero Data Retention',    body: t.consentZero   },
                    { bg: 'rgba(200,148,26,.07)', border: 'rgba(200,148,26,.18)', tc: 'rgba(240,188,56,.9)',   icon: '◈',  title: 'AI, not a professional', body: t.consentAI     },
                    { bg: 'rgba(220,60,60,.07)',  border: 'rgba(220,60,60,.16)',  tc: 'rgba(248,110,110,.9)',  icon: '◉',  title: 'Crisis support',          body: t.consentCrisis },
                  ].map(({ bg, border, tc, icon, title, body }) => (
                    <div key={title} style={{ padding: '10px 11px', borderRadius: 11, background: bg, border: `1px solid ${border}` }}>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>{icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: tc, marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: 10.5, color: 'rgba(223,240,225,.46)', lineHeight: 1.45 }}>{body}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(223,240,225,.2)', textAlign: 'center', fontFamily: 'monospace' }}>
                  NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga
                </p>
              </div>
              <button onClick={() => setNoticeOpen(false)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', fontSize: 12, color: 'rgba(200,148,26,.55)', cursor: 'pointer', background: 'none', border: 'none', borderTop: '1px solid rgba(200,148,26,.08)', fontFamily: "'Outfit', sans-serif" }}>
                Understood, start talking ↓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MESSAGES ────────────────────────────────────────────────────── */}
      <div
        ref={msgsRef}
        style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(13,153,96,.2) transparent' }}
      >
        <div style={{ maxWidth: 750, margin: '0 auto', padding: '28px 16px 16px' }}>

          {/* Message bubbles */}
          {messages.map((msg) => {
            const isThinking = msg.role === 'assistant' && msg.streaming && !msg.text;
            return (
              <div key={msg.id}
                className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}
                style={{ display: 'flex', gap: 11, marginBottom: 24,
                         alignItems: 'flex-start',
                         justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

                {/* Thinking state — neural canvas floating, no bubble wrapper */}
                {isThinking ? (
                  <ThinkingIndicator />
                ) : (
                  <>
                    {/* Nova avatar — left side only, response state */}
                    {msg.role === 'assistant' && <NovaAvatar />}

                    <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column',
                                  gap: 5, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {/* Bubble */}
                      <div style={{
                        padding: '13px 16px', fontSize: 14, lineHeight: 1.72, color: '#dff0e1',
                        ...(msg.role === 'assistant' ? bubbleAI : bubbleUser),
                        ...(msg.error ? { borderColor: 'rgba(220,60,60,.28)', borderLeftColor: 'rgba(220,60,60,.45)' } : {}),
                      }}>
                        {msg.streaming ? (
                          <>
                            {msg.text}
                            <span style={{ display: 'inline-block', width: 2, height: 13, background: 'rgba(13,153,96,.8)', borderRadius: 1, verticalAlign: 'text-bottom', marginLeft: 2, animation: 'nova-cursor 1s ease-in-out infinite' }} />
                          </>
                        ) : (
                          <>
                            {msg.text.split('\n').map((line, li, arr) => (
                              <span key={li}>{line}{li < arr.length - 1 && <br />}</span>
                            ))}
                            {msg.crisisText && (
                              <div style={{ marginTop: 11, padding: '9px 12px', borderRadius: 11, background: 'rgba(220,60,60,.07)', border: '1px solid rgba(220,60,60,.18)', fontSize: 12, color: 'rgba(248,110,110,.85)', lineHeight: 1.55 }}>
                                <strong style={{ display: 'block', marginBottom: 3, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(248,110,110,.65)' }}>If you need immediate help</strong>
                                {msg.crisisText}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Feedback */}
                      {msg.role === 'assistant' && !msg.streaming && msg.text && !msg.error && msg.id !== 'welcome' && (
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: msg.feedback !== undefined ? 1 : 0, transition: 'opacity .22s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => { if (msg.feedback === undefined) e.currentTarget.style.opacity = 0; }}>
                          {msg.feedback !== undefined ? (
                            <span style={{ fontSize: 11, color: 'rgba(223,240,225,.3)', fontStyle: 'italic' }}>{t.thanks}</span>
                          ) : (
                            <>
                              <FbBtn icon="👍" green onClick={() => sendFeedback(msg.id, 1)} />
                              <FbBtn icon="👎"      onClick={() => sendFeedback(msg.id, -1)} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}


          {/* Bottom padding so last message clears input bar */}
          <div style={{ height: 16 }} />
        </div>
      </div>

      {/* ── CRISIS STRIP ────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '5px 16px', background: 'rgba(1,8,3,.78)', borderTop: '1px solid rgba(220,60,60,.1)' }}>
        {[
          { label: '111', sub: 'emergency' },
          { label: 'Lifeline', sub: '0800 543 354' },
          { label: '1737', sub: 'text or call' },
          { label: 'NZAF', sub: '0800 802 437' },
        ].map((item, i) => (
          <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && <span style={{ display: 'inline-block', width: 1, height: 11, background: 'rgba(220,60,60,.18)', margin: '0 12px' }} />}
            <span style={{ fontSize: 11, color: 'rgba(248,110,110,.6)', fontFamily: "'Outfit', monospace", letterSpacing: '.03em' }}>
              <span style={{ fontWeight: 500 }}>{item.label}</span>
              <span style={{ color: 'rgba(248,110,110,.4)', marginLeft: 4 }}>{item.sub}</span>
            </span>
          </span>
        ))}
      </div>

      {/* ── INPUT BAR ────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, background: 'linear-gradient(0deg,rgba(1,10,4,.96) 0%,rgba(1,13,5,.75) 100%)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', borderTop: '1px solid rgba(13,153,96,.1)' }}>
        <div style={{ maxWidth: 750, margin: '0 auto', padding: '9px 13px 13px' }}>
          <div
            style={{ ...glassInput, display: 'flex', alignItems: 'flex-end', gap: 9, padding: '10px 10px 10px 17px' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(13,153,96,.42)'; e.currentTarget.style.boxShadow = 'inset 0 1.5px 0 rgba(13,153,96,.12),0 0 0 3px rgba(13,153,96,.08),0 8px 28px rgba(0,0,0,.5)'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(13,153,96,.22)'; e.currentTarget.style.boxShadow = 'inset 0 1.5px 0 rgba(13,153,96,.1),0 8px 28px rgba(0,0,0,.5)'; }}>
            <textarea
              ref={taRef}
              value={input}
              onChange={e => { setInput(e.target.value); resizeTa(); }}
              onKeyDown={onKey}
              placeholder={t.placeholder}
              disabled={sending}
              rows={1}
              maxLength={2000}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#dff0e1', fontFamily: "'Outfit', sans-serif", fontSize: 14.5, fontWeight: 300, resize: 'none', minHeight: 24, maxHeight: 140, lineHeight: 1.55, scrollbarWidth: 'none' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              style={{
                width: 40, height: 40, borderRadius: 13, border: 'none', flexShrink: 0,
                cursor: (!input.trim() || sending) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                transition: 'all .22s',
                background: (!input.trim() || sending) ? 'rgba(13,153,96,.22)' : 'linear-gradient(135deg,#0d9960,#078046 50%,#c8941a)',
                color: (!input.trim() || sending) ? 'rgba(223,240,225,.25)' : '#010d03',
                boxShadow: (!input.trim() || sending) ? 'none' : '0 0 20px rgba(13,153,96,.3)',
                opacity: sending ? .55 : 1,
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.11em', textTransform: 'uppercase', color: 'rgba(223,240,225,.18)', marginTop: 7, fontFamily: 'monospace' }}>
            Enter to send · Shift+Enter for new line · Private session
          </p>
        </div>
      </div>

      {/* Consent gate */}
      {!consent && (
        <ChatConsentModal lang={lang} setLang={setLang} onConsent={onConsent} onDecline={() => navigate('/')} />
      )}
    </div>
  );
}

// ─── Tiny feedback button ──────────────────────────────────────────────────
function FbBtn({ icon, green, onClick }) {
  const base = {
    width: 27, height: 27, borderRadius: 8, border: green ? '1px solid rgba(13,153,96,.22)' : '1px solid rgba(200,148,26,.2)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
    background: 'transparent',
    color: green ? 'rgba(30,220,130,.65)' : 'rgba(200,148,26,.65)',
    transition: 'all .18s',
  };
  return (
    <button
      style={base}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.background = green ? 'rgba(13,153,96,.14)' : 'rgba(200,148,26,.12)';
        e.currentTarget.style.borderColor = green ? 'rgba(13,153,96,.38)' : 'rgba(200,148,26,.38)';
        e.currentTarget.style.color = green ? 'rgba(30,220,130,.95)' : 'rgba(240,188,56,.95)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = green ? 'rgba(13,153,96,.22)' : 'rgba(200,148,26,.2)';
        e.currentTarget.style.color = green ? 'rgba(30,220,130,.65)' : 'rgba(200,148,26,.65)';
      }}>
      {icon}
    </button>
  );
}
