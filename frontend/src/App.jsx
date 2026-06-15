// ═══════════════════════════════════════════════════════════════════════════
// App.jsx — NOVA Root Router
// Mātauranga NOVA · Community Health Initiative · Aotearoa NZ
//
// Routes:
//   /             → Landing.jsx   (home page + consent)
//   /chat         → Chat.jsx      (private conversation)
//   /dashboard    → Dashboard.jsx (admin analytics — lazy loaded)
//   *             → 404 redirect to /
//
// Consent state lives here and is passed down to Landing and Chat.
// Language state lives here and syncs across all routes.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Landing from './Landing.jsx';
import Chat    from './Chat.jsx';
import { loadConsent, saveConsent, clearConsent, newSessionId } from './shared/nova.js';

// Dashboard is lazy-loaded so the public bundle stays small
// Place your Dashboard component at: src/components/Dashboard.jsx
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));

// ─── Dashboard loading fallback ────────────────────────────────────────────
function DashboardLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#010d03', fontFamily: "'Outfit', sans-serif",
    }}>
      <div style={{
        background: 'linear-gradient(158deg,rgba(2,16,7,.66),rgba(1,12,5,.56))',
        backdropFilter: 'blur(52px) saturate(190%)',
        WebkitBackdropFilter: 'blur(52px) saturate(190%)',
        border: '1px solid rgba(13,153,96,.18)',
        borderRadius: 16, padding: '20px 32px',
        color: 'rgba(223,240,225,.7)', fontSize: 14, letterSpacing: '.04em',
      }}>
        ● Loading dashboard…
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  // ── Language — auto-detect from browser, persist in consent ────────────
  const [lang, setLang] = useState(() => {
    const saved = loadConsent();
    if (saved?.language) return saved.language;
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('mi')) return 'mi';
    return 'en';
  });

  // ── Consent — ephemeral in sessionStorage (cleared on tab close) ────────
  const [consent, setConsent] = useState(() => loadConsent());

  // Sync lang into consent whenever it changes
  useEffect(() => {
    if (consent) {
      const updated = { ...consent, language: lang };
      saveConsent(updated);
      setConsent(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleSetLang = useCallback((l) => {
    setLang(l);
  }, []);

  // ── Consent handlers ────────────────────────────────────────────────────
  const handleConsent = useCallback(({ regionCode, language }) => {
    const payload = {
      sessionId:   newSessionId(),
      regionCode:  regionCode || 'NAT',
      language:    language   || lang,
      consentedAt: new Date().toISOString(),
    };
    saveConsent(payload);
    setConsent(payload);
    setLang(payload.language);
  }, [lang]);

  const handleDecline = useCallback(() => {
    clearConsent();
    setConsent(null);
  }, []);

  return (
    <BrowserRouter>
      <Routes>

        {/* ── Home / Landing ──────────────────────────────────────────── */}
        <Route
          path="/"
          element={
            <Landing
              lang={lang}
              setLang={handleSetLang}
              consent={consent}
              onConsent={handleConsent}
              onDecline={handleDecline}
            />
          }
        />

        {/* ── Private Chat ────────────────────────────────────────────── */}
        <Route
          path="/chat"
          element={
            <Chat
              lang={lang}
              setLang={handleSetLang}
              consent={consent}
              onConsent={handleConsent}
              onDecline={handleDecline}
            />
          }
        />

        {/* ── Standalone chat (same component, no back-nav pressure) ──── */}
        <Route
          path="/chat/standalone"
          element={
            <Chat
              lang={lang}
              setLang={handleSetLang}
              consent={consent}
              onConsent={handleConsent}
              onDecline={handleDecline}
            />
          }
        />

        {/* ── Admin Dashboard (lazy) ───────────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<DashboardLoader />}>
              <Dashboard lang={lang} setLang={handleSetLang} />
            </Suspense>
          }
        />

        {/* ── Catch-all → redirect home ────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
