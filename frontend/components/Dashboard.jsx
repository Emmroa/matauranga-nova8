// ═══════════════════════════════════════════════════════════════════════════
// NOVA — Admin Dashboard (React 19)
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
//
// This is a SELF-CONTAINED file:
//   • LoginPanel (if no admin cookie)
//   • StatCards (sessions / messages / crises / feedback)
//   • HeatmapCore (4 region panels × 35 topics = 140 indicators)
//   • Charts (7-day timeseries · language breakdown · region totals)
//   • CrisisPanel (aggregate crisis activation counter + documentation)
//   • AnalystChatPanel (admin AI — Mistral over aggregate JSON, SSE stream)
//   • DocumentationPanel (per-topic glossary for the Burnett assessors)
//   • ExportBar (CSV + JSON download)
//
// PRIVACY:
//   All data shown here is AGGREGATE with small-cell suppression (n<6 → 0).
//   No individual session content ever leaves the server.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart, LineController, LineElement, BarController, BarElement,
  DoughnutController, ArcElement, CategoryScale, LinearScale,
  PointElement, Tooltip, Legend, Filler, Title
} from 'chart.js';

Chart.register(
  LineController, LineElement, BarController, BarElement,
  DoughnutController, ArcElement, CategoryScale, LinearScale,
  PointElement, Tooltip, Legend, Filler, Title
);

// ─── i18n (focused subset for the dashboard) ───────────────────────────────
const UI = {
  en: {
    loginTitle: 'Dashboard access',
    loginSub: 'Internal analytics — authorised personnel only.',
    username: 'Username',
    password: 'Password',
    login: 'Sign in',
    loggingIn: 'Signing in…',
    badCreds: 'Invalid credentials.',
    networkErr: 'Could not reach the server.',
    headerTitle: 'Mātauranga NOVA · Analytics',
    headerSub: 'Aggregate counters · zero personal data',
    refresh: 'Refresh',
    logout: 'Sign out',
    backHome: 'Back to home',
    // stats
    totalSessions: 'Sessions',
    totalMessages: 'Messages',
    crisisEvents: 'Crisis activations',
    feedbackRatio: 'Positive feedback',
    topicsTracked: 'Topics tracked',
    lowCellHidden: 'Counts below 6 are suppressed to protect privacy.',
    // heatmap
    heatmapTitle: 'Regional heatmap · 4 regions × 35 topics',
    heatmapSub: 'Small-cell suppression applied (n < 6 shown as 0)',
    // charts
    timeseriesTitle: 'Messages · last 7 days',
    languagesTitle: 'Language distribution',
    regionTotalsTitle: 'Total messages by region',
    // crisis
    crisisPanelTitle: 'Crisis activations',
    crisisPanelBody: 'Each crisis activation corresponds to a detected phrase related to suicide ideation, self-harm, or acute distress. At the moment of detection, the user was immediately shown Lifeline 0800 543 354, 1737, and 111.',
    // analyst
    analystTitle: 'Ask the analyst',
    analystSub: 'Mistral 7B queries the aggregate JSON only — no individual message content exists in the database.',
    analystPlaceholder: 'E.g., "Which region has the most stigma-related topics?"',
    analystAsk: 'Ask',
    analystThinking: 'Analysing aggregate data…',
    // docs
    docsTitle: 'Taxonomy glossary',
    docsSub: 'Terminology reference for assessors · bilingual where applicable',
    // export
    exportCsv: 'Export CSV',
    exportJson: 'Export JSON'
  },
  es: {
    loginTitle: 'Acceso al panel',
    loginSub: 'Analítica interna — solo personal autorizado.',
    username: 'Usuario',
    password: 'Contraseña',
    login: 'Iniciar sesión',
    loggingIn: 'Iniciando…',
    badCreds: 'Credenciales inválidas.',
    networkErr: 'No se pudo conectar al servidor.',
    headerTitle: 'Mātauranga NOVA · Analítica',
    headerSub: 'Contadores agregados · cero datos personales',
    refresh: 'Actualizar',
    logout: 'Cerrar sesión',
    backHome: 'Volver al inicio',
    totalSessions: 'Sesiones',
    totalMessages: 'Mensajes',
    crisisEvents: 'Activaciones de crisis',
    feedbackRatio: 'Feedback positivo',
    topicsTracked: 'Temas monitoreados',
    lowCellHidden: 'Conteos menores a 6 se suprimen para proteger la privacidad.',
    heatmapTitle: 'Mapa de calor · 4 regiones × 35 temas',
    heatmapSub: 'Supresión de celdas pequeñas (n < 6 se muestra como 0)',
    timeseriesTitle: 'Mensajes · últimos 7 días',
    languagesTitle: 'Distribución por idioma',
    regionTotalsTitle: 'Mensajes totales por región',
    crisisPanelTitle: 'Activaciones de crisis',
    crisisPanelBody: 'Cada activación de crisis corresponde a una frase detectada relacionada con ideación suicida, autolesión o distrés agudo. Al momento de la detección, se le mostró al usuario inmediatamente Lifeline 0800 543 354, 1737 y 111.',
    analystTitle: 'Consultá al analista',
    analystSub: 'Mistral 7B consulta solo el JSON agregado — no existe contenido individual en la base de datos.',
    analystPlaceholder: 'Ej.: "¿Qué región tiene más temas de estigma?"',
    analystAsk: 'Consultar',
    analystThinking: 'Analizando datos agregados…',
    docsTitle: 'Glosario taxonómico',
    docsSub: 'Referencia terminológica para evaluadores · bilingüe donde aplique',
    exportCsv: 'Exportar CSV',
    exportJson: 'Exportar JSON'
  },
  mi: {
    loginTitle: 'Uru ki te papatohu',
    loginSub: 'Mō ngā kaimahi whai mana anake.',
    username: 'Ingoa kaiwhakamahi',
    password: 'Kupu whakamuna',
    login: 'Uru mai',
    loggingIn: 'Uru ana…',
    badCreds: 'Kāore i tika ngā tohu.',
    networkErr: 'Kāore i taea te tūmau.',
    headerTitle: 'Mātauranga NOVA · Tātaritanga',
    headerSub: 'Ngā tatauranga muna anake',
    refresh: 'Whakahou',
    logout: 'Puta',
    backHome: 'Hoki ki te kāinga',
    totalSessions: 'Wātū',
    totalMessages: 'Karere',
    crisisEvents: 'Whakaoho taumaha',
    feedbackRatio: 'Urupare pai',
    topicsTracked: 'Kaupapa e aroturukitia',
    lowCellHidden: 'Ko ngā tatauranga iti i te 6 ka huna hei tiaki tūmataititanga.',
    heatmapTitle: 'Mapi wera · 4 rohe × 35 kaupapa',
    heatmapSub: 'Kua whakaitihia ngā pouaka iti (n < 6)',
    timeseriesTitle: 'Karere · ngā rā 7 kua pahure',
    languagesTitle: 'Tohatoha reo',
    regionTotalsTitle: 'Tapeke karere mā ia rohe',
    crisisPanelTitle: 'Whakaoho taumaha',
    crisisPanelBody: 'Ko ia whakaoho taumaha e hāngai ana ki tētahi kōrero i kitea mō te whakamōmori, whakamamae whaiaro, rānei taumaha kino. I te wā i kitea, i whakaaturia a Lifeline 0800 543 354, 1737, me te 111.',
    analystTitle: 'Pātai ki te kaitātari',
    analystSub: 'Ka whakamahia e Mistral 7B ngā tatauranga anake.',
    analystPlaceholder: 'Hei tauira: "Ko tēhea rohe te nui o ngā kaupapa whakaiti?"',
    analystAsk: 'Pātai',
    analystThinking: 'Kei te tātari i ngā tatauranga…',
    docsTitle: 'Papakupu kaupapa',
    docsSub: 'Tohutoro reorua mō ngā kaiaromatawai',
    exportCsv: 'Kawe CSV',
    exportJson: 'Kawe JSON'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Utility — background gradient for heatmap cells (oklch perceptual ramp)
// ═══════════════════════════════════════════════════════════════════════════
function heatColor(n, max, isCrisis) {
  if (!n || max === 0) return 'oklch(22% 0.02 155)';
  const ratio = Math.min(1, n / max);
  const l = 24 + ratio * 42;          // 24% → 66%
  const c = 0.04 + ratio * 0.16;      // 0.04 → 0.20
  const h = isCrisis ? 20 : 190;      // red for crisis, teal otherwise
  return `oklch(${l}% ${c.toFixed(3)} ${h})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Taxonomy glossary — bilingual reference for Burnett Foundation assessors
// ═══════════════════════════════════════════════════════════════════════════
const GLOSSARY = [
  { term: 'Whakamā',         en: 'Māori concept of shame, embarrassment, or withdrawal in response to stigma — often internalised.' },
  { term: 'Takatāpui',       en: 'Māori term reclaimed for LGBTQIA+ Māori — encompasses diverse sexualities, gender identities and intimate same-sex friendships.' },
  { term: 'Whānau',          en: 'Extended family unit in te ao Māori, broader than biological family; includes chosen family.' },
  { term: 'Te Whare Tapa Whā', en: 'Sir Mason Durie’s four-sided model of Māori health: taha tinana (physical), hinengaro (mental/emotional), wairua (spiritual), whānau (family/social).' },
  { term: 'U=U',             en: 'Undetectable = Untransmittable. NZ Government formally signed the U=U declaration on 15 February 2026.' },
  { term: 'PrEP',            en: 'Pre-exposure prophylaxis — HIV prevention medication taken before potential exposure.' },
  { term: 'PEP',             en: 'Post-exposure prophylaxis — must start within 72 hours of potential HIV exposure.' },
  { term: 'DoxyPEP',         en: 'Doxycycline 200 mg within 72 hours post-exposure to reduce bacterial STI risk (syphilis, chlamydia). Follows NZSHS eligibility guidelines.' },
  { term: 'Pacific wellbeing', en: 'Pacific peoples’ holistic models of health (e.g., fonofale, te vaka atafaga) — family, spirituality, environment, culture interwoven.' },
  { term: 'Ageing with HIV', en: 'Long-term PLHIV (people living with HIV) now commonly reach older age; this brings comorbidities, polypharmacy, and social isolation challenges.' },
  { term: 'Rural access',    en: 'Barriers specific to remote / low-density regions: distance to clinics, telehealth limitations, and privacy concerns in small communities.' },
  { term: 'Clinical stigma audit', en: 'User-reported poor clinical experiences — a signal to Burnett and Te Whatu Ora for service improvement and training.' }
];

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PANEL
// ═══════════════════════════════════════════════════════════════════════════
function LoginPanel({ lang, onLogin }) {
  const t = UI[lang];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!username || !password) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'HTTP ' + r.status);
      }
      onLogin();
    } catch (err) {
      setError(/credentials|invalid/i.test(err?.message || '') ? t.badCreds : t.networkErr);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <form onSubmit={submit}
            className="nova-glass-strong w-full max-w-sm p-6 md:p-8 nova-fade-up"
            aria-label={t.loginTitle}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500
                          text-slate-900 font-bold flex items-center justify-center">N</div>
          <div>
            <h1 className="font-semibold text-teal-100 text-lg leading-tight">{t.loginTitle}</h1>
            <p className="text-xs text-teal-300/70">{t.loginSub}</p>
          </div>
        </div>

        <label className="block text-xs uppercase tracking-wider text-teal-300/70 mb-1" htmlFor="u">
          {t.username}
        </label>
        <input id="u" type="text" autoComplete="username"
               className="nova-input mb-3"
               value={username} onChange={e => setUsername(e.target.value)}
               disabled={busy} required autoFocus />

        <label className="block text-xs uppercase tracking-wider text-teal-300/70 mb-1" htmlFor="p">
          {t.password}
        </label>
        <input id="p" type="password" autoComplete="current-password"
               className="nova-input mb-4"
               value={password} onChange={e => setPassword(e.target.value)}
               disabled={busy} required />

        {error && (
          <div role="alert" className="mb-3 px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-100 text-sm">
            {error}
          </div>
        )}

        <button type="submit" className="nova-btn nova-btn-primary w-full" disabled={busy}>
          {busy ? t.loggingIn : t.login}
        </button>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-teal-300/60 hover:text-teal-200">
            ← {t.backHome}
          </Link>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════
function StatCard({ label, value, hint, tone = 'teal' }) {
  const toneMap = {
    teal:  'from-teal-400/20 to-emerald-500/10 border-teal-400/20',
    gold:  'from-amber-400/20 to-yellow-500/10 border-amber-400/20',
    rose:  'from-rose-400/25 to-red-500/10 border-rose-400/30',
    green: 'from-emerald-400/20 to-teal-500/10 border-emerald-400/20'
  };
  return (
    <div className={`nova-glass p-4 bg-gradient-to-br ${toneMap[tone]}`}>
      <div className="text-[11px] uppercase tracking-wider text-slate-200/70 font-mono">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-300/60">{hint}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEATMAP — 4 region panels × 35 topics
// ═══════════════════════════════════════════════════════════════════════════
function HeatmapCore({ summary, topics, t }) {
  // Only show the 4 operating regions (not NAT)
  const regions = ['NTH', 'MID', 'CEN', 'STH'];
  const byRegionTopic = useMemo(() => {
    const m = new Map();
    for (const row of (summary.topics_by_region || [])) {
      m.set(`${row.region_code}:${row.topic_code}`, row);
    }
    return m;
  }, [summary]);

  const max = useMemo(() => {
    let mx = 0;
    for (const row of (summary.topics_by_region || [])) if (row.n > mx) mx = row.n;
    return mx || 1;
  }, [summary]);

  const regionMeta = useMemo(() => {
    const m = new Map();
    for (const r of (summary.regions || [])) m.set(r.code, r);
    return m;
  }, [summary]);

  return (
    <section className="nova-glass p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <h3 className="text-lg font-semibold text-teal-100">{t.heatmapTitle}</h3>
        <span className="text-xs text-teal-300/60">{t.heatmapSub}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {regions.map(rcode => {
          const meta = regionMeta.get(rcode);
          return (
            <div key={rcode} className="nova-card !p-3">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <div className="font-semibold text-teal-50 text-sm">{meta?.name_en || rcode}</div>
                  <div className="text-[11px] text-teal-300/60 font-mono">{meta?.name_mi}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-white">{meta?.total_events ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wider text-teal-300/60">msgs</div>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {topics.map(tp => {
                  const hit = byRegionTopic.get(`${rcode}:${tp.code}`);
                  const n = hit?.n || 0;
                  return (
                    <div key={`${rcode}:${tp.code}`}
                         className="nova-heat-cell"
                         style={{ background: heatColor(n, max, !!tp.is_crisis),
                                  color: n > max * 0.4 ? '#030e07' : 'rgba(220,255,240,0.85)' }}
                         title={`${tp.label_en} · ${n}`}>
                      {n || ''}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-[11px] text-teal-300/60 font-mono">
        <div className="flex items-center gap-1">
          <span>less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) =>
            <span key={i} className="w-4 h-3 rounded"
                  style={{ background: heatColor(r * max, max, false) }} />
          )}
          <span>more</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: heatColor(max * 0.6, max, true) }} />
            crisis topic
          </span>
          <span>{t.lowCellHidden}</span>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART HELPERS — each mounts a Chart.js instance into a <canvas>
// ═══════════════════════════════════════════════════════════════════════════
function useChart(canvasRef, config, deps) {
  useEffect(() => {
    if (!canvasRef.current) return;
    const inst = new Chart(canvasRef.current, config);
    return () => { try { inst.destroy(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const CHART_FONT = { family: "'Sora', system-ui, sans-serif", size: 11 };
const CHART_COLOR_TEXT = 'rgba(226, 252, 245, 0.85)';
const CHART_COLOR_GRID = 'rgba(45, 212, 167, 0.14)';

function TimeseriesChart({ data, t }) {
  const ref = useRef(null);
  const days = data?.timeseries || [];
  useChart(ref, {
    type: 'line',
    data: {
      labels: days.map(d => d.day.slice(5)),
      datasets: [
        {
          label: t.totalMessages, data: days.map(d => d.n),
          borderColor: 'rgb(45, 212, 167)',
          backgroundColor: 'rgba(45, 212, 167, 0.20)',
          fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3
        },
        {
          label: t.crisisEvents, data: days.map(d => d.crises),
          borderColor: 'rgb(244, 114, 182)',
          backgroundColor: 'rgba(244, 114, 182, 0.12)',
          fill: false, tension: 0.35, borderWidth: 2, pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: CHART_COLOR_TEXT, font: CHART_FONT, boxWidth: 10 } },
        tooltip: { titleFont: CHART_FONT, bodyFont: CHART_FONT }
      },
      scales: {
        x: { ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT }, grid: { color: CHART_COLOR_GRID } },
        y: { ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT, precision: 0 }, grid: { color: CHART_COLOR_GRID }, beginAtZero: true }
      }
    }
  }, [JSON.stringify(days), t]);
  return <div className="h-56"><canvas ref={ref} /></div>;
}

function LanguagePieChart({ data, t }) {
  const ref = useRef(null);
  const langs = data?.languages || [];
  const label = c => c === 'en' ? 'English' : c === 'es' ? 'Español' : c === 'mi' ? 'Te reo Māori' : c;
  useChart(ref, {
    type: 'doughnut',
    data: {
      labels: langs.map(l => label(l.language)),
      datasets: [{
        data: langs.map(l => l.n),
        backgroundColor: [
          'rgba(45, 212, 167, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(148, 163, 184, 0.8)'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: CHART_COLOR_TEXT, font: CHART_FONT, boxWidth: 10 } }
      },
      cutout: '62%'
    }
  }, [JSON.stringify(langs), t]);
  return <div className="h-56"><canvas ref={ref} /></div>;
}

function RegionTotalsChart({ data, t }) {
  const ref = useRef(null);
  const regs = (data?.regions || []).filter(r => r.code !== 'NAT');
  useChart(ref, {
    type: 'bar',
    data: {
      labels: regs.map(r => r.name_en),
      datasets: [
        {
          label: t.totalMessages, data: regs.map(r => r.total_events || 0),
          backgroundColor: 'rgba(45, 212, 167, 0.7)', borderRadius: 6
        },
        {
          label: t.crisisEvents, data: regs.map(r => r.crisis_events || 0),
          backgroundColor: 'rgba(244, 114, 182, 0.7)', borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: CHART_COLOR_TEXT, font: CHART_FONT, boxWidth: 10 } }
      },
      scales: {
        x: { ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT }, grid: { display: false } },
        y: { ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT, precision: 0 }, grid: { color: CHART_COLOR_GRID }, beginAtZero: true }
      }
    }
  }, [JSON.stringify(regs), t]);
  return <div className="h-56"><canvas ref={ref} /></div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRISIS PANEL
// ═══════════════════════════════════════════════════════════════════════════
function CrisisPanel({ summary, t }) {
  const count = summary?.totals?.crises || 0;
  return (
    <section className="nova-glass p-5 border-rose-400/30"
             style={{ borderColor: 'color-mix(in oklab, oklch(65% 0.24 20) 30%, transparent)' }}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 shrink-0 rounded-2xl bg-rose-500/20 border border-rose-400/40
                        text-rose-200 flex items-center justify-center text-xl">🆘</div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-rose-100">{t.crisisPanelTitle}</h3>
            <div className="text-3xl font-semibold text-white">{count}</div>
          </div>
          <p className="mt-2 text-sm text-slate-200/85 leading-relaxed">{t.crisisPanelBody}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
            <span className="nova-chip nova-chip-crisis">Lifeline · 0800 543 354</span>
            <span className="nova-chip nova-chip-crisis">Text / call · 1737</span>
            <span className="nova-chip nova-chip-crisis">Emergency · 111</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYST CHAT — Mistral queries the aggregate JSON (SSE stream)
// ═══════════════════════════════════════════════════════════════════════════
function AnalystChatPanel({ lang, t }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns]       = useState([]); // { q, a, busy }
  const [busy, setBusy]         = useState(false);
  const scrollerRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const ask = useCallback(async () => {
    const q = question.trim(); if (!q || busy) return;
    setBusy(true); setQuestion('');
    setTurns(t => [...t, { q, a: '', busy: true }]);

    try {
      const res = await fetch('/api/admin/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: q })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          if (!frame.trim()) continue;
          let evt = 'message', data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) evt = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload; try { payload = JSON.parse(data); } catch { continue; }
          if (evt === 'token') {
            setTurns(tt => tt.map((x, i) => i === tt.length - 1
              ? { ...x, a: (x.a || '') + (payload.t || '') } : x));
          } else if (evt === 'fallback') {
            setTurns(tt => tt.map((x, i) => i === tt.length - 1
              ? { ...x, a: payload.text, busy: false } : x));
          } else if (evt === 'done') {
            setTurns(tt => tt.map((x, i) => i === tt.length - 1
              ? { ...x, busy: false } : x));
          }
        }
      }
    } catch {
      setTurns(tt => tt.map((x, i) => i === tt.length - 1
        ? { ...x, a: 'Error querying the analyst.', busy: false } : x));
    } finally {
      setBusy(false);
      setTurns(tt => tt.map(x => x.busy ? { ...x, busy: false } : x));
    }
  }, [question, busy]);

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } };

  return (
    <section className="nova-glass p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-lg font-semibold text-teal-100">{t.analystTitle}</h3>
        <span className="text-xs text-teal-300/60">{t.analystSub}</span>
      </div>

      <div ref={scrollerRef}
           className="max-h-72 overflow-y-auto space-y-3 pr-1 mb-3"
           aria-live="polite">
        {turns.length === 0 && (
          <div className="text-sm text-teal-200/50 italic text-center py-6">
            {lang === 'es' ? 'Probá con preguntas como: "¿qué tema tiene más activaciones en Southern?"' :
             lang === 'mi' ? 'Hei tauira: "Ko tēhea kaupapa ka rangona nui i Te Waipounamu?"' :
             'Try questions like: "Which topic has the most activations in Southern?"'}
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="space-y-2 nova-fade-up">
            <div className="text-sm text-teal-200/90">
              <span className="text-[10px] uppercase tracking-wider text-teal-400/60 mr-2 font-mono">you</span>
              {turn.q}
            </div>
            <div className="text-sm text-slate-200 nova-bubble-ai !rounded-lg px-3 py-2">
              {turn.a || (turn.busy && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="nova-typing-dot" />
                  <span className="nova-typing-dot" />
                  <span className="nova-typing-dot" />
                  <span className="ml-1 text-teal-200/60 text-xs">{t.analystThinking}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={onKey}
          placeholder={t.analystPlaceholder}
          className="nova-input flex-1"
          disabled={busy}
          maxLength={500}
        />
        <button className="nova-btn nova-btn-primary shrink-0"
                onClick={ask} disabled={busy || !question.trim()}>
          {busy ? '…' : t.analystAsk}
        </button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTATION PANEL
// ═══════════════════════════════════════════════════════════════════════════
function DocumentationPanel({ topics, t }) {
  const [openTerm, setOpenTerm] = useState(null);
  const [openTopic, setOpenTopic] = useState(null);

  return (
    <section className="nova-glass p-5">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-teal-100">{t.docsTitle}</h3>
        <p className="text-xs text-teal-300/60">{t.docsSub}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-teal-300/60 font-mono mb-2">
            cultural + clinical terms
          </div>
          <ul className="space-y-1.5">
            {GLOSSARY.map((g, i) => (
              <li key={i}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition text-sm"
                  onClick={() => setOpenTerm(openTerm === i ? null : i)}
                  aria-expanded={openTerm === i}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-teal-100">{g.term}</span>
                    <span className="text-teal-400/60">{openTerm === i ? '−' : '+'}</span>
                  </div>
                  {openTerm === i && (
                    <div className="mt-2 text-slate-300/85 text-[13px] leading-relaxed">{g.en}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-teal-300/60 font-mono mb-2">
            35-topic taxonomy
          </div>
          <ul className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {topics.map((tp, i) => (
              <li key={tp.code}>
                <button
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/5 transition text-sm"
                  onClick={() => setOpenTopic(openTopic === i ? null : i)}
                  aria-expanded={openTopic === i}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`nova-chip !text-[10px] !py-0 !px-2 ${
                        tp.is_crisis ? 'nova-chip-crisis' :
                        tp.category === 'new_priority' ? 'nova-chip-gold' : ''
                      }`}>
                        {tp.category}
                      </span>
                      <span className="font-medium text-teal-100 truncate">{tp.label_en}</span>
                    </div>
                    <span className="text-teal-400/60 shrink-0">{openTopic === i ? '−' : '+'}</span>
                  </div>
                  {openTopic === i && (
                    <div className="mt-2 text-slate-300/85 text-[13px] leading-relaxed">
                      <div>{tp.description}</div>
                      {tp.label_mi && (
                        <div className="mt-1 text-teal-300/70 font-mono text-[11px]">
                          te reo: {tp.label_mi}
                        </div>
                      )}
                      <div className="mt-1 text-slate-400/60 text-[11px] font-mono">
                        code: {tp.code}
                      </div>
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function DashboardMain({ lang, setLang, onLogout }) {
  const t = UI[lang];
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [topics, setTopics]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sumRes, metaRes] = await Promise.all([
        fetch('/api/admin/summary', { credentials: 'include' }),
        fetch('/api/metadata')
      ]);
      if (sumRes.status === 401) { onLogout(); return; }
      if (!sumRes.ok) throw new Error('summary HTTP ' + sumRes.status);
      const sum = await sumRes.json();
      const meta = await metaRes.json();
      setSummary(sum);
      setTopics(meta.topics || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  const doLogout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }); } catch { /* noop */ }
    onLogout();
  };

  const exportJson = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `nova-analytics-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const exportCsv = () => { window.open('/api/admin/export.csv', '_blank'); };

  const fbRatio = useMemo(() => {
    const up = summary?.feedback?.up_count || 0;
    const down = summary?.feedback?.down_count || 0;
    const tot = up + down;
    return tot > 0 ? Math.round((up / tot) * 100) + '%' : '—';
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="nova-glass px-6 py-5 text-teal-200 font-mono text-sm">
          ● Loading analytics…
        </div>
      </div>
    );
  }
  if (error && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="nova-glass-strong px-6 py-6 max-w-md text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-rose-200 mb-3">{error}</p>
          <button className="nova-btn nova-btn-primary" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-5 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500
                                   text-slate-900 font-bold flex items-center justify-center shrink-0">N</Link>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-teal-50 leading-tight truncate">{t.headerTitle}</h1>
            <p className="text-xs text-teal-300/60 font-mono truncate">{t.headerSub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={e => setLang(e.target.value)}
                  className="nova-input !py-1.5 !px-2 !text-xs !w-auto">
            <option value="en">EN</option><option value="es">ES</option><option value="mi">MI</option>
          </select>
          <button className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3" onClick={load}>
            ↻ {t.refresh}
          </button>
          <button className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3" onClick={exportCsv}>
            {t.exportCsv}
          </button>
          <button className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3" onClick={exportJson}>
            {t.exportJson}
          </button>
          <button className="nova-btn nova-btn-danger !text-xs !py-1.5 !px-3" onClick={doLogout}>
            {t.logout}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-5 pb-12 space-y-5">
        {/* Stats row */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard tone="teal"  label={t.totalSessions}  value={summary?.totals?.sessions ?? 0} />
          <StatCard tone="teal"  label={t.totalMessages}  value={summary?.totals?.messages ?? 0} />
          <StatCard tone="rose"  label={t.crisisEvents}   value={summary?.totals?.crises ?? 0}
                    hint="Lifeline · 1737 · 111" />
          <StatCard tone="green" label={t.feedbackRatio}  value={fbRatio}
                    hint={`${summary?.feedback?.up_count ?? 0}👍 · ${summary?.feedback?.down_count ?? 0}👎`} />
          <StatCard tone="gold"  label={t.topicsTracked}  value={summary?.totals?.topics_tracked ?? 35}
                    hint="30 legacy + 5 new priorities" />
        </section>

        {/* Heatmap */}
        {topics.length > 0 && summary && <HeatmapCore summary={summary} topics={topics} t={t} />}

        {/* Charts row */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="nova-glass p-4">
            <h4 className="text-sm font-semibold text-teal-100 mb-2">{t.timeseriesTitle}</h4>
            <TimeseriesChart data={summary} t={t} />
          </div>
          <div className="nova-glass p-4">
            <h4 className="text-sm font-semibold text-teal-100 mb-2">{t.languagesTitle}</h4>
            <LanguagePieChart data={summary} t={t} />
          </div>
          <div className="nova-glass p-4">
            <h4 className="text-sm font-semibold text-teal-100 mb-2">{t.regionTotalsTitle}</h4>
            <RegionTotalsChart data={summary} t={t} />
          </div>
        </section>

        {/* Crisis + Analyst row */}
        <section className="grid md:grid-cols-2 gap-4">
          <CrisisPanel summary={summary} t={t} />
          <AnalystChatPanel lang={lang} t={t} />
        </section>

        {/* Documentation */}
        {topics.length > 0 && <DocumentationPanel topics={topics} t={t} />}

        <footer className="text-center text-xs text-teal-300/40 font-mono pt-4">
          Mātauranga NOVA · Built by Emanuel Figueroa · NZ Privacy Act 2020 · HIPC 2020 · Māori Data Sovereignty
        </footer>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP-LEVEL — LOGIN ⇄ DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export default function Dashboard({ lang: propLang, setLang: propSetLang }) {
  const [lang, setLang] = useState(propLang || 'en');
  const [auth, setAuth] = useState(null); // null = checking, false = login, true = authenticated

  // Sync language with parent if provided
  useEffect(() => { if (propLang) setLang(propLang); }, [propLang]);
  const setLangAll = (l) => { setLang(l); propSetLang?.(l); };

  // Initial auth check
  useEffect(() => {
    let cancel = false;
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => { if (!cancel) setAuth(r.ok); })
      .catch(() => { if (!cancel) setAuth(false); });
    return () => { cancel = true; };
  }, []);

  if (auth === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="nova-glass px-6 py-5 text-teal-200 font-mono text-sm">● Checking session…</div>
      </div>
    );
  }
  if (!auth) return <LoginPanel lang={lang} onLogin={() => setAuth(true)} />;
  return <DashboardMain lang={lang} setLang={setLangAll} onLogout={() => setAuth(false)} />;
}
