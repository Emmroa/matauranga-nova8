// ═══════════════════════════════════════════════════════════════════════════
// Chat.jsx — NOVA Private Chat Interface
// Liquid Glass · Dark Green + Gold · Apple-level UX · 2026
//
// Props:
//   lang        string      — current language
//   setLang     fn          — change language
//   consent     object|null — consent payload from App.jsx
//   onConsent   fn          — called when user accepts consent
//   onDecline   fn          — called when user declines
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UI, LANG_OPTIONS, NeuralCanvas, DepthLayer, newSessionId, saveConsent, loadConsent } from './shared/nova.js';

// ─── Inline keyframes ──────────────────────────────────────────────────────
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Outfit:wght@200;300;400;500;600&display=swap');
  @keyframes nova-breathe    { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.14);opacity:.2} }
  @keyframes nova-glow       { 0%,100%{box-shadow:0 0 20px rgba(200,148,26,.32),0 0 40px rgba(13,153,96,.16)} 50%{box-shadow:0 0 32px rgba(200,148,26,.5),0 0 60px rgba(13,153,96,.24)} }
  @keyframes nova-fadein     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes nova-from-left  { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
  @keyframes nova-from-right { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
  @keyframes nova-notice-in  { from{opacity:0;transform:translateY(-8px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes thinking-dot    { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-5px);opacity:1} }
  @keyframes nova-pulse-ring { 0%,100%{transform:scale(.94);opacity:.6} 50%{transform:scale(1.07);opacity:.2} }
  @keyframes nova-cursor     { 0%,100%{opacity:.2} 50%{opacity:.9} }

  .msg-user { animation: nova-from-right .35s cubic-bezier(.34,1.56,.64,1) both }
  .msg-ai   { animation: nova-from-left  .35s cubic-bezier(.34,1.56,.64,1) both }
  .td1 { animation: thinking-dot 1.4s .00s ease-in-out infinite }
  .td2 { animation: thinking-dot 1.4s .18s ease-in-out infinite }
  .td3 { animation: thinking-dot 1.4s .36s ease-in-out infinite }
`;

// ─── PulseMark (small version for header) ─────────────────────────────────
function PulseMark({ size = 36 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: '1px solid rgba(200,148,26,.28)', animation: 'nova-pulse-ring 3.2s ease-in-out infinite' }} />
      <div style={{ width: size, height: size, borderRadius: Math.round(size*.3), background: 'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: size*.5, fontWeight: 400, color: '#010d03', animation: 'nova-glow 4s ease-in-out infinite', position: 'relative', zIndex: 1 }}>N</div>
    </div>
  );
}

// ─── ConsentModal (inline — chat route can be hit directly) ───────────────
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
          { bg:'rgba(13,153,96,.08)',  border:'rgba(13,153,96,.2)',  titleColor:'rgba(30,220,130,.9)',  icon:'🛡', title:'Zero Data Retention',       body: t.consentZero },
          { bg:'rgba(200,148,26,.07)', border:'rgba(200,148,26,.2)', titleColor:'rgba(240,188,56,.9)',  icon:'◈',  title:'AI — not a professional',    body: t.consentAI   },
          { bg:'rgba(220,60,60,.07)',  border:'rgba(220,60,60,.18)', titleColor:'rgba(248,110,110,.9)', icon:'◉',  title:'Crisis support',              body: t.consentCrisis },
        ].map(({ bg, border, titleColor, icon, title, body }) => (
          <div key={title} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'11px 14px', borderRadius:12, background:bg, border:`1px solid ${border}`, marginBottom:10 }}>
            <span style={{ fontSize:14, marginTop:1, flexShrink:0 }}>{icon}</span>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:titleColor, marginBottom:3 }}>{title}</div>
              <div style={{ fontSize:11, color:'rgba(223,240,225,.52)', lineHeight:1.5 }}>{body}</div>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onDecline} style={{ flex:1, padding:11, borderRadius:11, fontSize:13, background:'transparent', border:'1px solid rgba(200,148,26,.2)', color:'rgba(223,240,225,.52)', cursor:'pointer', fontFamily:"'Outfit', sans-serif" }}>{t.decline}</button>
          <button onClick={() => onConsent({ regionCode:'NAT', language:lang })} style={{ flex:2, padding:11, borderRadius:11, fontSize:13, fontWeight:500, background:'linear-gradient(135deg,rgba(13,153,96,.9),rgba(200,148,26,.85))', border:'none', color:'#010d03', cursor:'pointer', fontFamily:"'Outfit', sans-serif" }}>{t.iAgree}</button>
        </div>
        <p style={{ textAlign:'center', fontSize:10, letterSpacing:'.13em', textTransform:'uppercase', color:'rgba(223,240,225,.2)', marginTop:14, fontFamily:'monospace' }}>
          NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga
        </p>
      </div>
    </div>
  );
}

// ─── Chat component ────────────────────────────────────────────────────────
export default function Chat({ lang, setLang, consent, onConsent, onDecline }) {
  const t = UI[lang] || UI.en;
  const navigate = useNavigate();
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [noticeOpen, setNoticeOpen]   = useState(true);
  const abortRef = useRef(null);
  const msgsRef  = useRef(null);
  const taRef    = useRef(null);

  const scrollBottom = useCallback(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(scrollBottom, [messages, scrollBottom]);

  // Auto-resize textarea
  const resizeTa = () => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 140) + 'px';
  };

  const newChat = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setMessages([]);
    setInput('');
    setSending(false);
    setNoticeOpen(true);
  };

  // ── Send ─────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !consent) return;

    const uid = 'u-' + Date.now();
    const aid = 'a-' + Date.now();

    setMessages(m => [...m, { id: uid, role: 'user', text: trimmed }]);
    setInput('');
    if (taRef.current) { taRef.current.style.height = 'auto'; }
    setSending(true);

    setMessages(m => [...m, { id: aid, role: 'assistant', text: '', streaming: true }]);

    const history = messages
      .filter(x => !x.streaming && x.text)
      .slice(-10)
      .map(x => ({ role: x.role, content: x.text }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': consent.sessionId },
        body: JSON.stringify({ message: trimmed, sessionId: consent.sessionId, regionCode: consent.regionCode || 'NAT', consent: true, history, language: lang }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', crisis = false, crisisText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          if (!frame.trim()) continue;
          const lines = frame.split('\n');
          let evt = 'message', data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) evt = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload; try { payload = JSON.parse(data); } catch { continue; }

          if      (evt === 'meta')             { if (payload.crisis) crisis = true; }
          else if (evt === 'crisis_resources') { crisisText = payload.text || ''; }
          else if (evt === 'token')            { setMessages(m => m.map(x => x.id === aid ? { ...x, text: (x.text||'') + (payload.t||'') } : x)); }
          else if (evt === 'fallback')         { setMessages(m => m.map(x => x.id === aid ? { ...x, text: payload.text, fallback: true } : x)); }
          else if (evt === 'done')             { setMessages(m => m.map(x => x.id === aid ? { ...x, streaming: false, crisis, crisisText: crisisText || null } : x)); }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      const errMsg = lang === 'es'
        ? 'Algo falló. Tu mensaje no se guardó. Intentá de nuevo.'
        : lang === 'mi'
        ? 'He raru. Kāore tō kōrero i tiakina. Tēnā whakamātau anō.'
        : "Something went wrong. Your message wasn't stored anywhere. Please try again.";
      setMessages(m => m.map(x => x.id === aid ? { ...x, streaming: false, text: x.text || errMsg, error: true } : x));
    } finally {
      setSending(false);
      abortRef.current = null;
      setMessages(m => m.map(x => x.id === aid && x.streaming ? { ...x, streaming: false } : x));
    }
  }, [input, sending, consent, messages, lang]);

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const sendFeedback = async (messageId, rating) => {
    if (!consent) return;
    try {
      await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, rating, sessionId: consent.sessionId }) });
    } catch { /* no-op */ }
    setMessages(m => m.map(x => x.id === messageId ? { ...x, feedback: rating } : x));
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const glassHeader = {
    background: 'linear-gradient(180deg,rgba(2,18,8,.84) 0%,rgba(1,13,5,.65) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    borderBottom: '1px solid rgba(13,153,96,.14)',
  };
  const glassInput = {
    background: 'linear-gradient(145deg,rgba(3,20,9,.74),rgba(2,15,7,.64))',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(13,153,96,.2)',
    boxShadow: 'inset 0 1.5px 0 rgba(13,153,96,.1),0 8px 28px rgba(0,0,0,.5)',
    borderRadius: 20,
  };
  const bubbleAI = {
    background: 'linear-gradient(145deg,rgba(3,18,8,.8),rgba(2,14,6,.7))',
    border: '1px solid rgba(13,153,96,.18)',
    borderLeft: '2px solid rgba(13,153,96,.35)',
    boxShadow: 'inset 0 1px 0 rgba(13,153,96,.12),0 8px 24px rgba(0,0,0,.45)',
    borderRadius: '18px 18px 18px 6px',
  };
  const bubbleUser = {
    background: 'linear-gradient(145deg,rgba(4,24,11,.84),rgba(3,18,8,.74))',
    border: '1px solid rgba(200,148,26,.2)',
    boxShadow: 'inset 0 1px 0 rgba(200,148,26,.14),0 8px 24px rgba(0,0,0,.45)',
    borderRadius: '18px 18px 6px 18px',
  };

  const SHOWN_NOTICE = messages.length === 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#010d03', fontFamily: "'Outfit', system-ui, sans-serif", color: '#dff0e1', position: 'relative', overflow: 'hidden' }}>
      <style>{KEYFRAMES}</style>
      <NeuralCanvas />
      <DepthLayer />

      {/* HEADER */}
      <header style={{ ...glassHeader, position: 'relative', zIndex: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: '#dff0e1' }}>
          <PulseMark size={34} />
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 300, letterSpacing: '.02em' }}>
              Mātauranga <span style={{ color: 'rgba(200,148,26,.88)' }}>NOVA</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(223,240,225,.38)', letterSpacing: '.04em' }}>Private · Zero data retention</div>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{ background: 'rgba(2,16,7,.7)', border: '1px solid rgba(13,153,96,.16)', color: 'rgba(223,240,225,.7)', borderRadius: 8, padding: '5px 9px', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <Link to="/dashboard" style={{ padding: '6px 14px', borderRadius: 9, fontSize: 12, color: 'rgba(200,148,26,.8)', border: '1px solid rgba(200,148,26,.2)', background: 'rgba(200,148,26,.06)', textDecoration: 'none' }}>{t.dashboardLink}</Link>
          <button onClick={newChat} style={{ padding: '6px 14px', borderRadius: 9, fontSize: 12, color: 'rgba(223,240,225,.5)', border: '1px solid rgba(13,153,96,.16)', background: 'rgba(2,16,7,.5)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>{t.newChat}</button>
        </div>
      </header>

      {/* NOTICE BANNER */}
      {noticeOpen && SHOWN_NOTICE && (
        <div style={{ position: 'relative', zIndex: 15, flexShrink: 0, animation: 'nova-notice-in .45s ease both' }}>
          <div style={{ margin: '12px 16px', borderRadius: 16, background: 'linear-gradient(145deg,rgba(3,20,9,.8),rgba(2,15,7,.7))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(200,148,26,.22)', boxShadow: 'inset 0 1px 0 rgba(200,148,26,.16),0 8px 28px rgba(0,0,0,.5)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 400, color: '#dff0e1' }}>Before we talk</span>
                <button onClick={() => setNoticeOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(200,148,26,.1)', color: 'rgba(200,148,26,.7)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {[
                  { bg:'rgba(13,153,96,.08)',  border:'rgba(13,153,96,.18)',  tc:'rgba(30,220,130,.88)',  icon:'🛡', title:'Zero Data Retention', body: t.consentZero },
                  { bg:'rgba(200,148,26,.07)', border:'rgba(200,148,26,.18)', tc:'rgba(240,188,56,.9)',   icon:'◈',  title:'AI, not a professional',body: t.consentAI   },
                  { bg:'rgba(220,60,60,.07)',  border:'rgba(220,60,60,.16)',  tc:'rgba(248,110,110,.9)',  icon:'◉',  title:'Crisis support',        body: t.consentCrisis },
                ].map(({ bg,border,tc,icon,title,body }) => (
                  <div key={title} style={{ padding:'10px 12px', borderRadius:11, background:bg, border:`1px solid ${border}` }}>
                    <div style={{ fontSize:14, marginBottom:5 }}>{icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:tc, marginBottom:3 }}>{title}</div>
                    <div style={{ fontSize:11, color:'rgba(223,240,225,.48)', lineHeight:1.45 }}>{body}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(223,240,225,.22)', textAlign:'center', fontFamily:'monospace' }}>NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga</p>
            </div>
            <button onClick={() => setNoticeOpen(false)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', fontSize:12, color:'rgba(200,148,26,.55)', cursor:'pointer', borderTop:'1px solid rgba(200,148,26,.08)', background:'none', border:'none', borderTop:'1px solid rgba(200,148,26,.08)', fontFamily:"'Outfit', sans-serif" }}>
              Understood, start talking ↓
            </button>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div ref={msgsRef} style={{ flex:1, overflowY:'auto', position:'relative', zIndex:10, padding:'16px 16px 8px', scrollbarWidth:'thin', scrollbarColor:'rgba(13,153,96,.2) transparent' }}>
        {messages.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, textAlign:'center', padding:32 }}>
            <div style={{ position:'relative', width:72, height:72, marginBottom:8 }}>
              {[9,18].map((off,i) => (
                <div key={i} style={{ position:'absolute', inset:-off, borderRadius:'50%', border:`1px solid rgba(200,148,26,${.26-i*.1})`, animation:`nova-breathe ${2.4+i*.8}s ease-in-out ${i*.4}s infinite` }} />
              ))}
              <div style={{ width:72, height:72, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond', serif", fontSize:32, fontWeight:400, color:'#010d03', background:'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', boxShadow:'0 0 32px rgba(200,148,26,.38),0 0 64px rgba(13,153,96,.2)', position:'relative', zIndex:1 }}>N</div>
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:28, fontWeight:300, color:'#dff0e1' }}>
              {lang==='es'?'Hola — soy NOVA':lang==='mi'?'Tēnā koe — ko NOVA':"Hey — I'm NOVA"}
            </div>
            <div style={{ fontSize:14, color:'rgba(223,240,225,.48)', lineHeight:1.6, maxWidth:300 }}>
              {lang==='es'?"Este es un espacio privado, solo entre nosotros. Nada se guarda."
                :lang==='mi'?"He wāhi tūmataiti tēnei, māua anō. Kāore he mea e tiakina ana."
                :"This is a private space, just between us. Nothing you write is stored."}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id} style={{ display:'flex', gap:10, marginBottom:14, alignItems:'flex-end', flexDirection: msg.role==='user'?'row-reverse':'row' }}
            className={msg.role==='user'?'msg-user':'msg-ai'}>
            {/* Avatar */}
            <div style={{ width:28, height:28, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond', serif", fontSize:14, fontWeight:400,
              ...(msg.role==='assistant'
                ? { background:'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', color:'#010d03', boxShadow:'0 0 14px rgba(200,148,26,.3)' }
                : { background:'rgba(13,153,96,.15)', border:'1px solid rgba(13,153,96,.25)', color:'rgba(30,220,130,.8)', fontSize:11 })
            }}>
              {msg.role==='assistant' ? 'N' : '↑'}
            </div>

            <div style={{ maxWidth:'72%', display:'flex', flexDirection:'column', gap:6 }}>
              {/* Bubble */}
              <div style={{ padding:'13px 16px', fontSize:14, lineHeight:1.65, color:'#dff0e1',
                ...(msg.role==='assistant' ? bubbleAI : bubbleUser),
                ...(msg.error ? { borderColor:'rgba(220,60,60,.25)', borderLeftColor:'rgba(220,60,60,.4)' } : {}) }}>
                {/* Streaming = show text + cursor; done = show text */}
                {msg.streaming ? (
                  <>
                    {msg.text}
                    <span style={{ display:'inline-block', width:2, height:14, background:'rgba(13,153,96,.8)', borderRadius:1, verticalAlign:'text-bottom', marginLeft:2, animation:'nova-cursor 1s ease-in-out infinite' }} />
                  </>
                ) : (
                  <>
                    {msg.text.split('\n').map((line, li) => (
                      <span key={li}>{line}{li < msg.text.split('\n').length-1 && <br/>}</span>
                    ))}
                    {/* Crisis box */}
                    {msg.crisisText && (
                      <div style={{ marginTop:12, padding:'10px 13px', borderRadius:12, background:'rgba(220,60,60,.08)', border:'1px solid rgba(220,60,60,.2)', fontSize:12, color:'rgba(248,110,110,.88)', lineHeight:1.55 }}>
                        <strong style={{ display:'block', marginBottom:4, fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(248,110,110,.7)' }}>If you need immediate help</strong>
                        {msg.crisisText}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Feedback */}
              {msg.role==='assistant' && !msg.streaming && msg.text && !msg.error && (
                <div style={{ display:'flex', alignItems:'center', gap:6, opacity: msg.feedback !== undefined ? 1 : 0, transition:'opacity .25s' }}
                  onMouseOver={e => e.currentTarget.style.opacity=1}
                  onMouseOut={e => { if (msg.feedback === undefined) e.currentTarget.style.opacity=0; }}>
                  {msg.feedback !== undefined ? (
                    <span style={{ fontSize:11, color:'rgba(223,240,225,.3)', fontStyle:'italic' }}>{t.thanks}</span>
                  ) : (
                    <>
                      <button onClick={() => sendFeedback(msg.id, 1)}
                        style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(13,153,96,.22)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, background:'transparent', color:'rgba(30,220,130,.65)', transition:'all .2s' }}
                        onMouseOver={e => { e.currentTarget.style.background='rgba(13,153,96,.15)'; e.currentTarget.style.borderColor='rgba(13,153,96,.4)'; e.currentTarget.style.color='rgba(30,220,130,.95)'; }}
                        onMouseOut={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(13,153,96,.22)'; e.currentTarget.style.color='rgba(30,220,130,.65)'; }}>
                        👍
                      </button>
                      <button onClick={() => sendFeedback(msg.id, -1)}
                        style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(200,148,26,.2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, background:'transparent', color:'rgba(200,148,26,.65)', transition:'all .2s' }}
                        onMouseOver={e => { e.currentTarget.style.background='rgba(200,148,26,.12)'; e.currentTarget.style.borderColor='rgba(200,148,26,.4)'; e.currentTarget.style.color='rgba(240,188,56,.95)'; }}
                        onMouseOut={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(200,148,26,.2)'; e.currentTarget.style.color='rgba(200,148,26,.65)'; }}>
                        👎
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {sending && !messages.find(m => m.streaming && m.role==='assistant' && m.text) && (
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:14 }} className="msg-ai">
            <div style={{ width:28, height:28, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond', serif", fontSize:14, fontWeight:400, background:'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', color:'#010d03', boxShadow:'0 0 14px rgba(200,148,26,.3)' }}>N</div>
            <div style={{ ...bubbleAI, padding:'14px 18px', display:'flex', alignItems:'center', gap:5 }}>
              {[1,2,3].map(i => <div key={i} className={`td${i}`} style={{ width:7, height:7, borderRadius:'50%', background:'rgba(13,153,96,.82)' }} />)}
            </div>
          </div>
        )}
      </div>

      {/* CRISIS STRIP */}
      <div style={{ position:'relative', zIndex:16, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', gap:16, flexWrap:'wrap', padding:'6px 20px', background:'rgba(1,10,4,.72)', borderTop:'1px solid rgba(220,60,60,.1)' }}>
        {['111 emergency','Lifeline 0800 543 354','Text / call 1737','Burnett Foundation 0800 802 437'].map((item, i) => (
          <span key={item} style={{ fontSize:11, color:'rgba(248,110,110,.62)', fontFamily:"'Outfit', monospace", letterSpacing:'.04em' }}>
            {i > 0 && <span style={{ display:'inline-block', width:1, height:12, background:'rgba(220,60,60,.14)', margin:'0 10px 0 0', verticalAlign:'middle' }} />}
            {item}
          </span>
        ))}
      </div>

      {/* INPUT BAR */}
      <div style={{ position:'relative', zIndex:20, flexShrink:0, padding:'10px 14px 14px', background:'linear-gradient(0deg,rgba(1,10,4,.94) 0%,rgba(1,13,5,.72) 100%)', backdropFilter:'blur(40px) saturate(180%)', WebkitBackdropFilter:'blur(40px) saturate(180%)', borderTop:'1px solid rgba(13,153,96,.1)' }}>
        <div style={{ ...glassInput, display:'flex', alignItems:'flex-end', gap:10, padding:'10px 10px 10px 18px', transition:'border-color .25s,box-shadow .25s' }}
          onFocus={e => e.currentTarget.style.borderColor='rgba(13,153,96,.38)'}
          onBlur={e => e.currentTarget.style.borderColor='rgba(13,153,96,.2)'}>
          <textarea
            ref={taRef}
            value={input}
            onChange={e => { setInput(e.target.value); resizeTa(); }}
            onKeyDown={onKey}
            placeholder={t.placeholder}
            disabled={sending}
            rows={1}
            maxLength={2000}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#dff0e1', fontFamily:"'Outfit', sans-serif", fontSize:15, fontWeight:300, resize:'none', minHeight:24, maxHeight:140, lineHeight:1.5, scrollbarWidth:'none' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{ width:40, height:40, borderRadius:13, border:'none', cursor: !input.trim()||sending?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, transition:'all .25s', flexShrink:0,
              background: !input.trim()||sending ? 'rgba(13,153,96,.28)' : 'linear-gradient(135deg,#0d9960,#078046 50%,#c8941a)',
              color: !input.trim()||sending ? 'rgba(223,240,225,.3)' : '#010d03',
              boxShadow: !input.trim()||sending ? 'none' : '0 0 20px rgba(13,153,96,.28)',
              opacity: sending ? .5 : 1 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <p style={{ textAlign:'center', fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(223,240,225,.2)', marginTop:8, fontFamily:'monospace' }}>
          Enter to send · Shift+Enter for new line · Private session
        </p>
      </div>

      {/* Consent gate */}
      {!consent && <ChatConsentModal lang={lang} setLang={setLang} onConsent={onConsent} onDecline={() => navigate('/')} />}
    </div>
  );
}
