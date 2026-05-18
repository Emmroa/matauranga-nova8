// ═══════════════════════════════════════════════════════════════════════════
// Dashboard.jsx — NOVA Analytics Dashboard — 5 tabs
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { Shield, TrendingUp, Activity, Clock } from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────
const C = {
  bg: '#010d03',
  card: {
    background: 'linear-gradient(145deg,rgba(3,20,9,.82),rgba(2,15,7,.72))',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(13,153,96,.18)',
    borderRadius: 16,
  },
  cardGold: {
    background: 'linear-gradient(145deg,rgba(12,24,8,.82),rgba(8,18,6,.72))',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(200,148,26,.22)',
    borderRadius: 16,
  },
  gridOpts: { color: 'rgba(13,153,96,.1)' },
  tickColor: 'rgba(223,240,225,.55)',
  legendColor: 'rgba(223,240,225,.7)',
};

const KF = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Outfit:wght@300;400;500;600&display=swap');
  @keyframes db-fadein   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes row-slidein { from{opacity:0;transform:translateX(-6px)}  to{opacity:1;transform:translateX(0)} }
  .db-fade { animation: db-fadein .35s ease both }
  body { margin: 0; }
`;

// ─── Shared chart defaults ─────────────────────────────────────────────────
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { labels: { color: C.legendColor, font: { family: "'Outfit',sans-serif", size: 11 }, boxWidth: 12 } },
    tooltip: { backgroundColor: 'rgba(1,13,3,.92)', titleColor: '#dff0e1', bodyColor: 'rgba(223,240,225,.7)', borderColor: 'rgba(13,153,96,.3)', borderWidth: 1 },
  },
  scales: {
    x: { grid: C.gridOpts, ticks: { color: C.tickColor, font: { family: "'Outfit',sans-serif", size: 10 } } },
    y: { grid: C.gridOpts, ticks: { color: C.tickColor, font: { family: "'Outfit',sans-serif", size: 10 } } },
  },
};

// ─── Chart hook ────────────────────────────────────────────────────────────
function useChart(ref, factory) {
  useEffect(() => {
    if (!ref.current) return;
    const chart = factory(ref.current);
    return () => { try { chart?.destroy(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Counter animation hook ────────────────────────────────────────────────
function useCounter(target, duration = 700) {
  const [val, setVal] = useState(0);
  const frameRef = useRef(null);
  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);
  return val;
}

// ─── Inline sparkline ─────────────────────────────────────────────────────
function Sparkline({ values = [], color = 'rgba(30,220,130,.75)', width = 60, height = 20 }) {
  if (!values.length) return null;
  const n = values.length;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const px = (i) => (i / Math.max(n - 1, 1)) * (width - 4) + 2;
  const py = (v) => height - 2 - ((v - min) / range) * (height - 4);
  const pts = values.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const area = `${px(0)},${height - 2} ${pts} ${px(n - 1)},${height - 2}`;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <polygon points={area} fill={color} fillOpacity={0.13} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Delta badge ───────────────────────────────────────────────────────────
function DeltaBadge({ current, previous }) {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return (
    <span style={{ fontSize: 9, color: 'rgba(30,220,130,.7)', fontWeight: 600, letterSpacing: '.06em' }}>NEW</span>
  );
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 9, color: up ? 'rgba(30,220,130,.8)' : 'rgba(248,110,110,.8)', fontWeight: 600, letterSpacing: '.02em' }}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs prior 7d
    </span>
  );
}

// ─── Login panel ──────────────────────────────────────────────────────────
function LoginPanel({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    if (!user || !pass) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      if (r.ok) { onLogin(); return; }
      const j = await r.json().catch(() => ({}));
      setErr(j.error || 'Invalid credentials');
    } catch { setErr('Could not reach server'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: "'Outfit',sans-serif" }}>
      <style>{KF}</style>
      <form onSubmit={submit} className="db-fade"
        style={{ ...C.card, width: '100%', maxWidth: 360, padding: '32px 28px', boxShadow: '0 32px 80px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: '#010d03' }}>N</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#dff0e1' }}>Dashboard access</div>
            <div style={{ fontSize: 11, color: 'rgba(223,240,225,.45)', letterSpacing: '.03em' }}>Authorised personnel only</div>
          </div>
        </div>
        {[['Username', user, setUser, 'text', 'username'], ['Password', pass, setPass, 'password', 'current-password']].map(([label, val, set, type, ac]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(223,240,225,.45)', marginBottom: 5 }}>{label}</label>
            <input type={type} autoComplete={ac} value={val} onChange={e => set(e.target.value)} disabled={busy}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(2,14,6,.7)', border: '1px solid rgba(13,153,96,.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#dff0e1', outline: 'none', fontFamily: "'Outfit',sans-serif" }} />
          </div>
        ))}
        {err && <div style={{ fontSize: 12, color: 'rgba(248,110,110,.85)', marginBottom: 12 }}>{err}</div>}
        <button type="submit" disabled={busy || !user || !pass}
          style={{ width: '100%', padding: 12, borderRadius: 11, fontSize: 13, fontWeight: 500, border: 'none', cursor: (busy || !user || !pass) ? 'not-allowed' : 'pointer', background: (!user || !pass) ? 'rgba(13,153,96,.28)' : 'linear-gradient(135deg,#0d9960,#078046 50%,#c8941a)', color: '#010d03', transition: 'all .2s' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/" style={{ fontSize: 11, color: 'rgba(223,240,225,.3)', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </form>
    </div>
  );
}

// ─── Auto-insight card ────────────────────────────────────────────────────
const INSIGHT_ICONS  = { crisis: Shield, topic: TrendingUp, engagement: Activity, peak: Clock };
const INSIGHT_COLORS = {
  green: { bg: 'rgba(16,185,129,.07)',  border: 'rgba(16,185,129,.22)', badge: 'rgba(30,220,130,.85)',  icon: 'rgba(16,185,129,.9)'  },
  amber: { bg: 'rgba(200,148,26,.07)',  border: 'rgba(200,148,26,.25)', badge: 'rgba(240,188,56,.9)',   icon: 'rgba(200,148,26,.9)'  },
  red:   { bg: 'rgba(248,110,110,.07)', border: 'rgba(248,110,110,.28)', badge: 'rgba(248,110,110,.9)', icon: 'rgba(248,110,110,.9)' },
};

function InsightCard({ type, level = 'green', title, body }) {
  const Icon   = INSIGHT_ICONS[type] || Shield;
  const colors = INSIGHT_COLORS[level] || INSIGHT_COLORS.green;
  return (
    <div style={{ ...C.card, padding: '15px 16px', background: colors.bg, borderColor: colors.border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <Icon size={15} color={colors.icon} strokeWidth={2.2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#dff0e1', lineHeight: 1.3 }}>{title}</span>
            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: colors.badge, flexShrink: 0, padding: '1px 6px', borderRadius: 5, border: `1px solid ${colors.border}` }}>
              {level === 'green' ? 'OK' : level === 'amber' ? 'WATCH' : 'ALERT'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(223,240,225,.55)', lineHeight: 1.55 }}>{body}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────
function KpiCard({ value, label, note, color = 'rgba(30,220,130,.9)', warn, rawValue, sparkValues, delta }) {
  const counted   = useCounter(typeof rawValue === 'number' ? rawValue : 0, 700);
  const displayed = typeof rawValue === 'number' ? counted.toLocaleString() : value;
  return (
    <div style={{ ...C.card, padding: '14px 14px 13px', textAlign: 'center', ...(warn ? { borderColor: `${color}44` } : {}) }}>
      {sparkValues?.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Sparkline values={sparkValues} color={color} width={60} height={20} />
        </div>
      )}
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(22px,2.4vw,34px)', fontWeight: 300, color, lineHeight: 1.1, marginBottom: 4 }}>{displayed}</div>
      <div style={{ fontSize: 11, color: '#dff0e1', fontWeight: 500, lineHeight: 1.3, marginBottom: 2 }}>{label}</div>
      {note && <div style={{ fontSize: 9.5, color: 'rgba(223,240,225,.35)', letterSpacing: '.03em', marginBottom: delta ? 5 : 0 }}>{note}</div>}
      {delta && <DeltaBadge current={delta.current} previous={delta.previous} />}
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#dff0e1', marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(223,240,225,.38)', letterSpacing: '.03em' }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — COMMAND  (live data from /api/admin/summary)
// ═══════════════════════════════════════════════════════════════════════════
const CAT_ORDER  = ['clinical','mental_health','stigma','identity','social','new_priority'];
const CAT_LABELS = { clinical:'Clinical', mental_health:'Mental Health', stigma:'Stigma', identity:'Identity', social:'Social', new_priority:'Priority' };
const CAT_COLORS = {
  clinical:     'rgba(16,185,129,.75)',
  mental_health:'rgba(248,110,110,.72)',
  stigma:       'rgba(200,148,26,.78)',
  identity:     'rgba(139,92,246,.75)',
  social:       'rgba(59,130,246,.75)',
  new_priority: 'rgba(240,188,56,.72)',
};
const CAT_HEAD = {
  clinical:     'rgba(16,185,129,.6)',
  mental_health:'rgba(248,110,110,.6)',
  stigma:       'rgba(200,148,26,.6)',
  identity:     'rgba(139,92,246,.6)',
  social:       'rgba(59,130,246,.6)',
  new_priority: 'rgba(240,188,56,.55)',
};
const LANG_LABEL = { en: 'English', mi: 'Te Reo', es: 'Español' };

const CROSSHAIR = {
  id: 'nova-crosshair',
  afterEvent(chart, { event: e }) {
    chart._cx = (e.type === 'mouseout') ? null : e.x;
  },
  afterDatasetsDraw(chart) {
    if (chart._cx == null) return;
    const { ctx, chartArea: a } = chart;
    if (!a || chart._cx < a.left || chart._cx > a.right) return;
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(223,240,225,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chart._cx, a.top);
    ctx.lineTo(chart._cx, a.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function TabCommand() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [lastAt, setLastAt]       = useState(null);
  const [age, setAge]             = useState(0);
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [period, setPeriod]       = useState('7d');
  const [tip, setTip]             = useState({ text: '', x: 0, y: 0 });
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const toggleCat = useCallback((cat) => setCollapsedCats(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  }), []);
  const showTip = useCallback((e, text) => { if (text) setTip({ text, x: e.clientX, y: e.clientY }); }, []);
  const moveTip = useCallback((e)        => setTip(t => ({ ...t, x: e.clientX, y: e.clientY })), []);
  const hideTip = useCallback(()         => setTip(t => ({ ...t, text: '' })), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/summary', { credentials: 'include' });
      if (res.status === 401) { window.location.href = '/dashboard/login'; return; }
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setData(data); setLastAt(Date.now()); setAge(0);
    } catch { /* network error — keep stale data */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  useEffect(() => {
    if (!lastAt) return;
    const tick = setInterval(() => setAge(Math.round((Date.now() - lastAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [lastAt]);

  // Chart — confidence bands, anomaly markers, gradient fill, crosshair, period filter
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const allTs = data.timeseries || [];
    const ts    = period === '7d' ? allTs.slice(-7) : period === '14d' ? allTs.slice(-14) : allTs;

    const labels     = ts.map(r => r.day.slice(5));
    const counts     = ts.map(r => r.n);
    const crisisData = ts.map(r => r.crises);

    // μ±1.5σ confidence bands
    const n   = counts.length;
    const mu  = n ? counts.reduce((s, v) => s + v, 0) / n : 0;
    const sig = n > 1 ? Math.sqrt(counts.reduce((s, v) => s + (v - mu) ** 2, 0) / n) : 0;
    const upper = labels.map(() => parseFloat((mu + 1.5 * sig).toFixed(2)));
    const lower = labels.map(() => parseFloat(Math.max(0, mu - 1.5 * sig).toFixed(2)));

    // Anomaly detection
    const hi = mu + 1.5 * sig, lo = Math.max(0, mu - 1.5 * sig);
    const ptColor  = counts.map(v => (v > hi || v < lo) ? 'rgba(248,110,110,.95)' : 'rgba(16,185,129,.9)');
    const ptRadius = counts.map(v => (v > hi || v < lo) ? 7 : 3);

    // Gradient area fill under events line
    const el   = chartRef.current;
    const ctx2 = el.getContext('2d');
    const h    = el.offsetHeight || 200;
    const grad = ctx2.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(16,185,129,.18)');
    grad.addColorStop(1, 'rgba(16,185,129,0)');

    const newData = {
      labels,
      datasets: [
        { label: 'μ+1.5σ', data: upper,      borderColor: 'rgba(16,185,129,.25)', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 1, borderDash: [4, 4] },
        { label: 'μ−1.5σ', data: lower,      borderColor: 'rgba(16,185,129,.25)', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 1, borderDash: [4, 4] },
        { label: 'Events',  data: counts,     borderColor: 'rgba(16,185,129,.88)', backgroundColor: grad, fill: 'origin', tension: 0.35, pointRadius: ptRadius, pointBackgroundColor: ptColor, pointBorderColor: 'transparent', borderWidth: 2 },
        { label: 'Crises',  data: crisisData, borderColor: 'rgba(248,110,110,.75)', backgroundColor: 'rgba(248,110,110,.06)', fill: false, tension: 0.35, pointRadius: 3, pointBackgroundColor: 'rgba(248,110,110,.9)' },
      ],
    };

    const legendFilter = item => !['μ+1.5σ', 'μ−1.5σ'].includes(item.text);
    const tipFilter    = item => !['μ+1.5σ', 'μ−1.5σ'].includes(item.dataset.label);

    if (chartInst.current) {
      chartInst.current.data = newData;
      chartInst.current.update('none');
    } else {
      chartInst.current = new Chart(el, {
        type: 'line',
        data: newData,
        options: {
          ...chartDefaults,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            ...chartDefaults.plugins,
            legend:  { ...chartDefaults.plugins.legend,  labels:  { ...chartDefaults.plugins.legend.labels,  filter: legendFilter } },
            tooltip: { ...chartDefaults.plugins.tooltip, mode: 'index', intersect: false, filter: tipFilter },
          },
        },
        plugins: [CROSSHAIR],
      });
    }
  }, [data, period]);

  useEffect(() => () => { try { chartInst.current?.destroy(); } catch {} }, []);

  if (loading) return (
    <div style={{ color: 'rgba(223,240,225,.32)', fontSize: 13, padding: '60px 0', textAlign: 'center', fontFamily: "'Outfit',sans-serif" }}>
      Loading analytics…
    </div>
  );
  if (!data) return (
    <div style={{ color: 'rgba(248,110,110,.6)', fontSize: 13, padding: '60px 0', textAlign: 'center' }}>
      Could not load data — check server status tab.
    </div>
  );

  const sessions   = data.totals?.sessions  ?? 0;
  const messages   = data.totals?.messages  ?? 0;
  const crises     = data.totals?.crises    ?? 0;
  const topLang    = [...(data.languages || [])].sort((a, b) => b.n - a.n)[0];
  const deduped    = data.topics_deduped || [];
  const maxN       = Math.max(...deduped.map(t => t.session_count), 1);
  const grouped    = Object.fromEntries(CAT_ORDER.map(c => [c, []]));
  for (const t of deduped) { if (grouped[t.category]) grouped[t.category].push(t); }
  const d          = data.deltas || {};
  const spark7d    = (data.timeseries || []).slice(-7).map(r => r.n);
  const sparkCrisis = (data.timeseries || []).slice(-7).map(r => r.crises);

  return (
    <div className="db-fade">

      {/* Tooltip */}
      {tip.text && (
        <div style={{
          position: 'fixed', left: tip.x + 14, top: tip.y - 10, zIndex: 9999,
          background: 'rgba(1,13,3,.97)', border: '1px solid rgba(13,153,96,.28)',
          borderRadius: 9, padding: '8px 12px', maxWidth: 260,
          fontSize: 11, color: 'rgba(223,240,225,.78)', lineHeight: 1.55,
          pointerEvents: 'none', boxShadow: '0 8px 28px rgba(0,0,0,.65)',
        }}>
          {tip.text}
        </div>
      )}

      {/* Freshness pill */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 7, marginBottom: 16 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: age < 65 ? 'rgba(16,185,129,.8)' : 'rgba(200,148,26,.75)', display: 'inline-block' }} />
        <span style={{ fontSize: 10, color: 'rgba(223,240,225,.3)', letterSpacing: '.05em' }}>
          Updated {age}s ago · refreshes every 60s
        </span>
      </div>

      {/* ── AGGREGATE DATA NOTICE ──────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(14,165,233,.08)',
        border: '1px solid rgba(14,165,233,.3)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 22,
        fontSize: 13,
        lineHeight: 1.6,
        color: 'rgba(220,240,255,.85)',
        fontFamily: "'DM Mono', monospace"
      }}>
        <div style={{color:'rgba(14,165,233,.95)', fontWeight:600, marginBottom:6}}>
          ⓘ Aggregate national analytics
        </div>
        Counts are aggregated nationally. Dimensions with fewer than 6 sessions
        are suppressed. Cross-tabulation of region × topic is not computed.
        No individual-level analysis is performed.
      </div>

      {/* ── AUTO-INSIGHTS ──────────────────────────────────────────────────── */}
      {(data.insights || []).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
          {data.insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}

      {/* ── SECTION 1 — KPI cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 26 }}>
        <KpiCard
          rawValue={sessions}
          label="Total sessions"
          note="Unique users"
          sparkValues={spark7d}
          delta={{ current: d.sessions_7d ?? 0, previous: d.sessions_prev7 ?? 0 }}
        />
        <KpiCard
          rawValue={messages}
          label="Events recorded"
          note="Topic detections"
          sparkValues={spark7d}
          delta={{ current: d.events_7d ?? 0, previous: d.events_prev7 ?? 0 }}
        />
        <KpiCard
          rawValue={crises}
          label="Crisis activations"
          note="Immediate referrals sent"
          color="rgba(248,110,110,.9)"
          warn={crises > 0}
          sparkValues={sparkCrisis}
          delta={{ current: d.crises_7d ?? 0, previous: d.crises_prev7 ?? 0 }}
        />
        <KpiCard
          value={topLang ? (LANG_LABEL[topLang.language] ?? topLang.language) : '—'}
          label="Most active language"
          note={topLang ? `${topLang.n} events` : 'No data yet'}
          color="rgba(200,148,26,.9)"
        />
      </div>

      {/* ── SECTION 2 — Topic breakdown ───────────────────────────────────── */}
      <div style={{ ...C.card, padding: '22px 24px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <SectionHeader
            title="Topic breakdown"
            sub={`${sessions} total session${sessions !== 1 ? 's' : ''} · each topic counted once per session`}
          />
          <span style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(223,240,225,.22)', flexShrink: 0, marginLeft: 12 }}>
            SESSIONS
          </span>
        </div>

        {CAT_ORDER.map(cat => {
          const topics = grouped[cat] || [];
          if (!topics.length) return null;
          const isOpen = !collapsedCats.has(cat);
          return (
            <div key={cat} style={{ marginBottom: 18 }}>
              {/* Category header — clickable toggle */}
              <button onClick={() => toggleCat(cat)} style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 0', display: 'flex', alignItems: 'center', gap: 7,
                marginBottom: isOpen ? 10 : 2,
              }}>
                <span style={{
                  fontSize: 10, color: CAT_HEAD[cat], display: 'inline-block',
                  transition: 'transform .22s', transform: isOpen ? 'none' : 'rotate(-90deg)',
                }}>▾</span>
                <span style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: CAT_HEAD[cat], fontWeight: 600 }}>
                  {CAT_LABELS[cat]}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(223,240,225,.2)', marginLeft: 2 }}>
                  {topics.length} topic{topics.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Collapsible body */}
              <div style={{
                maxHeight: isOpen ? `${topics.length * 30}px` : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {topics.map((t, idx) => {
                  const n   = t.session_count || 0;
                  const bar = n / maxN * 100;
                  return (
                    <div key={t.code}
                      onMouseEnter={e => showTip(e, t.description)}
                      onMouseMove={moveTip}
                      onMouseLeave={hideTip}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7,
                        animation: 'row-slidein 0.3s ease both',
                        animationDelay: `${idx * 35}ms`,
                        cursor: t.description ? 'help' : 'default',
                      }}
                    >
                      <div style={{ width: 172, flexShrink: 0, fontSize: 11, color: 'rgba(223,240,225,.62)', textAlign: 'right', lineHeight: 1.25 }}>
                        {t.label_en}
                      </div>
                      <div style={{ flex: 1, height: 10, borderRadius: 99, background: 'rgba(255,255,255,.04)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${bar}%`, minWidth: n > 0 ? 3 : 0,
                          background: CAT_COLORS[cat], borderRadius: 99,
                          transition: 'width .5s ease',
                        }} />
                      </div>
                      <div style={{ width: 74, flexShrink: 0, fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: n > 0 ? 'rgba(223,240,225,.5)' : 'rgba(223,240,225,.17)' }}>
                        {n > 0 ? `${n}` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SECTION 3 — Activity chart ────────────────────────────────────── */}
      <div style={{ ...C.card, padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <SectionHeader
            title={period === '7d' ? 'Activity — last 7 days' : period === '14d' ? 'Activity — last 14 days' : 'Activity — all time'}
            sub="Events/day · dashed = μ±1.5σ · red markers = anomalies"
          />
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginTop: 2 }}>
            {[['7d','7D'],['14d','14D'],['all','All']].map(([val, lbl]) => (
              <button key={val} onClick={() => setPeriod(val)} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 500,
                border: `1px solid ${period === val ? 'rgba(16,185,129,.45)' : 'rgba(255,255,255,.08)'}`,
                background: period === val ? 'rgba(16,185,129,.1)' : 'transparent',
                color: period === val ? 'rgba(30,220,130,.9)' : 'rgba(223,240,225,.38)',
                cursor: 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'all .18s',
              }}>{lbl}</button>
            ))}
          </div>
        </div>
        {(data.timeseries || []).length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'rgba(223,240,225,.22)' }}>
            No activity recorded yet
          </div>
        ) : (
          <canvas ref={chartRef} />
        )}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — ATLAS
// ═══════════════════════════════════════════════════════════════════════════
const ZONES = [
  { id: 'NTH', code: 'NTH',
    name: 'Northern / Te Tai Tokerau ki Tāmaki',
    districts: 'Auckland · Northland',
    hiv: 38 },
  { id: 'MID', code: 'MID',
    name: 'Midland / Te Manawa Taki',
    districts: 'Waikato · Bay of Plenty · Tairāwhiti',
    hiv: 22 },
  { id: 'CEN', code: 'CEN',
    name: 'Central / Te Ikaroa',
    districts: 'Wellington · Hawke\'s Bay · MidCentral · Whanganui · Taranaki · Nelson Marlborough',
    hiv: 18 },
  { id: 'STH', code: 'STH',
    name: 'Southern / Te Waipounamu',
    districts: 'Canterbury · West Coast · South Canterbury · Southern',
    hiv: 17 },
];

function ZoneCard({ zone }) {
  const [enName, miName] = zone.name.split(' / ');
  return (
    <div style={{ ...C.card, padding: '22px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 10, letterSpacing: '.18em', color: 'rgba(200,148,26,.7)', fontWeight: 600, textTransform: 'uppercase' }}>{zone.code}</span>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#dff0e1', marginTop: 4, lineHeight: 1.3 }}>{enName}</div>
        {miName && (
          <div style={{ fontSize: 12, color: 'rgba(223,240,225,.45)', marginTop: 2, fontStyle: 'italic' }}>{miName}</div>
        )}
        <div style={{ fontSize: 11, color: 'rgba(223,240,225,.3)', marginTop: 6 }}>{zone.districts}</div>
      </div>
      <div style={{ textAlign: 'center', padding: '16px 0 12px', borderTop: '1px solid rgba(13,153,96,.1)' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 52, fontWeight: 300, color: 'rgba(248,110,110,.85)', lineHeight: 1 }}>{zone.hiv}</div>
        <div style={{ fontSize: 10, color: 'rgba(223,240,225,.35)', marginTop: 6, letterSpacing: '.05em' }}>New HIV diagnoses · 2024</div>
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(223,240,225,.22)', textAlign: 'center', letterSpacing: '.04em' }}>
        Source: AIDS Epidemiology Group · Te Whatu Ora
      </div>
    </div>
  );
}

function TabAtlas() {
  return (
    <div className="db-fade">
      <div style={{
        background: 'rgba(14,165,233,.08)',
        border: '1px solid rgba(14,165,233,.3)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 22,
        fontSize: 13,
        lineHeight: 1.6,
        color: 'rgba(220,240,255,.85)',
        fontFamily: "'DM Mono', monospace"
      }}>
        <div style={{color:'rgba(14,165,233,.95)', fontWeight:600, marginBottom:6}}>
          ⓘ Public reference data — Aotearoa New Zealand
        </div>
        Regional aggregates published by Te Whatu Ora (AIDS Epidemiology Group, 2024).
        No individual-level analysis. NOVA does not infer, predict, or model regional
        outcomes from its own conversational data.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {ZONES.map(z => <ZoneCard key={z.id} zone={z} />)}
      </div>
      <div style={{
        marginTop: 28,
        padding: '18px 20px',
        background: 'rgba(255,255,255,.02)',
        borderLeft: '2px solid rgba(200,148,26,.4)',
        fontSize: 13,
        lineHeight: 1.7,
        color: 'rgba(220,240,225,.7)',
        fontStyle: 'italic'
      }}>
        These regional indicators support Burnett Foundation Aotearoa service
        planning. Specific outreach priorities and resource allocation are
        determined by Burnett Foundation in consultation with affected
        communities, kaupapa Māori health providers, and people living with HIV.
        NOVA does not generate community-specific recommendations.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — PRIVACY
// ═══════════════════════════════════════════════════════════════════════════
const LAWS = [
  { status: '✓', label: 'Privacy Act 2020',                        detail: 'Compliant — Zero retention, IPP 3 / IPP 5, no sensitive data stored.', color: 'rgba(30,220,130,.85)' },
  { status: '✓', label: 'IPP 3A (in force 1 May 2026)',            detail: 'Compliant — Sensitive data (health) not collected. PII scrub L1.', color: 'rgba(30,220,130,.85)' },
  { status: '✓', label: 'Health Information Privacy Code 2020',    detail: 'Compliant — No health identifiers collected. Message text never stored.', color: 'rgba(30,220,130,.85)' },
  { status: '◑', label: 'Te Mana Raraunga — Māori Data Sovereignty', detail: 'Partial action — Māori/Takatāpui Data Advisory Group not yet established.', color: 'rgba(200,148,26,.9)' },
  { status: '✓', label: 'EU Adequacy Status',                      detail: 'Compliant — NZ holds EU adequacy. Zero transfer to non-adequate jurisdictions.', color: 'rgba(30,220,130,.85)' },
  { status: '✓', label: 'Harmful Digital Communications Act 2015', detail: 'Compliant — No user content stored, no moderation required.', color: 'rgba(30,220,130,.85)' },
  { status: '○', label: 'Privacy Impact Assessment (PIA)',          detail: 'Recommended before public launch — formal PIA not yet completed.', color: 'rgba(200,148,26,.75)' },
];

function TabPrivacy() {
  const counts = LAWS.reduce((a, l) => { a[l.status] = (a[l.status] || 0) + 1; return a; }, {});
  return (
    <div className="db-fade">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ ...C.card, padding: '18px 16px', textAlign: 'center', borderColor: 'rgba(30,220,130,.28)' }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, color: 'rgba(30,220,130,.9)', fontWeight: 300 }}>{counts['✓'] || 0}</div>
          <div style={{ fontSize: 12, color: 'rgba(30,220,130,.75)', fontWeight: 500 }}>Compliant ✓</div>
        </div>
        <div style={{ ...C.card, padding: '18px 16px', textAlign: 'center', borderColor: 'rgba(200,148,26,.3)' }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, color: 'rgba(200,148,26,.9)', fontWeight: 300 }}>{counts['◑'] || 0}</div>
          <div style={{ fontSize: 12, color: 'rgba(200,148,26,.75)', fontWeight: 500 }}>Partial action ◑</div>
        </div>
        <div style={{ ...C.card, padding: '18px 16px', textAlign: 'center', borderColor: 'rgba(200,148,26,.2)' }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, color: 'rgba(200,148,26,.75)', fontWeight: 300 }}>{counts['○'] || 0}</div>
          <div style={{ fontSize: 12, color: 'rgba(200,148,26,.6)', fontWeight: 500 }}>Recommended ○</div>
        </div>
      </div>

      <div style={{ ...C.card, padding: '0', overflow: 'hidden', marginBottom: 16 }}>
        {LAWS.map((law, i) => (
          <div key={i} style={{ padding: '14px 18px', borderBottom: i < LAWS.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1, color: law.color }}>{law.status}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#dff0e1', marginBottom: 3 }}>{law.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(223,240,225,.45)', lineHeight: 1.5 }}>{law.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...C.cardGold, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>✦</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(240,188,56,.9)', marginBottom: 4 }}>Recommended before public launch</div>
          <div style={{ fontSize: 12, color: 'rgba(223,240,225,.55)', lineHeight: 1.6 }}>
            Establish a Māori/Takatāpui Data Advisory Group to oversee data governance, ensure te ao Māori perspectives inform design decisions, and fulfil Te Mana Raraunga obligations. Engage with NZAF, Body Positive, and relevant iwi health providers.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5 — STATUS
// ═══════════════════════════════════════════════════════════════════════════
function TabStatus() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  const SERVERS = [
    { name: 'Ubuntu Server',    sub: 'Catalyst Cloud NZ · c1.c4r8',       icon: '✅', color: 'rgba(30,220,130,.8)' },
    { name: 'Nginx :80',        sub: 'Reverse proxy · SSL termination',    icon: '✅', color: 'rgba(30,220,130,.8)' },
    { name: 'Express :10000',   sub: health ? (health.ok ? `Online · uptime ${Math.round(health.uptime)}s` : 'Degraded') : 'Checking…', icon: health?.ok ? '✅' : '🔧', color: health?.ok ? 'rgba(30,220,130,.8)' : 'rgba(200,148,26,.8)' },
    { name: 'Vite build',       sub: 'Production: served via Nginx',       icon: '✅', color: 'rgba(30,220,130,.7)' },
    { name: 'phi3:mini Ollama', sub: health ? (health.ollamaUp ? (health.modelLoaded ? 'Loaded · KV cache warm' : 'Running · loading') : 'Not responding') : 'Checking…', icon: '⚠️', color: 'rgba(200,148,26,.8)' },
    { name: 'Mistral 7B',       sub: 'Phase 2 — requires c1.c8r16 upgrade', icon: '❌', color: 'rgba(248,110,110,.6)' },
  ];

  const PORTS = [
    { port: '80',    label: 'Nginx',    color: 'rgba(30,220,130,.8)' },
    { port: '5173',  label: 'Frontend', color: 'rgba(200,148,26,.7)' },
    { port: '10000', label: 'Backend',  color: 'rgba(30,220,130,.8)' },
    { port: '11434', label: 'Ollama',   color: 'rgba(200,148,26,.7)' },
    { port: '22',    label: 'SSH',      color: 'rgba(139,92,246,.7)' },
  ];

  const ROADMAP = [
    { phase: 'Phase 1 — Now',         cost: '$198 NZD/month',  items: ['phi3:mini · CPU inference','5-tab analytics dashboard','Privacy Shield · zero retention','Burnett Innovation Challenge demo'], color: 'rgba(30,220,130,.8)' },
    { phase: 'Phase 2 — Grant Q3 2026', cost: '$395 NZD/month', items: ['Mistral 7B · GPU upgrade · 8K context window','NZ sexual health knowledge fine-tuning','te reo Māori cultural responsiveness · Te Whare Tapa Whā depth'], color: 'rgba(200,148,26,.8)' },
    { phase: 'Phase 3 — Scale 2027',   cost: 'TBD',            items: ['API for sexual health clinics','Healthpoint NZ integration','Direct appointment booking','iwi / DHB data federation'], color: 'rgba(139,92,246,.7)' },
  ];

  return (
    <div className="db-fade">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {SERVERS.map((s, i) => (
          <div key={i} style={{ ...C.card, padding: '16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: s.color, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(223,240,225,.4)', lineHeight: 1.4 }}>{s.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...C.card, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#dff0e1', marginBottom: 14 }}>Port mapping</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PORTS.map(p => (
            <div key={p.port} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 9, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: p.color }}>{p.port}</span>
              <span style={{ fontSize: 10, color: 'rgba(223,240,225,.45)', letterSpacing: '.05em' }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {health && (
        <div style={{ ...C.card, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
            {[
              { k: 'Memory available', v: `${health.memAvailableMb} MB` },
              { k: 'Queue size',       v: health.queueSize },
              { k: 'Queue pending',    v: health.queuePending },
              { k: 'Circuit breaker',  v: health.breakerOpen ? '⚠️ OPEN' : '✅ Closed' },
              { k: 'Model',            v: health.model },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: 'rgba(223,240,225,.38)' }}>{k}:</span>
                <span style={{ color: '#dff0e1', fontWeight: 500 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {ROADMAP.map(r => (
          <div key={r.phase} style={{ ...C.card, padding: '18px 16px', borderColor: `${r.color}33` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: r.color, marginBottom: 4 }}>{r.phase}</div>
            <div style={{ fontSize: 10, color: 'rgba(223,240,225,.35)', marginBottom: 12, letterSpacing: '.04em' }}>{r.cost}</div>
            {r.items.map((item, i) => (
              <div key={i} style={{ fontSize: 11, color: 'rgba(223,240,225,.55)', padding: '4px 0', borderBottom: i < r.items.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', lineHeight: 1.4 }}>→ {item}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6 — INSTITUTIONAL ACTIONS (M1: Social Stress Tracker + M2: PII Audit)
// ═══════════════════════════════════════════════════════════════════════════
const ACTION_INDICATORS = [
  { key: 'Internal_Stigma',          label: 'Internal Stigma',          priority: 'High'     },
  { key: 'External_Discrimination',  label: 'External Discrimination',  priority: 'High'     },
  { key: 'Bullying',                 label: 'Bullying',                 priority: 'High'     },
  { key: 'Online_Hate',              label: 'Online Hate',              priority: 'Medium'   },
  { key: 'Workplace_Discrimination', label: 'Workplace Discrimination', priority: 'High'     },
  { key: 'Medical_Discrimination',   label: 'Medical Discrimination',   priority: 'Critical' },
  { key: 'WINZ',                     label: 'WINZ / Work & Income',     priority: 'Medium'   },
  { key: 'Housing_Council',          label: 'Housing / Council',        priority: 'Medium'   },
  { key: 'Legal_Rights',             label: 'Legal Rights',             priority: 'Medium'   },
  { key: 'Immigration',              label: 'Immigration / Visa',       priority: 'Medium'   },
  { key: 'Loneliness',               label: 'Loneliness',               priority: 'High'     },
  { key: 'Anxiety',                  label: 'Anxiety',                  priority: 'High'     },
  { key: 'Depression',               label: 'Depression',               priority: 'High'     },
];
const STATUS_STYLE = {
  'Pending':     { color: 'rgba(223,240,225,.35)', border: 'rgba(223,240,225,.15)', bg: 'rgba(223,240,225,.05)' },
  'In Progress': { color: '#c8941a',               border: 'rgba(200,148,26,.4)',   bg: 'rgba(200,148,26,.12)'  },
  'Completed':   { color: '#0d9960',               border: 'rgba(13,153,96,.4)',    bg: 'rgba(13,153,96,.12)'   },
};
const PRI_COLOR = { Critical: 'rgba(248,110,110,.85)', High: 'rgba(200,148,26,.8)', Medium: 'rgba(223,240,225,.45)' };
const PII_TYPES = [
  { key: 'email',   label: 'Email'   },
  { key: 'phone',   label: 'Phone'   },
  { key: 'nhi',     label: 'NHI'     },
  { key: 'ird',     label: 'IRD'     },
  { key: 'card',    label: 'Card'    },
  { key: 'address', label: 'Address' },
];

function TabActions() {
  const [data,    setData]    = useState(null);
  const [acts,    setActs]    = useState({});
  const [saving,  setSaving]  = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/summary', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/admin/actions', { credentials: 'include' }).then(r => r.ok ? r.json() : {}),
    ]).then(([summary, actions]) => {
      setData(summary);
      setActs(actions || {});
    }).finally(() => setLoading(false));
  }, []);

  const setStatus = async (key, status) => {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const r = await fetch('/api/admin/actions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, status }),
      });
      if (r.ok) setActs(prev => ({ ...prev, [key]: { status, updatedAt: new Date().toISOString() } }));
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const topicMap = {};
  (data?.topics || []).forEach(t => { topicMap[t.code] = t.n; });
  const pii = data?.piiEvents ?? {};

  if (loading) return (
    <div style={{ color: 'rgba(223,240,225,.32)', fontSize: 13, padding: '60px 0', textAlign: 'center' }}>
      Loading actions…
    </div>
  );

  return (
    <div className="db-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* M2 — Live Privacy Audit */}
      <div style={{ ...C.cardGold, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(200,148,26,.9)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>🔐 Live Privacy Audit — Layer 1</div>
            <div style={{ fontSize: 11, color: 'rgba(223,240,225,.4)' }}>PII interceptado antes de llegar a la IA · Zero Data Retention</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 38, fontWeight: 300, color: 'rgba(200,148,26,.9)', lineHeight: 1 }}>{pii.total ?? 0}</div>
            <div style={{ fontSize: 10, color: 'rgba(223,240,225,.35)', letterSpacing: '.08em', marginTop: 2 }}>TOTAL INTERCEPTED</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {PII_TYPES.map(({ key, label }) => (
            <div key={key} style={{ background: 'rgba(200,148,26,.06)', border: '1px solid rgba(200,148,26,.14)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(223,240,225,.5)' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(200,148,26,.85)' }}>{pii[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* M1 — Social Stress Indicators */}
      <div style={{ ...C.card, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(30,220,130,.8)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>
          📋 Social Stress Indicators — Institutional Response Tracker
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(13,153,96,.2)' }}>
                {['Indicator', 'Detected', 'Priority', 'Status', 'Last Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'rgba(223,240,225,.38)', fontWeight: 500, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTION_INDICATORS.map(({ key, label, priority }) => {
                const count    = topicMap[key] ?? 0;
                const act      = acts[key] || {};
                const status   = act.status || 'Pending';
                const ss       = STATUS_STYLE[status];
                const updated  = act.updatedAt
                  ? new Date(act.updatedAt).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })
                  : '—';
                return (
                  <tr key={key} style={{ borderBottom: '1px solid rgba(13,153,96,.07)', animation: 'row-slidein .25s ease both' }}>
                    <td style={{ padding: '9px 12px', color: '#dff0e1', fontWeight: count > 0 ? 500 : 400 }}>{label}</td>
                    <td style={{ padding: '9px 12px', color: count > 0 ? 'rgba(30,220,130,.9)' : 'rgba(223,240,225,.28)', fontWeight: 600 }}>{count}</td>
                    <td style={{ padding: '9px 12px', color: PRI_COLOR[priority], fontSize: 11, fontWeight: 600 }}>{priority}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['Pending', 'In Progress', 'Completed'].map(s => {
                          const active = status === s;
                          const st = STATUS_STYLE[s];
                          return (
                            <button key={s} disabled={saving[key]} onClick={() => setStatus(key, s)}
                              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: `1px solid ${active ? st.border : 'rgba(223,240,225,.1)'}`, background: active ? st.bg : 'transparent', color: active ? st.color : 'rgba(223,240,225,.28)', cursor: saving[key] ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'all .15s', whiteSpace: 'nowrap' }}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'rgba(223,240,225,.32)', fontSize: 11 }}>{updated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7 — INTELLIGENCE (M3: Internal Chat + M4: PDF Report Generator)
// ═══════════════════════════════════════════════════════════════════════════
const QUICK_QUESTIONS = [
  'Resumen ejecutivo de esta semana',
  'Análisis de indicadores de crisis',
  'Top 5 temas nacionales',
  'Comparar este mes vs anterior',
  'Reporte para el directorio',
];

function TabIntelligence() {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [summary,   setSummary]   = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/summary', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(setSummary);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = async (question) => {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setInput('');
    setSending(true);
    const qId = `${Date.now()}-q`;
    const aId = `${Date.now()}-a`;
    setMessages(m => [
      ...m,
      { id: qId, role: 'user',      text: q },
      { id: aId, role: 'assistant', text: '', streaming: true },
    ]);

    const safeCtx = summary ? {
      topics:            (summary.topics || []).slice(0, 50).map(t => ({ code: t.code, n: t.n, category: t.category })),
      languages:         summary.languages   || {},
      crisisActivations: summary.totals?.crises ?? 0,
      piiEvents:         summary.piiEvents   || {},
    } : {};

    try {
      const res = await fetch('/api/admin/assistant', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: safeCtx }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf = '';
      const dispatch = (frame) => {
        if (!frame.trim()) return;
        let evt = 'message';
        const dataLines = [];
        for (const raw of frame.split('\n')) {
          const line = raw.trimEnd();
          if (line.startsWith('event:'))      evt = line.slice(6).trim();
          else if (line.startsWith('data:'))  dataLines.push(line.slice(5).trimStart());
        }
        if (!dataLines.length) return;
        let payload;
        try { payload = JSON.parse(dataLines.join('\n')); } catch { return; }
        if (evt === 'token') {
          setMessages(m => m.map(x => x.id === aId ? { ...x, text: (x.text || '') + (payload.t || '') } : x));
        } else if (evt === 'fallback') {
          setMessages(m => m.map(x => x.id === aId ? { ...x, text: payload.text, streaming: false } : x));
        } else if (evt === 'done') {
          setMessages(m => m.map(x => x.id === aId ? { ...x, streaming: false } : x));
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
    } catch {
      setMessages(m => m.map(x => x.id === aId
        ? { ...x, text: 'Error al conectar con el asistente. Verificá el estado del servidor.', streaming: false, error: true }
        : x));
    } finally {
      setSending(false);
    }
  };

  const generatePDF = async (type) => {
    const { default: jsPDF }    = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const TEAL    = [13, 153, 96];
    const GOLD    = [200, 148, 26];
    const now     = new Date();
    const ym      = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dateStr = now.toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
    const topics  = summary?.topics  || [];
    const totals  = summary?.totals  || {};
    const pii     = summary?.piiEvents || {};
    const langs   = summary?.languages || {};

    // ── Cover page ──────────────────────────────────────────────────────────
    doc.setFillColor(1, 13, 3);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36); doc.setTextColor(...TEAL);
    doc.text('NOVA', 20, 52);
    doc.setFontSize(14); doc.setTextColor(223, 240, 225);
    doc.text('Mātauranga NOVA — Analytics', 20, 64);
    doc.setFontSize(11); doc.setTextColor(...GOLD);
    const reportTitles = {
      monthly:  `Monthly Report — ${ym}`,
      crisis:   `Crisis Activations Report — ${ym}`,
      privacy:  `Privacy & PII Audit — ${ym}`,
      regional: `Regional Distribution — ${ym}`,
    };
    doc.text(reportTitles[type] || `Report — ${ym}`, 20, 76);
    doc.setFontSize(9); doc.setTextColor(90, 110, 90);
    doc.text(`Generated: ${dateStr}`, 20, 87);
    doc.text('CONFIDENTIAL — Burnett Foundation Innovation Challenge 2026', 20, 93);

    // ── Content pages ────────────────────────────────────────────────────────
    if (type === 'monthly' || type === 'regional') {
      doc.addPage();
      doc.setFillColor(1, 13, 3); doc.rect(0, 0, 210, 297, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.setTextColor(...TEAL); doc.text('Executive Summary', 20, 25);
      doc.setFontSize(10);
      [
        [totals.sessions ?? 0, 'Total Sessions'],
        [totals.messages  ?? 0, 'Total Messages'],
        [totals.crises    ?? 0, 'Crisis Activations'],
        [Object.keys(langs).length, 'Languages Active'],
      ].forEach(([val, lbl], i) => {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...GOLD);
        doc.text(String(val), 20, 40 + i * 10);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(223, 240, 225);
        doc.text(lbl, 38, 40 + i * 10);
      });

      const topThree = [...topics].sort((a, b) => b.n - a.n).slice(0, 3);
      if (topThree.length) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEAL);
        doc.text('Top 3 Topics', 20, 86);
        topThree.forEach((t, i) => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(223, 240, 225);
          doc.text(`${i + 1}. ${t.label || t.code}`, 24, 95 + i * 8);
          doc.setTextColor(...GOLD); doc.text(String(t.n), 110, 95 + i * 8);
        });
      }

      if (topics.length) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...TEAL);
        doc.text('Topic Distribution', 20, 124);
        autoTable(doc, {
          startY: 130, margin: { left: 20, right: 20 },
          head: [['Topic', 'Count', 'Category']],
          body: topics.slice(0, 25).map(t => [t.label || t.code, t.n, t.category || '']),
          styles: { fillColor: [2, 20, 8], textColor: [223, 240, 225], fontSize: 9, lineColor: [20, 60, 30], lineWidth: 0.1 },
          headStyles: { fillColor: [8, 50, 22], textColor: [30, 220, 130], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [3, 25, 10] },
        });
      }
    }

    if (type === 'crisis') {
      doc.addPage();
      doc.setFillColor(1, 13, 3); doc.rect(0, 0, 210, 297, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TEAL);
      doc.text('Crisis Activations', 20, 25);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(223, 240, 225);
      doc.text(`Total activations: ${totals.crises ?? 0}`, 20, 38);
      doc.setTextColor(100, 140, 100);
      doc.text('Each activation surfaced Lifeline 0800 543 354 / 1737 / 111 at point of detection.', 20, 46);
      const crisisTopics = topics.filter(t => ['Suicide_Ideation', 'Self_Harm', 'Crisis_Acute'].includes(t.code));
      if (crisisTopics.length) {
        autoTable(doc, {
          startY: 56, margin: { left: 20, right: 20 },
          head: [['Crisis Indicator', 'Count']],
          body: crisisTopics.map(t => [t.label || t.code, t.n]),
          styles: { fillColor: [2, 20, 8], textColor: [223, 240, 225], fontSize: 10 },
          headStyles: { fillColor: [60, 10, 10], textColor: [248, 110, 110], fontStyle: 'bold' },
        });
      }
    }

    if (type === 'privacy') {
      doc.addPage();
      doc.setFillColor(1, 13, 3); doc.rect(0, 0, 210, 297, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...GOLD);
      doc.text('Privacy & PII Audit — Layer 1', 20, 25);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(223, 240, 225);
      doc.text(`Total PII events intercepted (process lifetime): ${pii.total ?? 0}`, 20, 38);
      autoTable(doc, {
        startY: 48, margin: { left: 20, right: 20 },
        head: [['PII Type', 'Count']],
        body: [
          ['Email address',              pii.email   ?? 0],
          ['NZ phone number',            pii.phone   ?? 0],
          ['NHI (National Health Index)',pii.nhi     ?? 0],
          ['IRD number',                 pii.ird     ?? 0],
          ['Credit card number',         pii.card    ?? 0],
          ['Street address',             pii.address ?? 0],
        ],
        styles: { fillColor: [2, 20, 8], textColor: [223, 240, 225], fontSize: 10 },
        headStyles: { fillColor: [28, 18, 2], textColor: [200, 148, 26], fontStyle: 'bold' },
      });
      const footY = (doc.lastAutoTable?.finalY || 100) + 14;
      doc.setFontSize(9); doc.setTextColor(80, 100, 80);
      doc.text('All PII was intercepted before reaching the AI model. No user text is stored anywhere.', 20, footY);
      doc.text('ZDR · NZ Privacy Act 2020 · Health Information Privacy Code 2020', 20, footY + 7);
    }

    // ── Footer on every page ─────────────────────────────────────────────────
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(50, 80, 50);
      doc.text('ZDR · NZ Privacy Act 2020 · HIPC 2020 · Mātauranga NOVA · Burnett Foundation', 20, 290);
      doc.text(`Page ${i} / ${pages}`, 190, 290, { align: 'right' });
    }
    doc.save(`nova-report-${type}-${ym}.pdf`);
  };

  return (
    <div className="db-fade" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

      {/* M3 — Internal Chat */}
      <div style={{ flex: '1 1 55%', minWidth: 280, ...C.card, padding: 0, display: 'flex', flexDirection: 'column', height: 580 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(13,153,96,.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(30,220,130,.8)' }}>🤖 Intelligence Assistant</div>
          <div style={{ fontSize: 10, color: 'rgba(200,148,26,.75)', background: 'rgba(200,148,26,.08)', border: '1px solid rgba(200,148,26,.2)', borderRadius: 5, padding: '2px 8px' }}>Solo datos anónimos · ZDR</div>
        </div>

        {/* Quick questions */}
        <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 5, borderBottom: '1px solid rgba(13,153,96,.1)', flexShrink: 0 }}>
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => ask(q)} disabled={sending}
              style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(13,153,96,.22)', background: 'rgba(13,153,96,.07)', color: 'rgba(223,240,225,.65)', cursor: sending ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'all .15s' }}>
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ color: 'rgba(223,240,225,.22)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
              Hacé una pregunta sobre los datos anónimos del sistema.
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="db-fade" style={{
              alignSelf:    msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth:     '86%',
              background:   msg.role === 'user' ? 'rgba(13,153,96,.14)' : 'rgba(255,255,255,.04)',
              border:       `1px solid ${msg.role === 'user' ? 'rgba(13,153,96,.24)' : 'rgba(255,255,255,.07)'}`,
              borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
              padding:      '8px 12px',
              fontSize:     12,
              color:        msg.error ? 'rgba(248,110,110,.8)' : '#dff0e1',
              lineHeight:   1.6,
              whiteSpace:   'pre-wrap',
            }}>
              {msg.text || (msg.streaming ? <span style={{ opacity: 0.35 }}>…</span> : '')}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(13,153,96,.14)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            placeholder="Preguntá sobre los datos…" disabled={sending}
            style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(13,153,96,.18)', borderRadius: 8, padding: '7px 12px', color: '#dff0e1', fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: 'none' }} />
          <button onClick={() => ask(input)} disabled={sending || !input.trim()}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: (sending || !input.trim()) ? 'rgba(13,153,96,.25)' : '#0d9960', color: '#010d03', fontSize: 13, fontWeight: 700, cursor: (sending || !input.trim()) ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'background .15s' }}>
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>

      {/* M4 — PDF Report Generator */}
      <div style={{ flex: '1 1 34%', minWidth: 210, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...C.card, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(30,220,130,.8)', marginBottom: 14 }}>📄 Report Generator</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { type: 'monthly',  label: '📄 Generar Reporte Mensual', primary: true  },
              { type: 'crisis',   label: '📊 Reporte de Crisis',        primary: false },
              { type: 'privacy',  label: '🛡️ Reporte de Privacidad',    primary: false },
              { type: 'regional', label: '📊 Reporte de Distribución',  primary: false },
            ].map(({ type, label, primary }) => (
              <button key={type} onClick={() => generatePDF(type)}
                style={{ width: '100%', padding: primary ? '10px 16px' : '8px 14px', borderRadius: 9, border: `1px solid ${primary ? 'rgba(13,153,96,.38)' : 'rgba(13,153,96,.18)'}`, background: primary ? 'rgba(13,153,96,.13)' : 'rgba(13,153,96,.05)', color: primary ? 'rgba(30,220,130,.9)' : 'rgba(223,240,225,.55)', fontSize: primary ? 13 : 12, fontWeight: primary ? 600 : 400, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textAlign: 'left', transition: 'all .15s' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...C.cardGold, padding: '14px 16px', fontSize: 11, color: 'rgba(223,240,225,.42)', lineHeight: 1.65 }}>
          <div style={{ color: 'rgba(200,148,26,.75)', fontWeight: 600, marginBottom: 5 }}>ZDR Compliance</div>
          Los reportes contienen solo datos agregados anónimos. Sin texto de usuarios, sin IDs de sesión, sin PII.
          <br /><br />
          NZ Privacy Act 2020 · HIPC 2020
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shell + Root
// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'command',      label: '◉ Command'      },
  { id: 'atlas',        label: '⬡ Atlas'        },
  { id: 'privacy',      label: '🛡 Privacy'     },
  { id: 'status',       label: '◎ Status'       },
  { id: 'actions',      label: '📋 Actions'     },
  { id: 'intelligence', label: '🤖 Intelligence' },
];

function DashboardShell({ children, tab, setTab, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Outfit',sans-serif", color: '#dff0e1' }}>
      <style>{KF}</style>

      <header style={{ background: 'linear-gradient(180deg,rgba(2,18,8,.92) 0%,rgba(1,13,5,.78) 100%)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderBottom: '1px solid rgba(13,153,96,.14)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#0d9960,#078046 55%,#c8941a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: '#010d03' }}>N</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, fontWeight: 300 }}>
              Mātauranga <span style={{ color: 'rgba(200,148,26,.88)' }}>NOVA</span> <span style={{ color: 'rgba(223,240,225,.4)', fontSize: 12 }}>· Analytics</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/" style={{ fontSize: 11, color: 'rgba(223,240,225,.38)', textDecoration: 'none', padding: '5px 12px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7 }}>← Home</Link>
            <button onClick={onLogout} style={{ fontSize: 11, color: 'rgba(248,110,110,.55)', background: 'none', border: '1px solid rgba(248,110,110,.14)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: tab === t.id ? 600 : 400, background: 'none', border: 'none', cursor: 'pointer', color: tab === t.id ? 'rgba(30,220,130,.95)' : 'rgba(223,240,225,.42)', borderBottom: tab === t.id ? '2px solid rgba(13,153,96,.8)' : '2px solid transparent', transition: 'all .18s', fontFamily: "'Outfit',sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 48px' }}>
        {children}
      </main>
    </div>
  );
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab]       = useState('command');

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthed(false);
  }, []);

  if (authed === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: 'rgba(223,240,225,.5)', fontFamily: "'Outfit',sans-serif", fontSize: 13 }}>
        <style>{KF}</style>
        Checking credentials…
      </div>
    );
  }

  if (!authed) return <LoginPanel onLogin={() => setAuthed(true)} />;

  return (
    <DashboardShell tab={tab} setTab={setTab} onLogout={logout}>
      {tab === 'command'      && <TabCommand      key="command"      />}
      {tab === 'atlas'        && <TabAtlas        key="atlas"        />}
      {tab === 'privacy'      && <TabPrivacy      key="privacy"      />}
      {tab === 'status'       && <TabStatus       key="status"       />}
      {tab === 'actions'      && <TabActions      key="actions"      />}
      {tab === 'intelligence' && <TabIntelligence key="intelligence" />}
    </DashboardShell>
  );
}
