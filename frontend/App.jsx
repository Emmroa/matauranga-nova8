// ═══════════════════════════════════════════════════════════════════════════
// NOVA — Frontend App (React 19)
// Mātauranga NOVA · Community Health Initiative · Aotearoa NZ
//
// This single file contains:
//   • Router (react-router v7)
//   • AuroraBackground (CSS-only Aurora Borealis HD)
//   • Consent / Onboarding modal (region + language + disclaimers)
//   • ChatBoard (SSE streaming from /api/chat, feedback 👍👎, expand-to-fullscreen)
//   • Home screen and /chat/standalone route
//
// PRIVACY:
//   • Client generates an ephemeral session UUID (crypto.randomUUID())
//     stored only in sessionStorage — cleared when the tab closes.
//   • No analytics libraries, no trackers, no third-party scripts.
//   • Consent is required before any message is sent.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';

// Dashboard is lazy-loaded so the public chat bundle stays small
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));

// ─── i18n strings (minimal, inline — no external i18n dependency) ──────────
const UI = {
  en: {
    appTitle:         'Mātauranga NOVA',
    tagline:          'A private companion for HIV-related kōrero in Aotearoa New Zealand',
    start:            'Start a conversation',
    dashboardLink:    'Dashboard',
    standaloneLink:   'Open standalone view',
    consentTitle:     'Before we begin',
    consentZero:      'This is a private chat. Nothing you type is stored. Only anonymous counts (region, topic, language) are kept — never your words.',
    consentAI:        'NOVA is an AI companion built by Emanuel Figueroa. It is NOT a doctor, nurse or therapist, and does not replace professional care.',
    consentCrisis:    'If you are in immediate danger, please call 111. For 24/7 support: Lifeline 0800 543 354 or text/call 1737.',
    regionLabel:      'To connect you with the most relevant clinical information, which Health NZ region are you in?',
    regionPreferNot:  'Prefer not to say',
    languageLabel:    'Language',
    iAgree:           'I understand — start the chat',
    decline:          'Not now',
    placeholder:      "Share what's on your mind…",
    send:             'Send',
    thinking:         'NOVA is thinking…',
    helpful:          'Helpful',
    notHelpful:       'Not helpful',
    expand:           'Expand',
    collapse:         'Collapse',
    newChat:          'New chat',
    crisisBanner:     'You\'re not alone — Lifeline 0800 543 354 · 1737 · 111 (emergency)',
    madeBy:           'Built by Emanuel Figueroa · Privacy Act 2020 · Zero Data Retention',
    thanks:           'Thanks for the signal.',
    homeBackLink:     'Back to home'
  },
  es: {
    appTitle:         'Mātauranga NOVA',
    tagline:          'Un acompañante privado para conversar sobre VIH en Aotearoa Nueva Zelanda',
    start:            'Iniciar conversación',
    dashboardLink:    'Panel de control',
    standaloneLink:   'Abrir vista independiente',
    consentTitle:     'Antes de comenzar',
    consentZero:      'Esta charla es privada. Nada de lo que escribís se guarda. Solo se conservan contadores anónimos (región, tema, idioma) — nunca tus palabras.',
    consentAI:        'NOVA es una IA companion creada por Emanuel Figueroa. NO es médica, enfermera ni terapeuta, y no reemplaza la atención profesional.',
    consentCrisis:    'Si estás en peligro inmediato, por favor llamá al 111. Para apoyo 24/7: Lifeline 0800 543 354 o mensaje/llamada al 1737.',
    regionLabel:      'Para conectarte con información clínica relevante, ¿en qué región de Health NZ te encontrás?',
    regionPreferNot:  'Prefiero no decirlo',
    languageLabel:    'Idioma',
    iAgree:           'Entiendo — iniciar chat',
    decline:          'Ahora no',
    placeholder:      '¿Qué te pasa?',
    send:             'Enviar',
    thinking:         'NOVA está pensando…',
    helpful:          'Útil',
    notHelpful:       'No útil',
    expand:           'Expandir',
    collapse:         'Reducir',
    newChat:          'Nueva charla',
    crisisBanner:     'No estás solo — Lifeline 0800 543 354 · 1737 · 111 (emergencia)',
    madeBy:           'Creado por Emanuel Figueroa · Privacy Act 2020 · Cero retención de datos',
    thanks:           'Gracias por el feedback.',
    homeBackLink:     'Volver al inicio'
  },
  mi: {
    appTitle:         'Mātauranga NOVA',
    tagline:          'He hoa kōrero tūmataiti mō te HIV i Aotearoa',
    start:            'Tīmata kōrero',
    dashboardLink:    'Papatohu',
    standaloneLink:   'Whakatuwhera te papa kōrero anake',
    consentTitle:     'I mua i te tīmata',
    consentZero:      'He kōrero tūmataiti tēnei. Kāore he mea e tiakina ana o ō kupu. Ko ngā tatauranga muna anake e puritia ana.',
    consentAI:        'He atamai mimitahi a NOVA nā Emanuel Figueroa i hanga. EHARA ia i te tākuta, i te nēhi, i te kaiāwhina. Kāore e whakakapi i te tiaki ngaio.',
    consentCrisis:    'Mēnā he taumaha, tēnā waea ki te 111. Mō te tautoko 24/7: Lifeline 0800 543 354, kuputuhi rānei ki 1737.',
    regionLabel:      'Kei hea koe i Aotearoa?',
    regionPreferNot:  'Kāore au e kī',
    languageLabel:    'Reo',
    iAgree:           'Āe — tīmatahia te kōrero',
    decline:          'Kaore i tēnei wā',
    placeholder:      'He aha tō whakaaro…',
    send:             'Tuku',
    thinking:         'Kei te whakaaro a NOVA…',
    helpful:          'Whaihua',
    notHelpful:       'Kāore i whaihua',
    expand:           'Whakanuia',
    collapse:         'Whakaiti',
    newChat:          'Kōrero hou',
    crisisBanner:     'Kāore koe i te mokemoke — Lifeline 0800 543 354 · 1737 · 111',
    madeBy:           'Nā Emanuel Figueroa i hanga · Privacy Act 2020',
    homeBackLink:     'Hoki ki te kāinga'
  }
};

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'mi', label: 'Te reo Māori' }
];

// ═══════════════════════════════════════════════════════════════════════════
// Session management — ephemeral UUID + consent stored in sessionStorage only
// ═══════════════════════════════════════════════════════════════════════════
const CONSENT_KEY = 'nova.consent.v2';

function loadConsent() {
  try {
    const raw = sessionStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveConsent(obj) {
  try { sessionStorage.setItem(CONSENT_KEY, JSON.stringify(obj)); } catch { /* no-op */ }
}
function clearConsent() {
  try { sessionStorage.removeItem(CONSENT_KEY); } catch { /* no-op */ }
}
function newSessionId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'sid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ═══════════════════════════════════════════════════════════════════════════
// Aurora background component (pure CSS; animation lives in index.css)
// ═══════════════════════════════════════════════════════════════════════════
function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora__band" />
      <div className="aurora__stars" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Crisis numbers strip (visible always in chat)
// ═══════════════════════════════════════════════════════════════════════════
function CrisisStrip({ t }) {
  return (
    <div className="text-xs text-amber-200/80 px-3 py-1.5 rounded-full nova-chip nova-chip-gold inline-flex"
         role="note">
      🌿 {t.crisisBanner}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Consent / Onboarding modal
// ═══════════════════════════════════════════════════════════════════════════
function ConsentModal({ lang, setLang, onConsent, onDecline, regions }) {
  const t = UI[lang];
  const [selectedRegion, setSelectedRegion] = useState('NAT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div className="relative nova-glass-strong w-full max-w-xl p-6 md:p-8 nova-fade-up">
        <div className="flex items-center justify-between mb-3">
          <h2 id="consent-title" className="text-xl md:text-2xl font-semibold text-teal-100">
            {t.consentTitle}
          </h2>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="nova-input !py-1.5 !px-2 !text-xs !w-auto"
            aria-label={t.languageLabel}
          >
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-slate-200/90">
          <p className="flex gap-2">
            <span aria-hidden="true" className="text-teal-300 mt-0.5">🛡️</span>
            <span><strong className="text-teal-200">Zero Data Retention.</strong> {t.consentZero}</span>
          </p>
          <p className="flex gap-2">
            <span aria-hidden="true" className="text-amber-300 mt-0.5">🤖</span>
            <span><strong className="text-amber-200">AI, not a professional.</strong> {t.consentAI}</span>
          </p>
          <p className="flex gap-2">
            <span aria-hidden="true" className="text-rose-300 mt-0.5">🆘</span>
            <span><strong className="text-rose-200">Crisis.</strong> {t.consentCrisis}</span>
          </p>
        </div>

        <div className="mt-6">
          <label className="block text-xs uppercase tracking-wider text-teal-300/70 mb-2"
                 htmlFor="region-select">
            {t.regionLabel}
          </label>
          <select
            id="region-select"
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            className="nova-input"
          >
            {regions.map(r => (
              <option key={r.code} value={r.code}>
                {r.code === 'NAT' ? t.regionPreferNot : `${r.name_en} · ${r.name_mi}`}
                {r.code !== 'NAT' && ` (${r.description.split(',').slice(0, 2).join(',')})`}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-end">
          <button type="button" onClick={onDecline}
                  className="nova-btn nova-btn-ghost"
                  aria-label={t.decline}>
            {t.decline}
          </button>
          <button type="button"
                  onClick={() => onConsent({ regionCode: selectedRegion, language: lang })}
                  className="nova-btn nova-btn-primary"
                  aria-label={t.iAgree}>
            {t.iAgree}
          </button>
        </div>

        <p className="mt-5 text-[10.5px] uppercase tracking-[0.16em] text-center text-teal-300/50 font-mono">
          NZ Privacy Act 2020 · HIPC · Māori Data Sovereignty
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat board — SSE streaming, feedback, expand mode
// ═══════════════════════════════════════════════════════════════════════════
function ChatBoard({ consent, lang, setLang, standalone = false, onReset }) {
  const t = UI[lang];
  const [messages, setMessages] = useState([]);         // { id, role, text, crisis, feedback }
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [expanded, setExpanded] = useState(standalone); // standalone always full-screen
  const [streamingId, setStreamingId] = useState(null);
  const scrollerRef = useRef(null);
  const abortRef    = useRef(null);

  // Autoscroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingId]);

  // Pre-seed with a NOVA greeting in the chosen language
  useEffect(() => {
    const greetings = {
      en: "Kia ora — I'm NOVA. I'm an AI companion built by Emanuel Figueroa for Mātauranga NOVA · Community Health Initiative · Aotearoa NZ. This chat is private — nothing you type is stored. What's on your mind?",
      es: "Hola — soy NOVA. Soy una IA creada por Emanuel Figueroa para Mātauranga NOVA · Iniciativa de Salud Comunitaria · Aotearoa NZ. Esta charla es privada — nada se guarda. ¿Qué te pasa?",
      mi: "Tēnā koe — ko NOVA tōku ingoa. He atamai mimitahi nā Emanuel Figueroa i hanga mō Mātauranga NOVA · Community Health Initiative · Aotearoa NZ. He kōrero tūmataiti tēnei. He aha tō whakaaro?"
    };
    setMessages([{ id: 'sys-' + Date.now(), role: 'assistant', text: greetings[lang] }]);
  }, [lang, consent?.sessionId]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg = { id: 'u-' + Date.now(), role: 'user', text: trimmed };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setSending(true);

    const aiId = 'a-' + Date.now();
    setMessages(m => [...m, { id: aiId, role: 'assistant', text: '', streaming: true }]);
    setStreamingId(aiId);

    const controller = new AbortController();
    abortRef.current = controller;

    // History = last 6 turns without the placeholder
    const history = messages
      .filter(x => !x.streaming && x.text)
      .slice(-6)
      .map(x => ({ role: x.role, content: x.text }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': consent.sessionId
        },
        body: JSON.stringify({
          message:    trimmed,
          sessionId:  consent.sessionId,
          regionCode: consent.regionCode,
          consent:    true,
          history
        }),
        signal: controller.signal
      });
      if (!res.ok && res.status !== 200) {
        const j = await res.json().catch(() => ({ error: 'unknown' }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      // SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let crisis = false;
      let crisisText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // split by \n\n (SSE framing)
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!frame.trim()) continue;

          const lines = frame.split('\n');
          let evt = 'message', data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) evt = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload; try { payload = JSON.parse(data); } catch { continue; }

          if (evt === 'meta') {
            if (payload.crisis) crisis = true;
          } else if (evt === 'crisis_resources') {
            crisisText = payload.text || '';
          } else if (evt === 'token') {
            setMessages(m => m.map(x => x.id === aiId
              ? { ...x, text: (x.text || '') + (payload.t || '') }
              : x));
          } else if (evt === 'fallback') {
            setMessages(m => m.map(x => x.id === aiId
              ? { ...x, text: payload.text, fallback: true }
              : x));
          } else if (evt === 'done') {
            // finalise message
            setMessages(m => m.map(x => x.id === aiId
              ? { ...x, streaming: false, crisis, crisisText: crisisText || null }
              : x));
          }
        }
      }
    } catch (e) {
      setMessages(m => m.map(x => x.id === aiId
        ? { ...x, streaming: false, text: x.text || (
            lang === 'es'
              ? 'Algo falló. Tu mensaje no se guardó en ningún lado. Volvé a intentar en un momento.'
              : lang === 'mi'
              ? 'He raru. Kāore tō kōrero i tiakina. Tēnā whakamātau anō.'
              : "Something went wrong. Your message wasn't stored anywhere. Please try again."
          ), error: true }
        : x));
    } finally {
      setSending(false);
      setStreamingId(null);
      abortRef.current = null;
      setMessages(m => m.map(x => x.id === aiId && x.streaming ? { ...x, streaming: false } : x));
    }
  }, [input, sending, messages, consent, lang]);

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const sendFeedback = async (messageId, rating) => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId:  consent.sessionId,
          regionCode: consent.regionCode,
          rating
        })
      });
      setMessages(m => m.map(x => x.id === messageId ? { ...x, feedback: rating } : x));
    } catch { /* silent */ }
  };

  const resetChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    onReset?.();
  };

  const containerClass = expanded
    ? 'fixed inset-0 z-40 flex flex-col'
    : 'flex flex-col h-[75vh] max-h-[800px] min-h-[500px]';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="nova-glass-strong flex items-center justify-between gap-3 px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500
                          text-slate-900 font-bold flex items-center justify-center nova-pulse shrink-0">
            N
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-teal-100 truncate">NOVA</div>
            <div className="text-[11px] text-teal-300/70 font-mono">
              ● {t.madeBy.split('·')[1]?.trim() || 'Zero Data Retention'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={e => setLang(e.target.value)}
                  className="nova-input !py-1.5 !px-2 !text-xs !w-auto"
                  aria-label={t.languageLabel}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button className="nova-btn nova-btn-ghost !px-3 !py-1.5 text-xs"
                  onClick={resetChat} title={t.newChat} aria-label={t.newChat}>
            ↻
          </button>
          {!standalone && (
            <button className="nova-btn nova-btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() => setExpanded(v => !v)}
                    title={expanded ? t.collapse : t.expand}
                    aria-label={expanded ? t.collapse : t.expand}>
              {expanded ? '⤡' : '⤢'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="nova-glass flex-1 overflow-y-auto px-4 py-5 space-y-4 !rounded-none"
           ref={scrollerRef} aria-live="polite">
        <div className="flex justify-center pb-2"><CrisisStrip t={t} /></div>

        {messages.map(msg => (
          <div key={msg.id}
               className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} nova-fade-up`}>
            <div className={`max-w-[85%] md:max-w-[75%] px-4 py-3 text-[0.94rem] leading-relaxed
                             ${msg.role === 'user' ? 'nova-bubble-user' : 'nova-bubble-ai'}`}>
              {msg.role === 'assistant' && msg.crisis && msg.crisisText && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-400/40 text-rose-100 text-sm">
                  🆘 {msg.crisisText}
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {msg.text || (msg.streaming && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="nova-typing-dot" />
                    <span className="nova-typing-dot" />
                    <span className="nova-typing-dot" />
                    <span className="ml-1 text-teal-200/60 text-xs">{t.thinking}</span>
                  </span>
                ))}
              </div>

              {msg.role === 'assistant' && !msg.streaming && msg.text && !msg.error && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-300/70">
                  <button
                    className={`px-2 py-1 rounded-full transition ${msg.feedback === 1
                      ? 'bg-emerald-500/30 text-emerald-100'
                      : 'hover:bg-white/5'}`}
                    onClick={() => sendFeedback(msg.id,  1)}
                    aria-label={t.helpful}
                    disabled={msg.feedback !== undefined}
                  >👍</button>
                  <button
                    className={`px-2 py-1 rounded-full transition ${msg.feedback === -1
                      ? 'bg-rose-500/30 text-rose-100'
                      : 'hover:bg-white/5'}`}
                    onClick={() => sendFeedback(msg.id, -1)}
                    aria-label={t.notHelpful}
                    disabled={msg.feedback !== undefined}
                  >👎</button>
                  {msg.feedback !== undefined && <span className="ml-1">· {t.thanks}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="nova-glass-strong rounded-b-2xl px-3 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={t.placeholder}
            className="nova-input nova-textarea flex-1"
            aria-label={t.placeholder}
            maxLength={2000}
            disabled={sending}
          />
          <button
            className="nova-btn nova-btn-primary !px-5 shrink-0"
            onClick={send}
            disabled={sending || !input.trim()}
            aria-label={t.send}
          >
            {sending ? '…' : '→'}
          </button>
        </div>
        <div className="mt-1.5 text-[10px] text-teal-300/50 font-mono text-right">
          {input.length}/2000 · Ctrl+Enter {/* visual hint, native Enter also works */}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Home screen
// ═══════════════════════════════════════════════════════════════════════════
function HomeScreen({ lang, setLang, consent, regions, onConsent, onDecline, onResetConsent }) {
  const t = UI[lang];

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />

      <header className="max-w-5xl mx-auto px-5 pt-10 pb-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" aria-label="NOVA home">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500
                          text-slate-900 font-bold flex items-center justify-center shadow-lg
                          group-hover:scale-105 transition">N</div>
          <div className="font-semibold tracking-tight text-teal-50 text-lg">
            Mātauranga <span className="text-teal-300">NOVA</span>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <select value={lang} onChange={e => setLang(e.target.value)}
                  className="nova-input !py-1.5 !px-2 !text-xs !w-auto"
                  aria-label={t.languageLabel}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <Link to="/dashboard" className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3"
                aria-label={t.dashboardLink}>
            {t.dashboardLink}
          </Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-5 pt-4 pb-16">
        {/* Hero */}
        <section className="text-center mt-6 mb-10 nova-fade-up">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight text-teal-50">
            {t.appTitle}
          </h1>
          <p className="mt-3 text-lg md:text-xl text-teal-100/70 max-w-2xl mx-auto">
            {t.tagline}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/chat" className="nova-btn nova-btn-primary text-base !px-6 !py-3">
              {t.start}
            </Link>
            <Link to="/chat/standalone" className="nova-btn nova-btn-ghost text-sm">
              {t.standaloneLink} ↗
            </Link>
          </div>
        </section>

        {/* Trust trio */}
        <section className="grid md:grid-cols-3 gap-4 mt-10">
          <div className="nova-card text-sm text-slate-200/90">
            <div className="text-2xl mb-2">🛡️</div>
            <div className="font-semibold text-teal-100 mb-1">Zero Data Retention</div>
            <p className="text-slate-300/80">
              {lang === 'es' ? 'Tus palabras no se guardan. Solo contadores anónimos por región y tema.'
               : lang === 'mi' ? 'Kāore ō kupu e tiakina. Ngā tatauranga muna anake.'
               : 'Your words are not stored. Only anonymous counters per region and topic.'}
            </p>
          </div>
          <div className="nova-card text-sm text-slate-200/90">
            <div className="text-2xl mb-2">🌿</div>
            <div className="font-semibold text-teal-100 mb-1">Te Whare Tapa Whā</div>
            <p className="text-slate-300/80">
              {lang === 'es' ? 'Atención culturalmente segura que honra taha tinana, hinengaro, wairua y whānau.'
               : lang === 'mi' ? 'He tiakitanga haumaru ā-ahurea — taha tinana, hinengaro, wairua, whānau.'
               : 'Culturally safe care honouring taha tinana, hinengaro, wairua and whānau.'}
            </p>
          </div>
          <div className="nova-card text-sm text-slate-200/90">
            <div className="text-2xl mb-2">🇳🇿</div>
            <div className="font-semibold text-teal-100 mb-1">Sovereign AI</div>
            <p className="text-slate-300/80">
              {lang === 'es' ? 'Todo el procesamiento sucede en Aotearoa. Nada sale del país.'
               : lang === 'mi' ? 'Kei Aotearoa katoa te tukatuka. Kāore he mea e puta ki waho.'
               : 'All processing happens in Aotearoa. Nothing leaves the country.'}
            </p>
          </div>
        </section>

        {/* Crisis strip */}
        <section className="mt-10 flex justify-center">
          <CrisisStrip t={t} />
        </section>

        <footer className="mt-16 text-center text-xs text-teal-300/50 font-mono">
          {t.madeBy}
        </footer>
      </main>

      {!consent && !loadConsent() && (
        <ConsentModal
          lang={lang} setLang={setLang}
          regions={regions}
          onConsent={onConsent}
          onDecline={onDecline}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat routes
// ═══════════════════════════════════════════════════════════════════════════
function ChatRoute({ consent, lang, setLang, regions, onConsent, onDecline, standalone = false }) {
  const navigate = useNavigate();
  const t = UI[lang];

  if (!consent) {
    return (
      <div className="min-h-screen relative">
        <AuroraBackground />
        <ConsentModal
          lang={lang} setLang={setLang}
          regions={regions}
          onConsent={onConsent}
          onDecline={() => { onDecline(); navigate('/'); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />
      <div className={standalone ? 'h-screen flex flex-col' : 'max-w-3xl mx-auto px-3 md:px-5 py-6'}>
        {!standalone && (
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="text-sm text-teal-300/80 hover:text-teal-200 flex items-center gap-1">
              ← {t.homeBackLink}
            </Link>
            <Link to="/chat/standalone" className="text-xs text-teal-300/60 hover:text-teal-200">
              {t.standaloneLink} ↗
            </Link>
          </div>
        )}
        <ChatBoard
          consent={consent} lang={lang} setLang={setLang}
          standalone={standalone}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Top-level App
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [lang, setLang] = useState(() => {
    const saved = loadConsent();
    if (saved?.language) return saved.language;
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('mi')) return 'mi';
    return 'en';
  });
  const [consent, setConsent]   = useState(() => loadConsent());
  const [regions, setRegions]   = useState([]);
  const [metaLoaded, setMetaLoaded] = useState(false);

  // Load metadata (regions list) from backend
  useEffect(() => {
    fetch('/api/metadata')
      .then(r => r.json())
      .then(j => {
        if (Array.isArray(j?.regions)) setRegions(j.regions);
        setMetaLoaded(true);
      })
      .catch(() => {
        // Fallback client-side regions if backend unreachable
        setRegions([
          { code: 'NTH', name_en: 'Northern',          name_mi: 'Te Tai Tokerau ki Tāmaki', description: 'Northland, Waitematā, Auckland, Counties Manukau' },
          { code: 'MID', name_en: 'Midland',           name_mi: 'Te Manawa Taki',           description: 'Waikato, Bay of Plenty, Tairāwhiti, Taranaki, Lakes' },
          { code: 'CEN', name_en: 'Central',           name_mi: 'Te Ikaroa',                description: 'MidCentral, Whanganui, Capital & Coast, Hutt, Hawke\'s Bay, Wairarapa' },
          { code: 'STH', name_en: 'Southern',          name_mi: 'Te Waipounamu',            description: 'Nelson Marlborough, West Coast, Canterbury, South Canterbury, Southern' },
          { code: 'NAT', name_en: 'Prefer not to say', name_mi: 'Kāore au e kī',            description: '' }
        ]);
        setMetaLoaded(true);
      });
  }, []);

  const handleConsent = useCallback(({ regionCode, language }) => {
    const payload = {
      sessionId: newSessionId(),
      regionCode,
      language,
      consentedAt: new Date().toISOString()
    };
    saveConsent(payload);
    setConsent(payload);
    setLang(language);
  }, []);

  const handleDecline = useCallback(() => {
    clearConsent();
    setConsent(null);
  }, []);

  const resetConsent = useCallback(() => {
    clearConsent();
    setConsent(null);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <HomeScreen
            lang={lang} setLang={setLang}
            consent={consent} regions={regions}
            onConsent={handleConsent} onDecline={handleDecline}
            onResetConsent={resetConsent}
          />
        } />
        <Route path="/chat" element={
          <ChatRoute
            consent={consent} lang={lang} setLang={setLang}
            regions={regions}
            onConsent={handleConsent} onDecline={handleDecline}
          />
        } />
        <Route path="/chat/standalone" element={
          <ChatRoute
            consent={consent} lang={lang} setLang={setLang}
            regions={regions}
            onConsent={handleConsent} onDecline={handleDecline}
            standalone
          />
        } />
        <Route path="/dashboard" element={
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-teal-200">Loading dashboard…</div>}>
            <Dashboard lang={lang} setLang={setLang} />
          </Suspense>
        } />
        <Route path="*" element={
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 relative">
            <AuroraBackground />
            <div className="nova-glass-strong px-6 py-8 text-center">
              <div className="text-5xl text-amber-400 font-mono">404</div>
              <p className="mt-2 text-teal-100">Page not found · Kāore e kitea</p>
              <Link to="/" className="mt-4 inline-block nova-btn nova-btn-primary">← Home</Link>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
