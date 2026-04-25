// ═══════════════════════════════════════════════════════════════════════════
// Landing.jsx — NOVA Home Page
// Solarpunk · Liquid Glass · Dark Green + Gold · 2026
//
// Props:
//   lang        string   — current language code
//   setLang     fn       — change language
//   consent     object|null — current consent state
//   onConsent   fn       — called with { regionCode, language }
//   onDecline   fn       — called when user dismisses consent
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UI, LANG_OPTIONS, NeuralCanvas, DepthLayer } from './shared/nova.js';

// ─── Shared glass style objects ────────────────────────────────────────────
const SP = {
  glass: {
    background: 'linear-gradient(160deg, rgba(5,20,9,.62) 0%, rgba(4,16,7,.52) 100%)',
    backdropFilter: 'blur(52px) saturate(190%) brightness(1.07)',
    WebkitBackdropFilter: 'blur(52px) saturate(190%) brightness(1.07)',
    border: '1px solid rgba(212,168,67,.16)',
    boxShadow: 'inset 0 1.5px 0 rgba(212,168,67,.14), inset 0 -1px 0 rgba(16,185,129,.08), 0 28px 72px rgba(0,0,0,.58)',
  },
  glassHero: {
    background: 'linear-gradient(155deg, rgba(6,24,11,.72) 0%, rgba(4,18,8,.62) 100%)',
    backdropFilter: 'blur(64px) saturate(210%) brightness(1.1)',
    WebkitBackdropFilter: 'blur(64px) saturate(210%) brightness(1.1)',
    border: '1px solid rgba(212,168,67,.22)',
    boxShadow: 'inset 0 2px 0 rgba(240,180,41,.2), inset 0 -1px 0 rgba(16,185,129,.1), 0 40px 100px rgba(0,0,0,.65)',
    borderRadius: 28,
  },
  glassGold: {
    background: 'linear-gradient(145deg, rgba(12,28,8,.65) 0%, rgba(8,20,6,.55) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(212,168,67,.28)',
    boxShadow: 'inset 0 1px 0 rgba(240,180,41,.18), 0 16px 48px rgba(0,0,0,.5)',
  },
  glassRose: {
    background: 'linear-gradient(145deg, rgba(14,5,5,.68), rgba(10,3,3,.58))',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(239,68,68,.18)',
    boxShadow: 'inset 0 1px 0 rgba(251,113,133,.1), 0 14px 44px rgba(0,0,0,.52)',
  },
};

// ─── Inline keyframes ──────────────────────────────────────────────────────
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Outfit:wght@200;300;400;500;600&display=swap');
  @keyframes nova-breathe { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.14);opacity:.2} }
  @keyframes nova-float   { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-10px)} 70%{transform:translateY(-5px)} }
  @keyframes nova-fadein  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes nova-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes nova-pulse-ring { 0%,100%{transform:scale(.94);opacity:.6} 50%{transform:scale(1.07);opacity:.2} }
  @keyframes nova-glow    { 0%,100%{box-shadow:0 0 20px rgba(200,148,26,.32),0 0 40px rgba(13,153,96,.16)} 50%{box-shadow:0 0 32px rgba(200,148,26,.5),0 0 60px rgba(13,153,96,.24)} }
  .fi1{animation:nova-fadein .8s .08s ease both}
  .fi2{animation:nova-fadein .8s .22s ease both}
  .fi3{animation:nova-fadein .8s .38s ease both}
  .fi4{animation:nova-fadein .8s .54s ease both}
  .sp-lift{transition:transform .28s,box-shadow .28s}
  .sp-lift:hover{transform:translateY(-3px)}
`;

// ─── PulseLogo ─────────────────────────────────────────────────────────────
function PulseLogo({ size = 62 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {[8,16,24].map((offset, i) => (
        <div key={i} style={{
          position: 'absolute',
          inset: -offset,
          borderRadius: '50%',
          border: `1px solid rgba(212,168,67,${.28 - i*.08})`,
          animation: `nova-breathe ${2.4+i*.6}s ease-in-out ${i*.4}s infinite`,
        }} />
      ))}
      <div style={{
        width: size, height: size, borderRadius: Math.round(size*.27),
        background: 'linear-gradient(135deg, #0d9960, #078046 55%, #c8941a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Cormorant Garamond', serif", fontSize: size*.44, fontWeight: 400, color: '#010d03',
        boxShadow: '0 0 28px rgba(200,148,26,.38), 0 0 56px rgba(13,153,96,.2)',
        position: 'relative', zIndex: 1,
        animation: 'nova-glow 4s ease-in-out infinite',
      }}>N</div>
    </div>
  );
}

// ─── ConsentModal ─────────────────────────────────────────────────────────
function ConsentModal({ lang, setLang, onConsent, onDecline }) {
  const t = UI[lang] || UI.en;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(1,13,3,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div style={{ ...SP.glassHero, position: 'relative', width: '100%', maxWidth: 420, padding: '28px 28px 24px', animation: 'nova-fadein .45s ease both' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PulseLogo size={40} />
            <h2 id="consent-title" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 400, color: '#dff0e1' }}>{t.consentTitle}</h2>
          </div>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{ background: 'rgba(2,16,7,.7)', border: '1px solid rgba(13,153,96,.2)', color: 'rgba(223,240,225,.7)', borderRadius: 8, padding: '5px 9px', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        {/* Notice rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[
            { icon: '🛡', bg: 'rgba(13,153,96,.08)', border: 'rgba(13,153,96,.2)', titleColor: 'rgba(30,220,130,.9)', title: 'Zero Data Retention', body: t.consentZero },
            { icon: '◈',  bg: 'rgba(200,148,26,.07)', border: 'rgba(200,148,26,.2)', titleColor: 'rgba(240,188,56,.9)', title: 'AI — not a professional', body: t.consentAI },
            { icon: '◉',  bg: 'rgba(220,60,60,.07)',  border: 'rgba(220,60,60,.18)', titleColor: 'rgba(248,110,110,.9)', title: 'Crisis support', body: t.consentCrisis },
          ].map(({ icon, bg, border, titleColor, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 14px', borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
              <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: titleColor, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'rgba(223,240,225,.55)', lineHeight: 1.5 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDecline}
            style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, background: 'transparent', border: '1px solid rgba(200,148,26,.2)', color: 'rgba(223,240,225,.55)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all .2s' }}>
            {t.decline}
          </button>
          <button onClick={() => onConsent({ regionCode: 'NAT', language: lang })}
            style={{ flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 500, background: 'linear-gradient(135deg, rgba(13,153,96,.9), rgba(200,148,26,.85))', border: 'none', color: '#010d03', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {t.iAgree}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(223,240,225,.22)', marginTop: 14, fontFamily: 'monospace' }}>
          NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga
        </p>
      </div>
    </div>
  );
}

// ─── Landing page ──────────────────────────────────────────────────────────
export default function Landing({ lang, setLang, consent, onConsent, onDecline }) {
  const t = UI[lang] || UI.en;
  const [ecoOpen, setEcoOpen] = useState(null);

  const FEATURES = [
    { icon: '🛡', title: 'Zero Data Retention', wide: true, variant: 'emerald',
      body: "Your words are never stored. Anonymous counters only — region, topic, language. Compliant with NZ Privacy Act 2020, HIPC 2020, and IPP 3A (in force May 2026). Every message is scrubbed of NHI, IRD, phone, email before the AI sees it.",
      badge: 'NZ Privacy Act 2020 · HIPC · Te Mana Raraunga' },
    { icon: '✦', title: 'Culturally safe', variant: 'gold',
      body: "Built on Te Whare Tapa Whā. Responds in English, te reo Māori, and Spanish. Designed for Takatāpui, Pacific, Māori, migrant, and rural communities." },
    { icon: '◈', title: 'Sovereign NZ AI', variant: 'emerald',
      body: "All processing in Aotearoa on Catalyst Cloud. Data never leaves NZ. phi3:mini → Mistral 7B dual architecture." },
    { icon: '◎', title: 'Languages', variant: 'emerald', langCard: true },
    { icon: '◉', title: 'If you need help now', variant: 'rose', crisisCard: true },
  ];

  const ECOSYSTEM = [
    { id: 'security', icon: '◈', label: 'Security layers L1–L4',
      items: [['L1 — PII scrubbing','NHI, IRD, phone, email, address stripped before the AI sees any message.'],['L2 — Session rate limiting','Circuit breaker (opossum) cuts AI at 10s timeout. Prebuilt crisis message returned.'],['L3 — Zero retention','Message text NEVER reaches SQLite. Only region, topic, language, hour, crisis flag.'],['L4 — Helmet CSP + HSTS','Strict CSP, HSTS, SSH tunnel only. Cookie: HttpOnly, SameSite=lax, 8h TTL.']] },
    { id: 'hosting', icon: '☁', label: 'Catalyst Cloud NZ',
      items: [['Data sovereignty','100% NZ infrastructure. HIPC 2020 + Te Mana Raraunga require data stays in Aotearoa.'],['Infrastructure','c1.c4r8: 4 vCPU / 8GB RAM · Intel Xeon · NVMe · 10Gbps · ~$198 NZD/month.'],['Why not AWS/GCP','Overseas servers create HIPC + Māori Data Sovereignty conflicts.']] },
    { id: 'ai', icon: '∿', label: 'AI engine: phi3 → Mistral',
      items: [['phi3:mini — current','2.3 GB · 4096 token context · CPU-only · 8–15s response. Ideal for demo.'],['Mistral 7B — phase 2','Apache 2.0 · self-hosted · 8192 context · 3–5s on c1.c8r16.'],['Dual AI','Mistral for conversation (empathy) + phi3 for analytics (speed). Two AIs, two roles.']] },
    { id: 'constitution', icon: '✦', label: 'Constitution & values',
      items: [['Whakapapa','Bruce Burnett (1984) → NZAF → Burnett Foundation. Emanuel Figueroa built NOVA for the gap he found.'],['Wairua — 3 truths','AROHA (love) · TIKA ME PONO (truth with kindness) · KAITIAKITANGA (guardian of dignity).'],['Human rights','Human Rights Act 1993 · Privacy Act 2020 · HDCA 2015 · Employment NZ · HRC 0800 496 877.']] },
    { id: 'tags', icon: '◎', label: 'Tag system & dashboard',
      items: [['How tags work','Hidden HTML comments in each NOVA response. Extracted before rendering. User never sees them.'],['35 topics × 4 zones','140 indicators · Social Epidemic Index · R-social · Seasonal risk calendar.'],['Privacy guarantee','Small-cell suppression n<6. Never cross-tabulate region + language + topic.']] },
    { id: 'roadmap', icon: '↗', label: 'Roadmap 2026–2027',
      items: [['Phase 1 — Demo','phi3:mini · 5-tab epi dashboard · Privacy Shield · Burnett Innovation Challenge.'],['Phase 2 — Q3 2026','Mistral 7B · dual AI · NZ epi fine-tuning · 30-day outbreak prediction.'],['Phase 4 — 2027','API for sexual health clinics · Healthpoint NZ integration · direct appointments.']] },
  ];

  const cardStyle = (variant) => ({
    ...( variant === 'gold' ? SP.glassGold : variant === 'rose' ? SP.glassRose : SP.glass ),
    borderRadius: 20, padding: '26px 24px',
  });

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Outfit', system-ui, sans-serif", color: '#dff0e1', background: '#010d03', position: 'relative' }}>
      <style>{KEYFRAMES}</style>
      <NeuralCanvas />
      <DepthLayer />

      {/* NAV */}
      <header style={{ position: 'relative', zIndex: 10, maxWidth: 1200, margin: '0 auto', padding: '28px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="fi1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <PulseLogo size={40} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 300, letterSpacing: '.02em' }}>
            Mātauranga <span style={{ color: 'rgba(200,148,26,.9)' }}>NOVA</span>
          </span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{ background: 'rgba(2,16,7,.7)', border: '1px solid rgba(13,153,96,.2)', color: 'rgba(223,240,225,.7)', borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <Link to="/dashboard" style={{ padding: '7px 16px', borderRadius: 10, fontSize: 12, color: 'rgba(200,148,26,.85)', border: '1px solid rgba(200,148,26,.22)', background: 'rgba(200,148,26,.06)', textDecoration: 'none' }}>
            {t.dashboardLink}
          </Link>
        </nav>
      </header>

      <main style={{ position: 'relative', zIndex: 10, maxWidth: 1200, margin: '0 auto', padding: '0 28px 80px' }}>
        {/* HERO */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr clamp(320px,40vw,460px)', gap: 52, alignItems: 'center', minHeight: '88vh', paddingBottom: 32 }}>
          <div className="fi2">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
              <div style={{ width: 26, height: 1, background: 'rgba(200,148,26,.6)' }} />
              <span style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'rgba(200,148,26,.65)' }}>Burnett Foundation Aotearoa · Innovation Challenge 2026</span>
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(50px,6.2vw,88px)', fontWeight: 300, lineHeight: 1.06, letterSpacing: '-.01em', margin: '0 0 6px' }}>
              <span style={{ display: 'block', color: '#dff0e1' }}>A private</span>
              <span style={{ display: 'block', background: 'linear-gradient(135deg,#0d9960 0%,#18dc88 35%,#c8941a 65%,#f0bc38 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'nova-shimmer 4.5s linear infinite' }}>companion</span>
              <span style={{ display: 'block', fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(34px,4.2vw,60px)', color: 'rgba(223,240,225,.72)' }}>for HIV in Aotearoa</span>
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 300, color: 'rgba(223,240,225,.5)', maxWidth: 440, margin: '22px 0 38px' }}>
              Science-led · Culturally safe · Sovereign NZ AI. NOVA listens without judgment, informs without fear, and never stores your words.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link to="/chat"
                style={{ padding: '15px 30px', borderRadius: 13, fontSize: 15, fontWeight: 500, textDecoration: 'none', color: '#010d03', background: 'linear-gradient(135deg,#0d9960,#078046 50%,#c8941a)', boxShadow: '0 0 36px rgba(13,153,96,.3),0 4px 20px rgba(0,0,0,.45)', fontFamily: "'Outfit', sans-serif", transition: 'all .3s' }}>
                {t.start} →
              </Link>
              <a href="#ecosystem"
                style={{ padding: '15px 24px', borderRadius: 13, fontSize: 14, fontWeight: 400, textDecoration: 'none', background: 'transparent', border: '1px solid rgba(200,148,26,.22)', color: 'rgba(223,240,225,.58)', fontFamily: "'Outfit', sans-serif", transition: 'all .2s' }}>
                How it works
              </a>
            </div>
          </div>

          {/* Hero card */}
          <div className="fi2" style={{ animation: 'nova-float 7s ease-in-out infinite' }}>
            <div style={{ ...SP.glassHero, padding: '38px 34px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,148,26,.14) 0%,transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,153,96,.12) 0%,transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ marginBottom: 28, position: 'relative', zIndex: 1 }}><PulseLogo size={62} /></div>
              {[
                { bg: 'rgba(13,153,96,.08)', border: 'rgba(13,153,96,.2)', titleColor: 'rgba(30,220,130,.9)', icon: '🛡', title: 'Zero Data Retention', body: 'Nothing you type is stored or seen by anyone.' },
                { bg: 'rgba(200,148,26,.07)', border: 'rgba(200,148,26,.2)', titleColor: 'rgba(240,188,56,.9)', icon: '◈', title: 'AI companion — not a professional', body: 'Does not replace a doctor, nurse, or therapist.' },
                { bg: 'rgba(220,60,60,.07)', border: 'rgba(220,60,60,.18)', titleColor: 'rgba(248,110,110,.9)', icon: '◉', title: 'Crisis support', body: '111 · Lifeline 0800 543 354 · text or call 1737' },
              ].map(({ bg, border, titleColor, icon, title, body }) => (
                <div key={title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 15px', borderRadius: 13, background: bg, border: `1px solid ${border}`, marginBottom: 10, position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: 15, marginTop: 1, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: titleColor, marginBottom: 3 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(223,240,225,.55)', lineHeight: 1.5 }}>{body}</div>
                  </div>
                </div>
              ))}
              <Link to="/chat"
                style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 13, marginTop: 20, position: 'relative', zIndex: 1, textDecoration: 'none', fontWeight: 500, fontSize: 14, background: 'linear-gradient(135deg,rgba(13,153,96,.9),rgba(200,148,26,.85))', color: '#010d03', boxShadow: '0 0 28px rgba(13,153,96,.24)', fontFamily: "'Outfit', sans-serif" }}>
                Start a private conversation
              </Link>
              <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(223,240,225,.22)', marginTop: 14, position: 'relative', zIndex: 1, fontFamily: 'monospace' }}>
                NZ Privacy Act 2020 · IPP 3A · HIPC 2020 · Te Mana Raraunga
              </p>
            </div>
          </div>
        </section>

        {/* DIVIDER */}
        <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(13,153,96,.15) 30%,rgba(200,148,26,.14) 70%,transparent)', margin: '0 0 60px' }} />

        {/* BENTO */}
        <div className="fi3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13, marginBottom: 80 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="sp-lift"
              style={{ ...cardStyle(f.variant), ...(f.wide ? { gridColumn: 'span 2' } : {}) }}>
              <div style={{ fontSize: 22, marginBottom: 14, color: f.variant === 'gold' ? 'rgba(240,188,56,.9)' : f.variant === 'rose' ? 'rgba(248,110,110,.9)' : 'rgba(30,220,130,.88)' }}>{f.icon}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 400, color: '#dff0e1', marginBottom: 9 }}>{f.title}</div>
              {f.langCard ? (
                <div>
                  {['English · Warm NZ casual','Te Reo Māori · Tēnā koe','Español · Internacional'].map((l, j) => (
                    <div key={j} style={{ fontSize: 13, color: j===1?'rgba(200,148,26,.82)':'rgba(223,240,225,.62)', padding: '7px 0', borderBottom: j<2?'1px solid rgba(255,255,255,.05)':'none' }}>{l}</div>
                  ))}
                </div>
              ) : f.crisisCard ? (
                <div>
                  {['111 — emergency','Lifeline 0800 543 354','Text or call 1737'].map((c,j) => (
                    <div key={j} style={{ fontSize: 13, color: j===0?'rgba(248,110,110,.88)':'rgba(223,240,225,.55)', padding: '5px 0', fontFamily: "'Outfit', monospace" }}>{c}</div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, color: 'rgba(223,240,225,.5)', lineHeight: 1.65, fontWeight: 300 }}>{f.body}</div>
                  {f.badge && <span style={{ display: 'inline-block', marginTop: 15, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'rgba(13,153,96,.1)', border: '1px solid rgba(13,153,96,.22)', color: 'rgba(30,220,130,.8)' }}>{f.badge}</span>}
                </>
              )}
            </div>
          ))}
        </div>

        {/* ECOSYSTEM */}
        <div id="ecosystem" style={{ marginBottom: 80 }}>
          <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(200,148,26,.6)', textAlign: 'center', marginBottom: 12 }}>Architecture · Security · Vision</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 300, textAlign: 'center', color: '#dff0e1', marginBottom: 40 }}>The NOVA ecosystem</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }} className="fi4">
            {ECOSYSTEM.map(sec => {
              const isOpen = ecoOpen === sec.id;
              return (
                <div key={sec.id} style={{ ...SP.glass, borderRadius: 17, overflow: 'hidden', transition: 'border-color .25s', ...(isOpen ? { borderColor: 'rgba(200,148,26,.22)' } : {}) }}>
                  <button onClick={() => setEcoOpen(isOpen ? null : sec.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#dff0e1' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,148,26,.08)', border: '1px solid rgba(200,148,26,.15)', color: 'rgba(200,148,26,.8)', fontFamily: "'Cormorant Garamond', serif", fontSize: 15, flexShrink: 0 }}>{sec.icon}</div>
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1, textAlign: 'left', fontFamily: "'Outfit', sans-serif" }}>{sec.label}</span>
                    <span style={{ fontSize: 10, color: 'rgba(200,148,26,.5)', transform: isOpen?'rotate(180deg)':'rotate(0)', transition: 'transform .22s', display: 'inline-block' }}>▼</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sec.items.map(([title, body]) => (
                        <div key={title} style={{ borderRadius: 9, padding: '10px 12px', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(200,148,26,.72)', marginBottom: 4, letterSpacing: '.03em' }}>{title}</div>
                          <div style={{ fontSize: 11, color: 'rgba(223,240,225,.46)', lineHeight: 1.55 }}>{body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer style={{ borderTop: '1px solid rgba(13,153,96,.1)', padding: '36px 0 44px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(223,240,225,.3)', marginBottom: 8, letterSpacing: '.05em' }}>Built by Emanuel Figueroa · Burnett Foundation Aotearoa Innovation Challenge 2026</p>
          <p style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(223,240,225,.18)' }}>NZ Privacy Act 2020 · HIPC 2020 · Te Mana Raraunga · Māori Data Sovereignty · Catalyst Cloud Aotearoa</p>
        </footer>
      </main>

      {/* Consent modal */}
      {!consent && (
        <ConsentModal lang={lang} setLang={setLang} onConsent={onConsent} onDecline={onDecline} />
      )}
    </div>
  );
}
