/**
 * Mātauranga NOVA — Widget v9
 * Burnett Foundation Innovation Challenge 2026
 *
 * Features:
 *  - Dark mode by default
 *  - Streaming SSE with real-time Markdown rendering (marked.js)
 *  - Proactive consent banner (NZ Privacy Act 2020)
 *  - Zero-typing quick-start buttons
 *  - Quick Exit button (session wipe + tab close)
 *  - Session timer: warn at 4:30, auto-close at 5:00
 *  - Smooth message entry animations
 *  - Mobile-responsive
 */

(function () {
  'use strict';

  // ── Config (overridable via data attributes) ──────────────
  const script       = document.currentScript || {};
  const NOVA_BASE    = (script.getAttribute && script.getAttribute('src')
    ? new URL(script.getAttribute('src'), location.href).origin
    : '') || '';
  const DATA_LANG    = (script.getAttribute && script.getAttribute('data-lang'))    || 'auto';
  const DATA_CONSENT = (script.getAttribute && script.getAttribute('data-consent')) !== 'false';
  const DATA_ANALYTICS = (script.getAttribute && script.getAttribute('data-analytics')) !== 'false';

  // ── Session state ─────────────────────────────────────────
  let sessionId        = null;
  let sessionTimerInterval = null;
  let sessionStartTime = null;
  let warnShown        = false;
  const SESSION_WARN_MS  = 4.5 * 60 * 1000;
  const SESSION_CLOSE_MS = 5 * 60 * 1000;
  let lastActivity     = Date.now();

  // ── Detect language ───────────────────────────────────────
  function detectLang() {
    if (DATA_LANG !== 'auto') return DATA_LANG;
    const l = navigator.language || 'en';
    if (l.startsWith('mi')) return 'mi';
    if (l.startsWith('es')) return 'es';
    return 'en';
  }
  let lang = detectLang();

  // ── Translations ──────────────────────────────────────────
  const T = {
    en: {
      title:         'Mātauranga-NOVA',
      subtitle:      '● Online · He Hoa Kōrero',
      placeholder:   'Type a message…',
      send:          '→',
      quick_exit:    '✕ Quick Exit',
      consent_title: 'Your Privacy Matters',
      consent_body:  'This chat is <strong>private by design</strong>. When you close it, everything is deleted — nothing is stored on our servers long-term.\n\nAnonymous usage data (topics discussed, language) is counted to help improve HIV support in Aotearoa. Your words are never saved or shared.\n\n<em>Processed via Anthropic API (30-day security retention) · NZ Privacy Act 2020</em>',
      consent_btn:   'I understand — start chat',
      welcome:       'Kia ora — I\'m NOVA 🌿\n\nI\'m here to support you with HIV questions, PrEP info, mental health, rights — whatever\'s on your mind. Warm, no judgment, totally private.\n\n*What brings you here today?*',
      warn_title:    '⏱ Still there?',
      warn_body:     'This session will close in 30 seconds to protect your privacy.',
      warn_stay:     'Keep chatting',
      closed_msg:    'Session closed for your privacy. Refresh to start a new chat.',
      q1: 'I just got a positive result',
      q2: 'Tell me about PrEP',
      q3: 'I\'m feeling really alone',
      q4: 'U=U — what does it mean?',
      q5: 'I need to tell someone',
      q6: 'Chemsex — keeping safe',
    },
    es: {
      title:         'Mātauranga-NOVA',
      subtitle:      '● En línea · Apoyo VIH',
      placeholder:   'Escribí un mensaje…',
      send:          '→',
      quick_exit:    '✕ Salida rápida',
      consent_title: 'Tu privacidad importa',
      consent_body:  'Este chat es <strong>privado por diseño</strong>. Al cerrarlo, todo se elimina — nada queda guardado a largo plazo.\n\nSólo se cuentan datos anónimos (temas, idioma) para mejorar el apoyo al VIH en Aotearoa. Tus palabras nunca se guardan ni comparten.\n\n<em>Procesado vía API de Anthropic (retención de seguridad 30 días) · NZ Privacy Act 2020</em>',
      consent_btn:   'Entiendo — empezar chat',
      welcome:       'Kia ora — soy NOVA 🌿\n\nEstoy aquí para apoyarte con preguntas sobre VIH, PrEP, salud mental, derechos — lo que necesites. Cálido, sin juicio, totalmente privado.\n\n*¿Qué te trae por aquí hoy?*',
      warn_title:    '⏱ ¿Seguís ahí?',
      warn_body:     'Esta sesión se cerrará en 30 segundos para proteger tu privacidad.',
      warn_stay:     'Continuar charlando',
      closed_msg:    'Sesión cerrada por privacidad. Recargá para iniciar un nuevo chat.',
      q1: 'Me acabo de enterar que soy positivo/a',
      q2: 'Quiero saber sobre PrEP',
      q3: 'Me siento muy solo/a',
      q4: '¿Qué significa I=I?',
      q5: 'Necesito contarle a alguien',
      q6: 'Chemsex — cuidarme',
    },
    mi: {
      title:         'Mātauranga-NOVA',
      subtitle:      '● Ora · He Hoa Kōrero',
      placeholder:   'Tuhia he karere…',
      send:          '→',
      quick_exit:    '✕ Putanga Tere',
      consent_title: 'He Tapu Tō Tūmataiti',
      consent_body:  'He <strong>tūmataiti tēnei kōrero</strong>. Ina kati, ka mukua katoa — kāore he kōrero e tiakina ana.\n\nKa kaupeka noa ngā raraunga āhuatanga (kaupapa, reo) hei awhina i te tautoko HIV i Aotearoa.\n\n<em>Anthropic API · Ture Tūmataiti Aotearoa 2020</em>',
      consent_btn:   'Ka mārama ahau — tīmata',
      welcome:       'Kia ora — ko NOVA ahau 🌿\n\nKei konei ahau mō ngā pātai HIV, PrEP, hauora hinengaro, motika — mō ō hiahia katoa. Maioha, kāore he whakawā, he tūmataiti.\n\n*He aha te take i haere mai ai koe inaianei?*',
      warn_title:    '⏱ Kei konei tonu koe?',
      warn_body:     'Ka kati tēnei wā i roto i te 30 hēkona hei tiaki i tō tūmataiti.',
      warn_stay:     'Haere tonu',
      closed_msg:    'Kua katia te wā. Tāutuhia anō mō tētahi kōrero hou.',
      q1: 'I kitea he hua tōrino',
      q2: 'Kōrero mai mō PrEP',
      q3: 'He mokemoke tōku ngākau',
      q4: 'He aha te tikanga o U=U?',
      q5: 'Me kōrero ahau ki tētahi',
      q6: 'Chemsex — haumaru',
    },
  };

  function t(key) { return (T[lang] && T[lang][key]) || T.en[key] || key; }

  // ── Inject marked.js for Markdown rendering ───────────────
  function loadMarked(cb) {
    if (window.marked) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
    s.onload = cb;
    s.onerror = () => { window.marked = { parse: txt => txt.replace(/\n/g, '<br>') }; cb(); };
    document.head.appendChild(s);
  }

  function renderMarkdown(text) {
    if (window.marked && window.marked.parse) {
      try { return window.marked.parse(text, { breaks: true, gfm: true }); }
      catch { return text.replace(/\n/g, '<br>'); }
    }
    return text.replace(/\n/g, '<br>');
  }

  // ── Styles ────────────────────────────────────────────────
  const STYLES = `
    :root {
      --nova-bg:       #080e18;
      --nova-bg2:      #0d1525;
      --nova-bg3:      #111d2e;
      --nova-card:     #141f33;
      --nova-bdr:      rgba(255,255,255,.08);
      --nova-txt:      #e8eef6;
      --nova-dim:      #6b7c9a;
      --nova-teal:     #0ea5e9;
      --nova-em:       #10b981;
      --nova-gold:     #f59e0b;
      --nova-red:      #ef4444;
      --nova-purple:   #a855f7;
      --nova-radius:   12px;
      --nova-shadow:   0 32px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(14,165,233,.12);
    }

    #nova-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 999998;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, var(--nova-teal), #0284c7);
      color: #fff; border: none; cursor: pointer; font-size: 26px;
      box-shadow: 0 8px 32px rgba(14,165,233,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .25s, box-shadow .25s;
      font-family: system-ui, sans-serif;
    }
    #nova-fab:hover { transform: scale(1.1); box-shadow: 0 12px 40px rgba(14,165,233,.6); }

    #nova-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.55);
      z-index: 999998; display: none;
      backdrop-filter: blur(3px);
    }
    #nova-overlay.on { display: block; }

    #nova-win {
      position: fixed; bottom: 24px; right: 24px;
      width: 400px; height: 600px; max-height: calc(100vh - 48px);
      background: var(--nova-bg);
      border: 1px solid var(--nova-bdr);
      border-radius: var(--nova-radius);
      box-shadow: var(--nova-shadow);
      z-index: 999999;
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Sora', 'Segoe UI', system-ui, sans-serif;
      color: var(--nova-txt);
      animation: nova-slideUp .3s cubic-bezier(.16,1,.3,1) forwards;
    }
    #nova-win.on { display: flex; }

    @keyframes nova-slideUp {
      from { opacity: 0; transform: translateY(24px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    #nova-hdr {
      background: var(--nova-bg2);
      padding: 12px 14px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid var(--nova-bdr);
      flex-shrink: 0;
    }
    .nova-av {
      width: 34px; height: 34px; background: var(--nova-teal);
      border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-weight: 700; font-size: 14px;
      color: var(--nova-bg); flex-shrink: 0;
    }
    .nova-hdr-info { flex: 1; min-width: 0; }
    .nova-hdr-name { font-size: 13px; font-weight: 600; }
    .nova-hdr-status { font-size: 10px; color: var(--nova-em); letter-spacing: .5px; }
    .nova-exit-btn {
      background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3);
      color: var(--nova-red); padding: 6px 10px; border-radius: 5px;
      font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;
      letter-spacing: .5px; font-family: inherit;
      transition: background .2s;
    }
    .nova-exit-btn:hover { background: rgba(239,68,68,.28); }

    /* Timer bar */
    #nova-timer-bar {
      height: 3px; background: var(--nova-teal);
      transition: width 1s linear, background .5s;
      flex-shrink: 0;
    }
    #nova-timer-bar.warn { background: var(--nova-gold); }
    #nova-timer-bar.danger { background: var(--nova-red); animation: nova-pulse 1s infinite; }
    @keyframes nova-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

    /* Body */
    #nova-body {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #nova-body::-webkit-scrollbar { width: 4px; }
    #nova-body::-webkit-scrollbar-track { background: transparent; }
    #nova-body::-webkit-scrollbar-thumb { background: var(--nova-bdr); border-radius: 4px; }

    /* Messages */
    .nova-msg {
      max-width: 88%; animation: nova-msgIn .25s cubic-bezier(.16,1,.3,1) forwards;
      opacity: 0;
    }
    @keyframes nova-msgIn {
      from { opacity: 0; transform: translateY(10px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .nova-msg.bot { align-self: flex-start; }
    .nova-msg.user { align-self: flex-end; }
    .nova-bubble {
      padding: 10px 14px; border-radius: 10px;
      font-size: 13px; line-height: 1.6;
    }
    .nova-msg.bot  .nova-bubble {
      background: rgba(14,165,233,.1); border: 1px solid rgba(14,165,233,.2);
      border-radius: 4px 10px 10px 10px; color: var(--nova-txt);
    }
    .nova-msg.user .nova-bubble {
      background: var(--nova-teal); color: #fff;
      border-radius: 10px 4px 10px 10px;
    }
    .nova-msg.crisis .nova-bubble {
      background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25);
      border-left: 3px solid var(--nova-red); border-radius: 4px 10px 10px 10px;
    }
    /* Markdown inside bubbles */
    .nova-bubble p  { margin: 0 0 6px; }
    .nova-bubble p:last-child { margin: 0; }
    .nova-bubble ul, .nova-bubble ol { margin: 6px 0; padding-left: 18px; }
    .nova-bubble li { margin-bottom: 3px; }
    .nova-bubble strong { color: var(--nova-gold); }
    .nova-bubble em    { color: var(--nova-dim); font-style: italic; }
    .nova-bubble code  { background: rgba(255,255,255,.08); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
    .nova-bubble hr    { border: none; border-top: 1px solid var(--nova-bdr); margin: 8px 0; }

    /* Typing indicator */
    .nova-typing span {
      display: inline-block; width: 6px; height: 6px;
      background: var(--nova-teal); border-radius: 50%; margin: 0 2px;
      animation: nova-blink 1.2s ease infinite;
    }
    .nova-typing span:nth-child(2) { animation-delay: .2s; }
    .nova-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes nova-blink { 0%,100%{opacity:1} 50%{opacity:.25} }

    /* Quick buttons */
    #nova-quick {
      padding: 8px 10px; border-top: 1px solid var(--nova-bdr);
      display: flex; flex-wrap: wrap; gap: 5px;
      background: rgba(8,14,24,.8); flex-shrink: 0;
    }
    .nova-q {
      padding: 6px 10px; border: 1px solid rgba(14,165,233,.25);
      background: rgba(14,165,233,.07); border-radius: 14px;
      font-size: 10px; color: var(--nova-teal); cursor: pointer;
      font-family: 'DM Mono', 'Courier New', monospace;
      transition: all .2s; white-space: nowrap;
    }
    .nova-q:hover { background: rgba(14,165,233,.18); border-color: rgba(14,165,233,.5); }

    /* Input row */
    #nova-inp-row {
      padding: 10px 12px; border-top: 1px solid var(--nova-bdr);
      display: flex; gap: 8px; background: var(--nova-bg2); flex-shrink: 0;
    }
    #nova-inp {
      flex: 1; background: rgba(255,255,255,.05);
      border: 1px solid var(--nova-bdr); color: var(--nova-txt);
      padding: 10px 14px; border-radius: 6px;
      font-size: 13px; font-family: inherit; outline: none;
      min-height: 40px; transition: border-color .2s;
    }
    #nova-inp:focus { border-color: rgba(14,165,233,.45); }
    #nova-send {
      background: var(--nova-teal); color: #fff; border: none;
      padding: 0 16px; border-radius: 6px; cursor: pointer;
      font-size: 18px; font-weight: 700; min-width: 46px; min-height: 40px;
      transition: background .2s;
    }
    #nova-send:hover { background: #0284c7; }
    #nova-send:disabled { opacity: .5; cursor: not-allowed; }

    /* Consent overlay */
    #nova-consent {
      position: absolute; inset: 0; z-index: 10;
      background: rgba(8,14,24,.97);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 28px 24px; text-align: center;
      border-radius: var(--nova-radius);
    }
    .nova-consent-icon { font-size: 36px; margin-bottom: 14px; }
    .nova-consent-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--nova-teal); }
    .nova-consent-body {
      font-size: 12px; color: var(--nova-dim); line-height: 1.85;
      margin-bottom: 20px; text-align: left;
      background: rgba(255,255,255,.04); border: 1px solid var(--nova-bdr);
      border-radius: 8px; padding: 14px;
    }
    .nova-consent-body strong { color: var(--nova-txt); }
    .nova-consent-body em     { color: var(--nova-dim); font-size: 11px; }
    .nova-consent-btn {
      background: var(--nova-teal); color: #fff; border: none;
      padding: 13px 24px; border-radius: 7px; cursor: pointer;
      font-size: 12px; font-weight: 600; letter-spacing: .5px;
      font-family: inherit; width: 100%; transition: background .2s;
    }
    .nova-consent-btn:hover { background: #0284c7; }

    /* Warn modal */
    #nova-warn {
      position: absolute; inset: 0; z-index: 11;
      background: rgba(8,14,24,.92);
      display: none; flex-direction: column; align-items: center;
      justify-content: center; padding: 28px; text-align: center;
      border-radius: var(--nova-radius);
    }
    #nova-warn.on { display: flex; }
    .nova-warn-title { font-size: 18px; font-weight: 700; margin-bottom: 10px; color: var(--nova-gold); }
    .nova-warn-body  { font-size: 13px; color: var(--nova-dim); margin-bottom: 20px; line-height: 1.7; }
    .nova-warn-btn {
      background: var(--nova-em); color: #fff; border: none;
      padding: 12px 28px; border-radius: 7px; cursor: pointer;
      font-size: 12px; font-weight: 600; font-family: inherit;
    }

    @media (max-width: 460px) {
      #nova-win {
        width: calc(100vw - 16px); right: 8px; bottom: 8px;
        height: calc(100vh - 16px); max-height: none;
      }
    }
  `;

  // ── Inject styles ─────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // ── Build DOM ─────────────────────────────────────────────
  // FAB button
  const fab = document.createElement('button');
  fab.id = 'nova-fab';
  fab.innerHTML = '🤖';
  fab.setAttribute('aria-label', 'Open NOVA chat');
  document.body.appendChild(fab);

  // Dark overlay (mobile)
  const overlay = document.createElement('div');
  overlay.id = 'nova-overlay';
  document.body.appendChild(overlay);

  // Chat window
  const win = document.createElement('div');
  win.id = 'nova-win';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'NOVA HIV Companion Chat');
  win.innerHTML = `
    <!-- Consent overlay -->
    <div id="nova-consent">
      <div class="nova-consent-icon">🔒</div>
      <div class="nova-consent-title">${t('consent_title')}</div>
      <div class="nova-consent-body">${t('consent_body').replace(/\n/g, '<br>')}</div>
      <button class="nova-consent-btn" id="nova-consent-btn">${t('consent_btn')}</button>
    </div>

    <!-- Warn overlay -->
    <div id="nova-warn">
      <div class="nova-warn-title">${t('warn_title')}</div>
      <div class="nova-warn-body">${t('warn_body')}</div>
      <button class="nova-warn-btn" id="nova-warn-stay">${t('warn_stay')}</button>
    </div>

    <!-- Header -->
    <div id="nova-hdr">
      <div class="nova-av">N</div>
      <div class="nova-hdr-info">
        <div class="nova-hdr-name">${t('title')}</div>
        <div class="nova-hdr-status">${t('subtitle')}</div>
      </div>
      <button class="nova-exit-btn" id="nova-exit-btn">${t('quick_exit')}</button>
    </div>

    <!-- Timer bar -->
    <div id="nova-timer-bar" style="width:100%"></div>

    <!-- Messages -->
    <div id="nova-body"></div>

    <!-- Quick questions -->
    <div id="nova-quick">
      <button class="nova-q" data-msg="${t('q1')}">${t('q1')}</button>
      <button class="nova-q" data-msg="${t('q2')}">${t('q2')}</button>
      <button class="nova-q" data-msg="${t('q3')}">${t('q3')}</button>
      <button class="nova-q" data-msg="${t('q4')}">${t('q4')}</button>
      <button class="nova-q" data-msg="${t('q5')}">${t('q5')}</button>
      <button class="nova-q" data-msg="${t('q6')}">${t('q6')}</button>
    </div>

    <!-- Input -->
    <div id="nova-inp-row">
      <input id="nova-inp" type="text" placeholder="${t('placeholder')}" autocomplete="off" maxlength="2000" />
      <button id="nova-send" aria-label="Send">${t('send')}</button>
    </div>
  `;
  document.body.appendChild(win);

  // ── Element refs ──────────────────────────────────────────
  const body       = win.querySelector('#nova-body');
  const inp        = win.querySelector('#nova-inp');
  const sendBtn    = win.querySelector('#nova-send');
  const timerBar   = win.querySelector('#nova-timer-bar');
  const consentEl  = win.querySelector('#nova-consent');
  const warnEl     = win.querySelector('#nova-warn');
  const exitBtn    = win.querySelector('#nova-exit-btn');
  const consentBtn = win.querySelector('#nova-consent-btn');
  const warnStay   = win.querySelector('#nova-warn-stay');

  // ── Helpers ───────────────────────────────────────────────
  function scrollBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function addMessage(role, html, isCrisis) {
    const wrap   = document.createElement('div');
    wrap.className = `nova-msg ${role}${isCrisis ? ' crisis' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = 'nova-bubble';
    bubble.innerHTML = html;
    wrap.appendChild(bubble);
    body.appendChild(wrap);
    scrollBottom();
    return bubble;
  }

  function showTyping() {
    const wrap   = document.createElement('div');
    wrap.className = 'nova-msg bot';
    wrap.id = 'nova-typing';
    const bubble = document.createElement('div');
    bubble.className = 'nova-bubble nova-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(bubble);
    body.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function removeTyping() {
    const t = document.getElementById('nova-typing');
    if (t) t.remove();
  }

  // ── Session timer ─────────────────────────────────────────
  function resetActivity() { lastActivity = Date.now(); }

  function updateTimerBar() {
    const elapsed  = Date.now() - lastActivity;
    const pct      = Math.min(100, (elapsed / SESSION_CLOSE_MS) * 100);
    const remaining = Math.max(0, 100 - pct);
    timerBar.style.width = remaining + '%';

    if (elapsed >= SESSION_WARN_MS && !warnShown) {
      warnShown = true;
      timerBar.classList.add('warn');
      warnEl.classList.add('on');
    }
    if (elapsed >= SESSION_CLOSE_MS) {
      clearInterval(sessionTimerInterval);
      closeSession(true);
    }
    if (elapsed > SESSION_WARN_MS * 0.8) timerBar.classList.add('danger');
  }

  function startSessionTimer() {
    sessionTimerInterval = setInterval(updateTimerBar, 1000);
  }

  warnStay.addEventListener('click', () => {
    resetActivity();
    warnShown = false;
    warnEl.classList.remove('on');
    timerBar.classList.remove('warn', 'danger');
    timerBar.style.width = '100%';
  });

  // ── Quick Exit (L3 zero-retention enforcement) ────────────
  function closeSession(autoClose) {
    // Notify server to wipe session
    if (sessionId) {
      navigator.sendBeacon(NOVA_BASE + '/session-end', JSON.stringify({ sessionId }));
      sessionId = null;
    }
    sessionStorage.removeItem('nova_sid');
    clearInterval(sessionTimerInterval);

    body.innerHTML = '';
    addMessage('bot', `<em>${t('closed_msg')}</em>`);
    inp.disabled      = true;
    sendBtn.disabled  = true;
    win.querySelectorAll('.nova-q').forEach(q => q.disabled = true);

    if (autoClose) {
      // Auto-close after showing message
      setTimeout(() => toggleChat(false), 3000);
    }
  }

  exitBtn.addEventListener('click', () => {
    closeSession(false);
    toggleChat(false);
    // Attempt to close tab (works in some contexts)
    try { window.close(); } catch { /* noop */ }
  });

  // ── Chat open/close ───────────────────────────────────────
  let isOpen = false;
  function toggleChat(force) {
    isOpen = typeof force === 'boolean' ? force : !isOpen;
    win.classList.toggle('on', isOpen);
    overlay.classList.toggle('on', isOpen);
    fab.style.display = isOpen ? 'none' : 'flex';
    if (isOpen) {
      setTimeout(() => inp.focus(), 200);
      resetActivity();
    }
  }

  fab.addEventListener('click', () => toggleChat(true));
  overlay.addEventListener('click', () => toggleChat(false));

  // ── Session start ─────────────────────────────────────────
  async function startSession() {
    try {
      const r = await fetch(NOVA_BASE + '/session-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const d = await r.json();
      sessionId = d.sessionId;
      sessionStorage.setItem('nova_sid', sessionId);
      startSessionTimer();
    } catch {
      console.warn('[NOVA] Could not start session');
      startSessionTimer(); // still run timer
    }
  }

  // ── Consent flow ──────────────────────────────────────────
  function hasConsented() { return localStorage.getItem('nova_consent') === '1'; }
  function setConsented()  { localStorage.setItem('nova_consent', '1'); }

  function showWelcome() {
    loadMarked(() => {
      addMessage('bot', renderMarkdown(t('welcome')));
    });
  }

  consentBtn.addEventListener('click', async () => {
    setConsented();
    consentEl.style.display = 'none';
    showWelcome();
    await startSession();
  });

  // Skip consent if already given
  if (!DATA_CONSENT || hasConsented()) {
    consentEl.style.display = 'none';
    loadMarked(() => {
      // Show welcome after short delay for animation
      setTimeout(showWelcome, 100);
    });
    startSession();
  }

  // ── Send message ──────────────────────────────────────────
  async function sendMessage(text) {
    const msg = (text || inp.value).trim();
    if (!msg) return;
    inp.value    = '';
    sendBtn.disabled = true;
    resetActivity();

    addMessage('user', escHtml(msg));
    const typingEl = showTyping();

    try {
      const resp = await fetch(NOVA_BASE + '/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId }),
      });

      // Non-streaming crisis response
      if (resp.headers.get('content-type')?.includes('application/json')) {
        removeTyping();
        const d = await resp.json();
        addMessage('bot', renderMarkdown(d.reply || ''), d.crisis);
        sendBtn.disabled = false;
        return;
      }

      // Streaming SSE
      removeTyping();
      const bubble = addMessage('bot', '').parentElement?.querySelector('.nova-bubble');
      if (!bubble) { sendBtn.disabled = false; return; }

      let streamedText = '';
      const reader     = resp.body?.getReader();
      const decoder    = new TextDecoder();

      if (!reader) throw new Error('No reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'delta') {
              streamedText += parsed.text;
              bubble.innerHTML = renderMarkdown(streamedText);
              scrollBottom();
            } else if (parsed.type === 'replace') {
              streamedText = parsed.text;
              bubble.innerHTML = renderMarkdown(streamedText);
              scrollBottom();
            } else if (parsed.type === 'done') {
              break;
            }
          } catch { /* skip */ }
        }
      }

    } catch (err) {
      removeTyping();
      addMessage('bot', `<em>Connection error. For urgent support: <strong>Lifeline 0800 543 354</strong> or <strong>1737</strong>.</em>`, false);
    }

    sendBtn.disabled = false;
    scrollBottom();
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  sendBtn.addEventListener('click', () => sendMessage());
  inp.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  inp.addEventListener('input',    resetActivity);

  win.querySelectorAll('.nova-q').forEach(q => {
    q.addEventListener('click', () => {
      const msg = q.getAttribute('data-msg');
      if (msg) sendMessage(msg);
    });
  });

  // ── Expose public API ──────────────────────────────────────
  window.NOVA = {
    open:  () => toggleChat(true),
    close: () => toggleChat(false),
    exit:  () => { closeSession(false); toggleChat(false); },
    send:  sendMessage,
  };

})();
