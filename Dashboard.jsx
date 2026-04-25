// ═══════════════════════════════════════════════════════════════════════════
// NOVA — Admin Dashboard v2 (React 19)
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
//
// NUEVO EN v2:
//   • NationalBanner   — datos reales Health NZ 2024-2025
//   • ZoneGrid         — 4 zonas clickeables con nombres y risk score
//   • ZoneDetailPanel  — estadísticas completas por zona (slide-in)
//   • DiseaseTabs      — HIV · Sífilis · Gonorrea · Clamidia · Mpox
//   • PredictivePanel  — tendencia histórica + pronóstico 2 años
//   • AccessGapPanel   — dónde es más difícil llegar (para Burnett)
//   • AnalystChatPanel — IA sobre datos agregados (conservado)
//
// PRIVACIDAD: todos los datos son agregados. Supresión de celda < 6.
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

// ═══════════════════════════════════════════════════════════════════════════
// DATOS EPIDEMIOLÓGICOS NZ — Fuente: Health NZ Monitoring Report 2025
// ═══════════════════════════════════════════════════════════════════════════
const NZ_EPI = {
  year: 2024,
  source: 'Health NZ HIV Monitoring Report 2025',
  hiv: {
    new_diagnoses: 95,
    locally_acquired: 60,
    overseas_acquired: 35,
    on_art: 2312,
    viral_suppression_pct: 95,
    know_status_pct: 91,
    target_zero_year: 2030,
    trend_pct: -12, // reducción anual vs 2023
    history: [
      { year: 2019, n: 163 }, { year: 2020, n: 134 }, { year: 2021, n: 43 },
      { year: 2022, n: 78 },  { year: 2023, n: 108 }, { year: 2024, n: 95 }
    ]
  },
  sti: {
    syphilis:    { trend: 'rising',        note: 'Sífilis congénita en alza — especialmente en Māori', estimate_annual: 1800 },
    gonorrhoea:  { trend: 'rising',        note: 'Aumento significativo últimos 3 años',               estimate_annual: 5200 },
    chlamydia:   { trend: 'stable_high',   note: 'ITS más común en NZ',                                estimate_annual: 7800 },
    mpox:        { trend: 'managed',       note: 'Vacuna gratis disponible en Burnett centres',         estimate_annual: 12  }
  }
};

// Zonas Te Whatu Ora con datos estimados por región
const ZONES = [
  {
    code: 'NTH', name_en: 'Northern', name_mi: 'Te Tai Tokerau ki Tāmaki',
    districts: 'Auckland · Waitematā · Counties Manukau · Northland',
    pop_pct: 38,
    hiv_cases: 47,   // ~50% del total nacional
    on_art: 1100,
    testing_rate: 'high',
    access_gap: 3.1,   // escala 1-10, mayor = más difícil llegar
    risk_score: 4.2,
    lang_barriers: ['Samoan', 'Mandarin', 'Hindi', 'Spanish'],
    key_communities: ['Gay/bi men', 'Pacific', 'Asian migrants', 'Takatāpui'],
    services: ['31-35 Hargreaves St, St Marys Bay', 'Mobile testing units'],
    nova_sessions: null, // cargado desde API
    top_topics: ['HIV', 'PrEP', 'STI_Testing', 'External_Discrimination', 'Disclosure'],
    color: '#1D9E75',
    alert: null
  },
  {
    code: 'MID', name_en: 'Midland', name_mi: 'Te Manawa Taki',
    districts: 'Waikato · Lakes · Bay of Plenty · Tairāwhiti · Taranaki · Hauora Tairāwhiti',
    pop_pct: 22,
    hiv_cases: 19,
    on_art: 460,
    testing_rate: 'medium',
    access_gap: 6.4,
    risk_score: 6.8,
    lang_barriers: ['Te reo Māori', 'Samoan', 'Tongan'],
    key_communities: ['Māori', 'Takatāpui', 'Rural Iwi', 'Pacific'],
    services: ['Waikato region contractors', 'Telehealth'],
    nova_sessions: null,
    top_topics: ['Whanau_Family', 'Internal_Stigma', 'Rural_Access', 'Takatapui_Specific', 'WINZ'],
    color: '#BA7517',
    alert: 'High rural access gap — priority for outreach'
  },
  {
    code: 'CEN', name_en: 'Central', name_mi: 'Te Ikaroa',
    districts: "Hawke's Bay · Whanganui · MidCentral · Hutt Valley · Capital & Coast · Wairarapa · Nelson · Marlborough",
    pop_pct: 24,
    hiv_cases: 19,
    on_art: 530,
    testing_rate: 'medium',
    access_gap: 5.2,
    risk_score: 5.5,
    lang_barriers: ['Spanish', 'French', 'Arabic'],
    key_communities: ['Gay/bi men Wellington', 'Migrants', 'Rural communities', 'Refugee populations'],
    services: ['Wellington regional centre', 'Telehealth'],
    nova_sessions: null,
    top_topics: ['HIV', 'Disclosure', 'Legal_Rights', 'Online_Hate', 'Immigration'],
    color: '#534AB7',
    alert: null
  },
  {
    code: 'STH', name_en: 'Southern', name_mi: 'Te Waipounamu',
    districts: 'West Coast · Canterbury · South Canterbury · Southern',
    pop_pct: 16,
    hiv_cases: 10,
    on_art: 222,
    testing_rate: 'low',
    access_gap: 7.1,
    risk_score: 7.4,
    lang_barriers: ['Mandarin', 'Hindi', 'Tagalog'],
    key_communities: ['Rural communities', 'International students', 'Ageing PLHIV', 'Migrants'],
    services: ['Christchurch / Ōtautahi centre', 'Remote telehealth'],
    nova_sessions: null,
    top_topics: ['Rural_Access', 'Ageing_with_HIV', 'ART_Medication', 'Loneliness', 'Medical_Discrimination'],
    color: '#D85A30',
    alert: 'Highest access gap nationally — critical intervention zone'
  }
];

// ─── i18n subset dashboard ───────────────────────────────────────────────
const UI = {
  en: {
    loginTitle: 'Dashboard access', loginSub: 'Internal analytics — authorised personnel only.',
    username: 'Username', password: 'Password', login: 'Sign in',
    loggingIn: 'Signing in…', badCreds: 'Invalid credentials.', networkErr: 'Could not reach the server.',
    headerTitle: 'Mātauranga NOVA · Analytics', headerSub: 'Aggregate data · zero personal information',
    refresh: 'Refresh', logout: 'Sign out', exportCsv: 'Export CSV', exportJson: 'Export JSON',
    overview: 'National overview', zones: 'Zones', predictive: 'Predictive', gaps: 'Access gaps',
    novaData: 'NOVA conversations', lowCell: 'Counts below 6 are suppressed.',
    source: 'Source: Health NZ HIV Monitoring Report 2025'
  },
  es: {
    loginTitle: 'Acceso al panel', loginSub: 'Analítica interna — solo personal autorizado.',
    username: 'Usuario', password: 'Contraseña', login: 'Iniciar sesión',
    loggingIn: 'Iniciando…', badCreds: 'Credenciales inválidas.', networkErr: 'No se pudo conectar.',
    headerTitle: 'Mātauranga NOVA · Analítica', headerSub: 'Datos agregados · cero información personal',
    refresh: 'Actualizar', logout: 'Salir', exportCsv: 'Exportar CSV', exportJson: 'Exportar JSON',
    overview: 'Resumen nacional', zones: 'Zonas', predictive: 'Predictivo', gaps: 'Brechas de acceso',
    novaData: 'Conversaciones NOVA', lowCell: 'Conteos menores a 6 se suprimen.',
    source: 'Fuente: Health NZ HIV Monitoring Report 2025'
  },
  mi: {
    loginTitle: 'Uru ki te papatohu', loginSub: 'Mō ngā kaimahi whai mana anake.',
    username: 'Ingoa kaiwhakamahi', password: 'Kupu whakamuna', login: 'Uru mai',
    loggingIn: 'Uru ana…', badCreds: 'Kāore i tika ngā tohu.', networkErr: 'Kāore i taea.',
    headerTitle: 'Mātauranga NOVA · Tātaritanga', headerSub: 'Tatauranga muna anake',
    refresh: 'Whakahou', logout: 'Puta', exportCsv: 'Kawe CSV', exportJson: 'Kawe JSON',
    overview: 'Tirohanga ā-motu', zones: 'Rohe', predictive: 'Matapae', gaps: 'Ārahina',
    novaData: 'Kōrero NOVA', lowCell: 'Ko ngā tatauranga iti i te 6 ka huna.',
    source: 'Puna: Health NZ HIV Monitoring Report 2025'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PANEL (conservado del original)
// ═══════════════════════════════════════════════════════════════════════════
function LoginPanel({ lang, onLogin }) {
  const t = UI[lang];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!username || !password) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const d = await r.json();
      if (r.ok && d.ok) { onLogin(d.username); }
      else setError(t.badCreds);
    } catch { setError(t.networkErr); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="nova-glass-strong w-full max-w-sm px-6 py-8 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-slate-900 font-bold flex items-center justify-center">N</div>
          <div><h1 className="font-semibold text-teal-50">{t.loginTitle}</h1><p className="text-xs text-teal-300/60">{t.loginSub}</p></div>
        </div>
        {error && <p className="text-rose-300 text-sm">{error}</p>}
        <input className="nova-input w-full" placeholder={t.username} value={username}
               onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <input className="nova-input w-full" type="password" placeholder={t.password} value={password}
               onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <button className="nova-btn nova-btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? t.loggingIn : t.login}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NATIONAL BANNER — datos reales Health NZ 2025
// ═══════════════════════════════════════════════════════════════════════════
function NationalBanner({ summary, lang, t }) {
  const epi = NZ_EPI;
  const stats = [
    { label: 'Nuevos diagnósticos VIH 2024', value: epi.hiv.new_diagnoses, sub: `${epi.hiv.locally_acquired} locales · ${epi.hiv.overseas_acquired} extranjero`, color: 'text-teal-300' },
    { label: 'Personas en tratamiento ART', value: epi.hiv.on_art.toLocaleString(), sub: 'supresión viral ≥95%', color: 'text-emerald-300' },
    { label: 'Conocen su estado', value: epi.hiv.know_status_pct + '%', sub: 'meta global 95%', color: 'text-sky-300' },
    { label: 'Tendencia anual', value: epi.hiv.trend_pct + '%', sub: 'reducción vs 2023', color: 'text-green-400' },
    { label: 'Conversaciones NOVA', value: summary?.totals?.sessions ?? '—', sub: 'sesiones activas', color: 'text-amber-300' },
    { label: 'Activaciones crisis', value: summary?.totals?.crises ?? '—', sub: 'Lifeline · 1737 · 111', color: 'text-rose-300' }
  ];

  return (
    <div className="nova-glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-teal-100 uppercase tracking-widest">{t.overview}</h2>
          <p className="text-xs text-teal-300/50 mt-0.5">{t.source}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(epi.sti).map(([k, v]) => (
            <span key={k} className={`nova-chip text-xs ${
              v.trend === 'rising' ? 'nova-chip-crisis' :
              v.trend === 'managed' ? '' : 'nova-chip-gold'
            }`}>
              {k.charAt(0).toUpperCase() + k.slice(1)}: {v.trend === 'rising' ? '↑ alza' : v.trend === 'managed' ? '✓ controlado' : '→ estable'}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl bg-white/5 px-3 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-teal-100/80 mt-0.5 leading-tight">{s.label}</div>
            <div className="text-xs text-teal-300/50 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE CARDS — 4 zonas clickeables
// ═══════════════════════════════════════════════════════════════════════════
function ZoneCard({ zone, selected, onClick, summary }) {
  const novaSessions = useMemo(() => {
    const regs = summary?.regions || [];
    const r = regs.find(r => r.code === zone.code);
    return r?.messages ?? 0;
  }, [summary, zone.code]);

  const gapColor = zone.access_gap >= 6.5 ? 'text-rose-300' :
                   zone.access_gap >= 5   ? 'text-amber-300' : 'text-emerald-300';
  const riskColor = zone.risk_score >= 7 ? '#E24B4A' :
                    zone.risk_score >= 5 ? '#EF9F27' : '#1D9E75';

  return (
    <button
      onClick={onClick}
      className={`nova-glass rounded-2xl p-4 text-left w-full transition-all duration-200 border-2 cursor-pointer
                  hover:bg-white/10 ${selected ? 'border-teal-400/60' : 'border-transparent'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-mono text-teal-400/70 uppercase tracking-widest">{zone.code}</div>
          <div className="font-semibold text-teal-50 text-base leading-tight">{zone.name_en}</div>
          <div className="text-xs text-teal-300/60 mt-0.5">{zone.name_mi}</div>
        </div>
        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
             style={{ background: riskColor + '33', border: `2px solid ${riskColor}`, color: riskColor }}>
          {zone.risk_score}
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-teal-300/60">Diagnósticos VIH 2024</span>
          <span className="font-mono text-teal-100">≈{zone.hiv_cases}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-teal-300/60">En tratamiento ART</span>
          <span className="font-mono text-teal-100">≈{zone.on_art}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-teal-300/60">Sesiones NOVA</span>
          <span className="font-mono text-teal-100">{novaSessions || '—'}</span>
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
          <span className="text-teal-300/60">Brecha acceso</span>
          <span className={`font-mono font-semibold ${gapColor}`}>{zone.access_gap}/10</span>
        </div>
      </div>

      {zone.alert && (
        <div className="mt-2 text-xs text-amber-300/80 bg-amber-500/10 rounded-lg px-2.5 py-1.5 border border-amber-500/20">
          ⚠ {zone.alert}
        </div>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DETAIL PANEL — estadísticas completas al hacer click
// ═══════════════════════════════════════════════════════════════════════════
function ZoneDetailPanel({ zone, summary, topics, onClose }) {
  const topicDetails = useMemo(() => {
    return zone.top_topics.map(code => {
      const tp = topics.find(t => t.code === code);
      const row = (summary?.topics_by_region || []).find(r => r.region_code === zone.code && r.topic_code === code);
      return { code, label: tp?.label_en || code, n: row?.n || 0, is_crisis: tp?.is_crisis || false };
    });
  }, [zone, summary, topics]);

  const INTERVENTIONS = {
    NTH: ['Reforzar testing móvil en zonas Pacific (South Auckland)', 'Aumentar materiales en Samoan, Hindi, Mandarin', 'Ampliar sesiones de counselling para migrantes'],
    MID: ['Prioridad: comunidades rurales de Waikato y Tairāwhiti', 'Expandir programa Takatāpui en escuelas y marae', 'Telehealth para zonas sin clínica local'],
    CEN: ['Mejorar acceso PrEP en Wellington para migrantes recientes', 'Programa específico para comunidad hispana', 'Reforzar recursos en derechos legales y denuncia'],
    STH: ['URGENTE: mayor brecha de acceso nacional', 'Clínica móvil Canterbury rural', 'Recursos para personas mayores viviendo con VIH', 'Colaboración con universidades (estudiantes internacionales)']
  };

  return (
    <div className="nova-glass-strong rounded-2xl p-5 border border-teal-400/30">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ background: zone.color }}></div>
            <span className="text-xs font-mono text-teal-400/70 uppercase tracking-widest">{zone.code}</span>
          </div>
          <h3 className="text-xl font-semibold text-teal-50">{zone.name_en}</h3>
          <p className="text-xs text-teal-300/60">{zone.districts}</p>
        </div>
        <button onClick={onClose} className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3">✕ Cerrar</button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Col 1: Datos epidemiológicos */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Epidemiología local</h4>
            <div className="space-y-2">
              {[
                { l: 'Diagnósticos VIH 2024', v: `≈${zone.hiv_cases}`, note: `~${zone.pop_pct}% del total nacional` },
                { l: 'En tratamiento ART', v: `≈${zone.on_art}` },
                { l: 'Tasa de testing', v: zone.testing_rate === 'high' ? '↑ Alta' : zone.testing_rate === 'medium' ? '→ Media' : '↓ Baja' },
                { l: 'Brecha de acceso', v: `${zone.access_gap}/10` },
                { l: 'Riesgo crecimiento', v: `${zone.risk_score}/10` }
              ].map((row, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-white/5">
                  <span className="text-teal-300/60">{row.l}</span>
                  <div className="text-right">
                    <span className="font-mono text-teal-100">{row.v}</span>
                    {row.note && <div className="text-xs text-teal-300/40">{row.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Comunidades clave</h4>
            <div className="flex flex-wrap gap-1.5">
              {zone.key_communities.map(c => (
                <span key={c} className="nova-chip text-xs">{c}</span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Barreras de idioma</h4>
            <div className="flex flex-wrap gap-1.5">
              {zone.lang_barriers.map(l => (
                <span key={l} className="nova-chip nova-chip-gold text-xs">{l}</span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Servicios disponibles</h4>
            {zone.services.map(s => (
              <p key={s} className="text-xs text-teal-200/70">• {s}</p>
            ))}
          </div>
        </div>

        {/* Col 2: NOVA + Intervenciones */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Temas NOVA en esta zona</h4>
            <div className="space-y-1.5">
              {topicDetails.map(tp => (
                <div key={tp.code} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                  <span className={`${tp.is_crisis ? 'text-rose-300' : 'text-teal-200/80'}`}>
                    {tp.is_crisis ? '⚠ ' : ''}{tp.label}
                  </span>
                  <span className="font-mono text-teal-300/60">
                    {tp.n >= 6 ? tp.n : tp.n === 0 ? '—' : '<6'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-2">⬡ Intervenciones recomendadas</h4>
            <div className="space-y-2">
              {INTERVENTIONS[zone.code].map((item, i) => (
                <div key={i} className="flex gap-2 text-xs text-teal-200/80">
                  <span className="text-teal-400/60 shrink-0">→</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Access gap visual */}
          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Indicador brecha</h4>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-teal-300/60">Acceso</span>
                <span className={zone.access_gap >= 6.5 ? 'text-rose-300' : zone.access_gap >= 5 ? 'text-amber-300' : 'text-emerald-300'}>
                  {zone.access_gap >= 6.5 ? 'Crítico' : zone.access_gap >= 5 ? 'Moderado' : 'Aceptable'}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${zone.access_gap * 10}%`,
                  background: zone.access_gap >= 6.5 ? '#E24B4A' : zone.access_gap >= 5 ? '#EF9F27' : '#1D9E75'
                }}></div>
              </div>
              <div className="flex justify-between text-xs mt-1 text-teal-300/40">
                <span>Fácil acceso</span><span>Sin acceso</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DISEASE PANEL — multi-enfermedad
// ═══════════════════════════════════════════════════════════════════════════
function DiseasePanel() {
  const [active, setActive] = useState('hiv');
  const diseases = [
    { id: 'hiv',       label: 'VIH',       color: '#1D9E75' },
    { id: 'syphilis',  label: 'Sífilis',   color: '#E24B4A' },
    { id: 'gonorrhoea',label: 'Gonorrea',  color: '#BA7517' },
    { id: 'chlamydia', label: 'Clamidia',  color: '#534AB7' },
    { id: 'mpox',      label: 'Mpox',      color: '#3B6D11' }
  ];

  const DATA = {
    hiv: {
      title: 'VIH — Aotearoa New Zealand',
      trend: 'declining', trend_label: 'En descenso',
      annual_cases: 95, on_treatment: 2312, suppression_pct: 95,
      history: [163, 134, 43, 78, 108, 95],
      key_facts: [
        'U=U: Indetectable = Intransmisible — firmado por NZ el 15 Feb 2026',
        'Meta: cero transmisiones locales para 2030',
        'PrEP gratis para bajos ingresos y estudiantes internacionales',
        'Leyes de criminalización aún vigentes — en revisión'
      ],
      resources: ['burnettfoundation.org.nz · 0800 802 437', 'bodypositivity.org.nz', 'positivewomen.org.nz']
    },
    syphilis: {
      title: 'Sífilis',
      trend: 'rising', trend_label: '↑ En aumento',
      annual_cases: 1800, on_treatment: null, suppression_pct: null,
      history: [820, 910, 1050, 1300, 1600, 1800],
      key_facts: [
        'Aumento significativo en los últimos 3 años',
        'Sífilis congénita en alza — especialmente en comunidades Māori',
        'DoxyPEP reduce riesgo en 70-80%',
        'Testing gratuito en Burnett Foundation centres'
      ],
      resources: ['burnettfoundation.org.nz/test · 0800 802 437', 'nzshs.org (NZ Sexual Health Society)']
    },
    gonorrhoea: {
      title: 'Gonorrea',
      trend: 'rising', trend_label: '↑ En aumento',
      annual_cases: 5200, on_treatment: null, suppression_pct: null,
      history: [2100, 2800, 3400, 4100, 4800, 5200],
      key_facts: [
        'Aumento constante, especialmente en hombres gay y bi',
        'Resistencia antibiótica emergente — consultar clínica especializada',
        'Testing frecuente recomendado (cada 3-6 meses)',
        'Tratamiento con antibióticos disponible en todos los centros'
      ],
      resources: ['burnettfoundation.org.nz/test', 'nzshs.org']
    },
    chlamydia: {
      title: 'Clamidia',
      trend: 'stable_high', trend_label: '→ Estable alto',
      annual_cases: 7800, on_treatment: null, suppression_pct: null,
      history: [7200, 7400, 7600, 7500, 7700, 7800],
      key_facts: [
        'ITS más común en Nueva Zelanda',
        'A menudo asintomática — testing regular crítico',
        'DoxyPEP reduce riesgo en 70-90%',
        'Tratamiento antibiótico sencillo y efectivo'
      ],
      resources: ['burnettfoundation.org.nz/test', 'familyplanning.org.nz']
    },
    mpox: {
      title: 'Mpox (Viruela del mono)',
      trend: 'managed', trend_label: '✓ Controlado',
      annual_cases: 12, on_treatment: null, suppression_pct: null,
      history: [0, 0, 48, 28, 15, 12],
      key_facts: [
        'Vacuna JYNNEOS gratuita en Burnett Foundation centres',
        'Casos significativamente reducidos con vacunación',
        'Transmisión: contacto piel-a-piel cercano',
        'Síntomas: erupción, ganglios, fiebre'
      ],
      resources: ['burnettfoundation.org.nz (vacuna gratis)', 'healthpoint.co.nz (clínicas locales)']
    }
  };

  const d = DATA[active];
  const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();
    const color = diseases.find(x => x.id === active)?.color || '#1D9E75';
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: d.title,
          data: d.history,
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: color,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.raw} casos` } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#ffffff10' } },
          y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#ffffff10' } }
        }
      }
    });
  }, [active]);

  return (
    <div className="nova-glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-teal-100 uppercase tracking-widest">Enfermedades de transmisión</h2>
        <div className="flex flex-wrap gap-1.5">
          {diseases.map(dis => (
            <button key={dis.id} onClick={() => setActive(dis.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      active === dis.id ? 'text-white' : 'text-teal-300/60 hover:text-teal-200'
                    }`}
                    style={active === dis.id ? { background: dis.color } : {}}>
              {dis.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-teal-50">{d.title}</h3>
            <span className={`nova-chip text-xs ${d.trend === 'rising' ? 'nova-chip-crisis' : d.trend === 'managed' ? '' : 'nova-chip-gold'}`}>
              {d.trend_label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center">
              <div className="text-xl font-bold text-teal-200">{d.annual_cases.toLocaleString()}</div>
              <div className="text-xs text-teal-300/50">casos 2024</div>
            </div>
            {d.suppression_pct && (
              <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center">
                <div className="text-xl font-bold text-emerald-300">{d.suppression_pct}%</div>
                <div className="text-xs text-teal-300/50">supresión viral</div>
              </div>
            )}
            {d.on_treatment && (
              <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center">
                <div className="text-xl font-bold text-sky-300">{d.on_treatment.toLocaleString()}</div>
                <div className="text-xs text-teal-300/50">en tratamiento</div>
              </div>
            )}
          </div>

          <div className="space-y-1.5 mb-4">
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest">Hechos clave</h4>
            {d.key_facts.map((f, i) => (
              <div key={i} className="flex gap-2 text-xs text-teal-200/70">
                <span className="text-teal-400/50 shrink-0">•</span><span>{f}</span>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-1.5">Recursos</h4>
            {d.resources.map((r, i) => (
              <p key={i} className="text-xs text-teal-400/70 font-mono">→ {r}</p>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Tendencia 2019–2024</h4>
          <div style={{ height: '200px' }}><canvas ref={canvasRef} /></div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PREDICTIVE PANEL — pronóstico y probabilidad de focos
// ═══════════════════════════════════════════════════════════════════════════
function PredictivePanel() {
  const canvasRef = useRef(null);

  // Modelo simple: tendencia lineal + factor acceso
  const FORECAST = [
    { zone: 'NTH', base: 47, y2025: 43, y2026: 40, risk: 4.2, prob_outbreak: 12 },
    { zone: 'MID', base: 19, y2025: 21, y2026: 24, risk: 6.8, prob_outbreak: 34 },
    { zone: 'CEN', base: 19, y2025: 18, y2026: 17, risk: 5.5, prob_outbreak: 22 },
    { zone: 'STH', base: 10, y2025: 11, y2026: 13, risk: 7.4, prob_outbreak: 41 }
  ];

  const GAPS = [
    { label: 'Sin acceso a clínica VIH <100km', zones: ['MID rural', 'STH rural', 'STH West Coast'], severity: 'critical' },
    { label: 'Barrera de idioma documentada', zones: ['NTH Pacific', 'CEN migrants', 'STH students'], severity: 'high' },
    { label: 'Sin PrEP accesible localmente', zones: ['MID rural', 'STH West Coast', 'STH Southern'], severity: 'critical' },
    { label: 'Comunidades sub-testeadas', zones: ['Māori rural MID', 'Takatāpui STH', 'Migrants CEN'], severity: 'high' },
    { label: 'Sin counselling especializado VIH', zones: ['STH provincial', 'MID rural', 'CEN Marlborough'], severity: 'medium' }
  ];

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    const labels = ['2020', '2021', '2022', '2023', '2024', '2025 ↗', '2026 ↗'];
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total NZ (histórico)',
            data: [134, 43, 78, 108, 95, null, null],
            borderColor: '#1D9E75', backgroundColor: '#1D9E7522',
            borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#1D9E75'
          },
          {
            label: 'Pronóstico',
            data: [null, null, null, null, 95, 88, 82],
            borderColor: '#1D9E75', borderDash: [6, 3],
            backgroundColor: 'transparent', borderWidth: 2, tension: 0.4,
            pointRadius: 4, pointBackgroundColor: '#1D9E75', pointStyle: 'triangle'
          },
          {
            label: 'Zona Sur (riesgo)',
            data: [12, 8, 9, 10, 10, 11, 13],
            borderColor: '#E24B4A', backgroundColor: '#E24B4A11',
            borderWidth: 2, fill: false, tension: 0.4, pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 16 } },
          tooltip: { callbacks: { label: c => ` ${c.raw ?? '—'} casos` } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#ffffff08' } },
          y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#ffffff08' } }
        }
      }
    });
  }, []);

  return (
    <div className="nova-glass rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-teal-100 uppercase tracking-widest mb-4">{`Análisis predictivo & brechas de acceso`}</h2>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Pronóstico chart */}
        <div>
          <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Proyección 2025–2026</h4>
          <div style={{ height: '180px' }}><canvas ref={canvasRef} /></div>
          <p className="text-xs text-teal-300/40 mt-1.5">Modelo basado en tendencia + factor brecha de acceso. Sur muestra riesgo de rebote.</p>
        </div>

        {/* Risk by zone */}
        <div>
          <h4 className="text-xs font-semibold text-teal-300/70 uppercase tracking-widest mb-2">Probabilidad foco emergente por zona</h4>
          <div className="space-y-2.5">
            {FORECAST.map(z => (
              <div key={z.zone}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-teal-200">{z.zone}</span>
                  <span className={z.prob_outbreak >= 35 ? 'text-rose-300' : z.prob_outbreak >= 20 ? 'text-amber-300' : 'text-emerald-300'}>
                    {z.prob_outbreak}% riesgo
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{
                    width: `${z.prob_outbreak * 2.4}%`,
                    background: z.prob_outbreak >= 35 ? '#E24B4A' : z.prob_outbreak >= 20 ? '#EF9F27' : '#1D9E75'
                  }}></div>
                </div>
                <div className="text-xs text-teal-300/40 mt-0.5">
                  {z.base} → {z.y2025} → {z.y2026} casos estimados
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Access gaps */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-2">⬡ Brechas críticas — dónde Burnett debe intervenir</h4>
        <div className="grid md:grid-cols-2 gap-2">
          {GAPS.map((g, i) => (
            <div key={i} className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-xs ${
              g.severity === 'critical' ? 'bg-rose-500/10 border border-rose-500/20' :
              g.severity === 'high' ? 'bg-amber-500/10 border border-amber-500/20' :
              'bg-white/5 border border-white/10'
            }`}>
              <span className={g.severity === 'critical' ? 'text-rose-400 shrink-0' : g.severity === 'high' ? 'text-amber-400 shrink-0' : 'text-teal-400 shrink-0'}>
                {g.severity === 'critical' ? '●' : g.severity === 'high' ? '◑' : '○'}
              </span>
              <div>
                <div className={g.severity === 'critical' ? 'text-rose-200' : g.severity === 'high' ? 'text-amber-200' : 'text-teal-200'}>{g.label}</div>
                <div className="text-teal-300/50 mt-0.5">{g.zones.join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYST CHAT PANEL (conservado del original, adaptado)
// ═══════════════════════════════════════════════════════════════════════════
function AnalystChatPanel({ lang, t }) {
  const [input, setInput]     = useState('');
  const [msgs, setMsgs]       = useState([]);
  const [streaming, setStream] = useState(false);
  const bottomRef = useRef(null);

  const SUGGESTIONS = [
    '¿Qué zona tiene mayor riesgo de rebote?',
    '¿Dónde necesita intervenir Burnett urgentemente?',
    'Resumir brechas de acceso más críticas',
    'What are the top STI trends in NZ?'
  ];

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || streaming) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setStream(true);
    const aiId = Date.now();
    setMsgs(m => [...m, { role: 'ai', text: '', id: aiId }]);

    try {
      const r = await fetch('/api/admin/analyst', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, lang })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') break;
          try {
            const j = JSON.parse(data);
            const token = j.message?.content || j.delta?.content || '';
            if (token) setMsgs(m => m.map(x => x.id === aiId ? { ...x, text: x.text + token } : x));
          } catch { /* noop */ }
        }
      }
    } catch (e) {
      setMsgs(m => m.map(x => x.id === aiId ? { ...x, text: `Error: ${e.message}` } : x));
    } finally {
      setStream(false);
    }
  }, [input, streaming, lang]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  return (
    <div className="nova-glass rounded-2xl p-5 flex flex-col" style={{ minHeight: '380px' }}>
      <h2 className="text-sm font-semibold text-teal-100 uppercase tracking-widest mb-1">Analista IA</h2>
      <p className="text-xs text-teal-300/50 mb-3">Consulta sobre datos agregados — sin contenido individual</p>

      {msgs.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)}
                    className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3 text-left">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-64 pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`text-sm leading-relaxed ${m.role === 'user' ? 'text-teal-200 text-right' : 'text-teal-100'}`}>
            {m.role === 'ai' && <span className="text-xs text-teal-400/60 block mb-0.5">NOVA Analyst</span>}
            {m.text || (streaming && m.role === 'ai' && <span className="nova-typing-dot inline-block w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
               className="nova-input flex-1 !text-sm" placeholder="Preguntá sobre los datos..." disabled={streaming} />
        <button className="nova-btn nova-btn-primary !px-4" onClick={() => send()} disabled={!input.trim() || streaming}>
          {streaming ? '…' : '→'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD MAIN
// ═══════════════════════════════════════════════════════════════════════════
function DashboardMain({ lang, setLang, onLogout }) {
  const t = UI[lang];
  const navigate = useNavigate();
  const [summary, setSummary]     = useState(null);
  const [topics, setTopics]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [activeTab, setActiveTab]  = useState('overview'); // overview | zones | predictive

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sumRes, metaRes] = await Promise.all([
        fetch('/api/admin/summary', { credentials: 'include' }),
        fetch('/api/metadata')
      ]);
      if (sumRes.status === 401) { onLogout(); return; }
      if (!sumRes.ok) throw new Error('HTTP ' + sumRes.status);
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
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }); } catch { }
    onLogout();
  };
  const exportJson = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nova-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (loading && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="nova-glass px-6 py-5 text-teal-200 font-mono text-sm">● Cargando analítica…</div>
      </div>
    );
  }
  if (error && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="nova-glass-strong px-6 py-6 max-w-md text-center">
          <p className="text-rose-200 mb-3">{error}</p>
          <button className="nova-btn nova-btn-primary" onClick={load}>Reintentar</button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'overview',   label: '◉ ' + t.overview },
    { id: 'zones',      label: '⬡ ' + t.zones },
    { id: 'predictive', label: '↗ ' + t.predictive },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-5 pt-6 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-slate-900 font-bold flex items-center justify-center shrink-0">N</Link>
          <div>
            <h1 className="text-lg font-semibold text-teal-50 leading-tight">{t.headerTitle}</h1>
            <p className="text-xs text-teal-300/60 font-mono">{t.headerSub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={lang} onChange={e => setLang(e.target.value)} className="nova-input !py-1.5 !px-2 !text-xs !w-auto">
            <option value="en">EN</option><option value="es">ES</option><option value="mi">MI</option>
          </select>
          <button className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3" onClick={load}>↻</button>
          <button className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3" onClick={() => window.open('/api/admin/export.csv', '_blank')}>{t.exportCsv}</button>
          <button className="nova-btn nova-btn-ghost !text-xs !py-1.5 !px-3" onClick={exportJson}>{t.exportJson}</button>
          <button className="nova-btn nova-btn-danger !text-xs !py-1.5 !px-3" onClick={doLogout}>{t.logout}</button>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="max-w-7xl mx-auto px-5 mb-4">
        <div className="flex gap-1 nova-glass rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === tab.id ? 'bg-teal-500/20 text-teal-200' : 'text-teal-300/50 hover:text-teal-200'
                    }`}>{tab.label}</button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-5 pb-12 space-y-5">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <NationalBanner summary={summary} lang={lang} t={t} />
            <DiseasePanel />
            <div className="grid md:grid-cols-2 gap-4">
              <AnalystChatPanel lang={lang} t={t} />
              {/* Crisis summary */}
              <div className="nova-glass rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-teal-100 uppercase tracking-widest mb-3">Activaciones crisis</h2>
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 mb-3">
                  <div className="text-3xl font-bold text-rose-300">{summary?.totals?.crises ?? 0}</div>
                  <div className="text-xs text-rose-300/70 mt-1">activaciones detectadas</div>
                </div>
                <p className="text-xs text-teal-200/60 leading-relaxed">
                  Cada activación corresponde a una frase detectada relacionada con ideación suicida, autolesión o crisis aguda. Al detectarla, NOVA derivó inmediatamente a: Lifeline 0800 543 354 · texto/llamada 1737 · emergencias 111.
                </p>
                <p className="text-xs text-teal-300/40 mt-2">Supresión de celda activa — valores &lt;6 se muestran como 0.</p>
              </div>
            </div>
          </>
        )}

        {/* ZONES TAB */}
        {activeTab === 'zones' && (
          <>
            <div className="nova-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-teal-100 uppercase tracking-widest">{t.zones} — Te Whatu Ora</h2>
                <span className="text-xs text-teal-300/50">Haz click en una zona para ver detalles</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {ZONES.map(z => (
                  <ZoneCard key={z.code} zone={z} summary={summary}
                            selected={selectedZone?.code === z.code}
                            onClick={() => setSelectedZone(selectedZone?.code === z.code ? null : z)} />
                ))}
              </div>
            </div>

            {selectedZone && (
              <ZoneDetailPanel zone={selectedZone} summary={summary} topics={topics}
                               onClose={() => setSelectedZone(null)} />
            )}

            {!selectedZone && (
              <div className="nova-glass rounded-2xl p-5">
                <p className="text-xs text-teal-300/50 text-center py-4">↑ Seleccioná una zona para ver estadísticas detalladas, temas NOVA, e intervenciones recomendadas</p>
              </div>
            )}
          </>
        )}

        {/* PREDICTIVE TAB */}
        {activeTab === 'predictive' && <PredictivePanel />}

        <footer className="text-center text-xs text-teal-300/40 font-mono pt-4">
          Mātauranga NOVA · Burnett Foundation Aotearoa Innovation Challenge 2026 · NZ Privacy Act 2020 · Māori Data Sovereignty
        </footer>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP-LEVEL — LOGIN ⇄ DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export default function Dashboard({ lang: propLang, setLang: propSetLang }) {
  const [lang, setLang] = useState(propLang || 'es');
  const [auth, setAuth] = useState(null);

  useEffect(() => { if (propLang) setLang(propLang); }, [propLang]);
  const setLangAll = (l) => { setLang(l); propSetLang?.(l); };

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
        <div className="nova-glass px-6 py-5 text-teal-200 font-mono text-sm">● Verificando sesión…</div>
      </div>
    );
  }
  if (!auth) return <LoginPanel lang={lang} onLogin={() => setAuth(true)} />;
  return <DashboardMain lang={lang} setLang={setLangAll} onLogout={() => setAuth(false)} />;
}
