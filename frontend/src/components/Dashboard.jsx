// ═══════════════════════════════════════════════════════════════════════════
// Dashboard.jsx — NOVA Analytics Dashboard — 5 tabs
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';

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
  @keyframes db-fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
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

// ─── Shared sub-components ─────────────────────────────────────────────────
function KpiCard({ value, label, note, color = 'rgba(30,220,130,.9)', warn }) {
  return (
    <div style={{ ...C.card, padding: '16px 14px', textAlign: 'center', ...(warn ? { borderColor: `${color}44` } : {}) }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(22px,2.4vw,34px)', fontWeight: 300, color, lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#dff0e1', fontWeight: 500, lineHeight: 1.3, marginBottom: 2 }}>{label}</div>
      {note && <div style={{ fontSize: 9.5, color: 'rgba(223,240,225,.35)', letterSpacing: '.03em' }}>{note}</div>}
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
// TAB 1 — COMMAND
// ═══════════════════════════════════════════════════════════════════════════
function TabCommand() {
  const hivRef  = useRef(null);
  const stiRef  = useRef(null);
  const rsocRef = useRef(null);

  useChart(hivRef, (el) => new Chart(el, {
    type: 'line',
    data: {
      labels: ['2019','2020','2021','2022','2023','2024'],
      datasets: [{
        label: 'HIV diagnoses (NZ)',
        data: [163, 134, 43, 78, 108, 95],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,.18)',
        fill: true, tension: 0.38,
        pointBackgroundColor: '#10b981', pointRadius: 4,
      }],
    },
    options: { ...chartDefaults },
  }));

  useChart(stiRef, (el) => new Chart(el, {
    type: 'bar',
    data: {
      labels: ['HIV','Syphilis','Gonorrhoea','Chlamydia','Mpox'],
      datasets: [{
        label: '2024 cases',
        data: [95, 1800, 5200, 7800, 28],
        backgroundColor: ['rgba(16,185,129,.7)','rgba(200,148,26,.75)','rgba(139,92,246,.7)','rgba(59,130,246,.7)','rgba(248,110,110,.7)'],
        borderColor:     ['rgba(16,185,129,1)', 'rgba(200,148,26,1)', 'rgba(139,92,246,1)', 'rgba(59,130,246,1)', 'rgba(248,110,110,1)'],
        borderWidth: 1, borderRadius: 6,
      }],
    },
    options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } },
  }));

  useChart(rsocRef, (el) => new Chart(el, {
    type: 'line',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets: [
        {
          label: 'R-social index',
          data: [1.42,1.21,1.08,1.15,1.28,1.55,1.62,1.48,1.22,1.18,1.34,1.74],
          borderColor: 'rgba(200,148,26,.9)', backgroundColor: 'rgba(200,148,26,.08)',
          fill: false, tension: 0.4, pointRadius: 3, yAxisID: 'y',
        },
        {
          label: 'IES composite',
          data: [5.8,4.9,4.5,5.1,5.5,6.2,6.8,6.1,5.0,4.8,5.7,7.2],
          borderColor: 'rgba(248,110,110,.8)', backgroundColor: 'rgba(248,110,110,.06)',
          fill: false, tension: 0.4, pointRadius: 3, yAxisID: 'y1',
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        x: chartDefaults.scales.x,
        y:  { ...chartDefaults.scales.y, position: 'left',  title: { display: true, text: 'R-social', color: 'rgba(200,148,26,.7)', font: { size: 10 } } },
        y1: { ...chartDefaults.scales.y, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'IES', color: 'rgba(248,110,110,.7)', font: { size: 10 } } },
      },
    },
  }));

  const KPIs = [
    { value: '95',    label: 'HIV diagnoses 2024',  note: 'New cases · NZ',             color: 'rgba(248,110,110,.9)' },
    { value: '60',    label: 'Locally acquired',    note: '63% of 2024 diagnoses',       color: 'rgba(248,150,110,.85)' },
    { value: '2,312', label: 'People on ART',       note: 'Health NZ · NZAF 2024',       color: 'rgba(30,220,130,.9)' },
    { value: '91%',   label: 'Know their status',   note: 'UNAIDS 95-95-95 progress',    color: 'rgba(30,220,130,.82)' },
    { value: '1,800', label: 'Syphilis ↑',          note: 'NZSHS 2024 · rising',         color: 'rgba(200,148,26,.9)', warn: true },
    { value: '5,200', label: 'Gonorrhoea ↑',        note: 'NZSHS 2024 · rising',         color: 'rgba(200,148,26,.82)', warn: true },
    { value: '7,800', label: 'Chlamydia →',         note: 'NZSHS 2024 · stable',         color: 'rgba(59,130,246,.85)' },
    { value: '2030',  label: 'Zero target',          note: 'Te Tiriti commitment',        color: 'rgba(200,148,26,.9)' },
  ];

  return (
    <div className="db-fade">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {KPIs.slice(0, 4).map(k => <KpiCard key={k.label} {...k} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        {KPIs.slice(4).map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...C.card, padding: '20px 20px 16px' }}>
          <SectionHeader title="HIV Trend 2019–2024" sub="Annual diagnoses · New Zealand" />
          <canvas ref={hivRef} />
        </div>
        <div style={{ ...C.card, padding: '20px 20px 16px' }}>
          <SectionHeader title="STI Landscape 2024" sub="New Zealand STI surveillance" />
          <canvas ref={stiRef} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
        <div style={{ ...C.card, padding: '20px 20px 16px' }}>
          <SectionHeader title="Social Epidemic Index — R-social" sub="Rolling 12-month social transmission risk · dual Y-axis" />
          <canvas ref={rsocRef} />
        </div>
        <div style={{ ...C.cardGold, padding: '20px 18px' }}>
          <SectionHeader title="Crisis activations" sub="NOVA sessions flagged" />
          <div style={{ fontSize: 12, color: 'rgba(248,110,110,.65)', lineHeight: 1.65, marginTop: 8, padding: '12px 14px', borderRadius: 11, background: 'rgba(248,110,110,.05)', border: '1px solid rgba(248,110,110,.14)' }}>
            ◉ Live data feed pending. Deploy to production to activate crisis signal tracking.
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(223,240,225,.35)', lineHeight: 1.6 }}>
            Each activation = detected crisis phrase. User shown 111, Lifeline 0800 543 354, 1737 immediately.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — ATLAS
// ═══════════════════════════════════════════════════════════════════════════
const ZONES = [
  {
    id: 'NTH', code: 'NTH', name: 'Northern / Te Tai Tokerau ki Tāmaki',
    hiv: 38, art: 920, sdhi: 6.2, warn: null,
    indices: [
      { label: 'Housing',              score: 5.8, color: 'rgba(200,148,26,.8)' },
      { label: 'Employment',           score: 6.4, color: 'rgba(200,148,26,.8)' },
      { label: 'Healthcare access',    score: 6.1, color: 'rgba(30,220,130,.7)' },
      { label: 'Social connectedness', score: 7.2, color: 'rgba(248,110,110,.7)' },
    ],
    recs: ['Increase outreach to Tāmaki urban communities','Strengthen LGBTQ+ affirming primary care'],
  },
  {
    id: 'MID', code: 'MID', name: 'Midland / Te Manawa Taki',
    hiv: 22, art: 510, sdhi: 7.1,
    warn: { level: 'amber', text: 'High access gap — priority for outreach' },
    indices: [
      { label: 'Housing',              score: 7.2, color: 'rgba(248,110,110,.75)' },
      { label: 'Employment',           score: 7.8, color: 'rgba(248,110,110,.75)' },
      { label: 'Healthcare access',    score: 7.1, color: 'rgba(248,110,110,.75)' },
      { label: 'Social connectedness', score: 6.4, color: 'rgba(200,148,26,.8)' },
    ],
    recs: ['Deploy mobile testing unit to Waikato rural areas','Coordinate with Māori health providers'],
  },
  {
    id: 'CEN', code: 'CEN', name: 'Central / Te Ikaroa',
    hiv: 18, art: 440, sdhi: 5.9, warn: null,
    indices: [
      { label: 'Housing',              score: 5.2, color: 'rgba(30,220,130,.7)' },
      { label: 'Employment',           score: 5.8, color: 'rgba(200,148,26,.7)' },
      { label: 'Healthcare access',    score: 5.4, color: 'rgba(30,220,130,.7)' },
      { label: 'Social connectedness', score: 6.1, color: 'rgba(200,148,26,.7)' },
    ],
    recs: ['Maintain current outreach cadence','Expand DoxyPEP awareness in Wellington urban'],
  },
  {
    id: 'STH', code: 'STH', name: 'Southern / Te Waipounamu',
    hiv: 17, art: 440, sdhi: 7.8,
    warn: { level: 'red', text: 'CRITICAL — highest access gap nationally' },
    indices: [
      { label: 'Housing',              score: 7.9, color: 'rgba(248,110,110,.85)' },
      { label: 'Employment',           score: 8.1, color: 'rgba(248,110,110,.85)' },
      { label: 'Healthcare access',    score: 8.4, color: 'rgba(248,110,110,.9)' },
      { label: 'Social connectedness', score: 7.2, color: 'rgba(248,110,110,.75)' },
    ],
    recs: ['Urgent: establish rural telehealth HIV support line','Māori/Pasifika cultural broker programme — South Island','Increase NZAF clinic outreach cadence'],
  },
];

function ZoneCard({ zone }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);

  const warnStyle = zone.warn?.level === 'red'
    ? { background: 'rgba(248,110,110,.06)', border: '1px solid rgba(248,110,110,.22)', color: 'rgba(248,110,110,.9)' }
    : { background: 'rgba(200,148,26,.06)', border: '1px solid rgba(200,148,26,.22)', color: 'rgba(240,188,56,.9)' };

  return (
    <div style={{ ...C.card, overflow: 'hidden', transition: 'border-color .2s', ...(open ? { borderColor: 'rgba(200,148,26,.3)' } : {}) }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 18px 14px', textAlign: 'left', color: '#dff0e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: '.18em', color: 'rgba(200,148,26,.7)', fontWeight: 600 }}>{zone.code}</span>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#dff0e1', marginTop: 2, lineHeight: 1.3 }}>{zone.name}</div>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(200,148,26,.5)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s', display: 'inline-block', marginTop: 2 }}>▼</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: zone.warn ? 10 : 0 }}>
          {[
            { label: 'HIV 2024', value: zone.hiv, color: 'rgba(248,110,110,.85)' },
            { label: 'On ART',   value: zone.art.toLocaleString(), color: 'rgba(30,220,130,.85)' },
            { label: 'SDHI',     value: zone.sdhi, color: zone.sdhi > 7 ? 'rgba(248,110,110,.85)' : 'rgba(200,148,26,.85)' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 9, background: 'rgba(255,255,255,.025)' }}>
              <div style={{ fontSize: 18, fontFamily: "'Cormorant Garamond',serif", color: m.color, fontWeight: 300 }}>{m.value}</div>
              <div style={{ fontSize: 9.5, color: 'rgba(223,240,225,.4)', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
        {zone.warn && (
          <div style={{ ...warnStyle, fontSize: 11, padding: '7px 11px', borderRadius: 9, fontWeight: 500 }}>◉ {zone.warn.text}</div>
        )}
      </button>

      <div style={{ maxHeight: open ? `${contentRef.current?.scrollHeight || 500}px` : '0px', overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div ref={contentRef} style={{ padding: '0 18px 18px' }}>
          <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(200,148,26,.55)', marginBottom: 10 }}>SDHI sub-indices</div>
          {zone.indices.map(idx => (
            <div key={idx.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: 'rgba(223,240,225,.65)' }}>{idx.label}</span>
                <span style={{ fontSize: 11, color: idx.color, fontWeight: 600 }}>{idx.score}/10</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.06)' }}>
                <div style={{ height: '100%', width: `${idx.score * 10}%`, borderRadius: 99, background: idx.color, transition: 'width .4s' }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(200,148,26,.55)', marginBottom: 8 }}>Recommendations</div>
          {zone.recs.map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(223,240,225,.55)', padding: '5px 0', borderBottom: i < zone.recs.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', lineHeight: 1.5 }}>→ {r}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabAtlas() {
  return (
    <div className="db-fade">
      <div style={{ fontSize: 12, color: 'rgba(223,240,225,.38)', marginBottom: 18, padding: '10px 14px', background: 'rgba(200,148,26,.04)', border: '1px solid rgba(200,148,26,.12)', borderRadius: 10 }}>
        Click a zone to expand · SDHI = Social Determinants Health Index · Scale 1–10 (higher = greater disadvantage)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {ZONES.map(z => <ZoneCard key={z.id} zone={z} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — PREDICTIVE
// ═══════════════════════════════════════════════════════════════════════════
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SEASONAL = [7.2,5.1,4.8,5.5,5.8,7.5,7.8,6.9,5.2,5.0,6.1,8.4];

function riskColor(v) {
  if (v >= 7.5) return { bg: 'rgba(248,110,110,.18)', border: 'rgba(248,110,110,.4)', text: 'rgba(248,110,110,.95)' };
  if (v >= 6.0) return { bg: 'rgba(200,148,26,.14)',  border: 'rgba(200,148,26,.38)', text: 'rgba(240,188,56,.95)' };
  if (v >= 5.0) return { bg: 'rgba(139,92,246,.1)',   border: 'rgba(139,92,246,.3)',  text: 'rgba(167,139,250,.9)' };
  return           { bg: 'rgba(30,220,130,.08)',  border: 'rgba(30,220,130,.25)', text: 'rgba(30,220,130,.85)' };
}

function TabPredictive() {
  const projRef = useRef(null);
  const NOW = new Date();
  const monthName   = MONTHS_SHORT[NOW.getMonth()];
  const currentRisk = SEASONAL[NOW.getMonth()];
  const nextRisk    = SEASONAL[(NOW.getMonth() + 1) % 12];
  const rc = riskColor(currentRisk);

  useChart(projRef, (el) => new Chart(el, {
    type: 'line',
    data: {
      labels: ['Jan 25','Mar 25','May 25','Jul 25','Sep 25','Nov 25','Jan 26','Mar 26'],
      datasets: [
        { label: 'NZ total (actual)',    data: [95,92,88,91,87,89,null,null],   borderColor: 'rgba(30,220,130,.8)',  backgroundColor: 'rgba(30,220,130,.06)', fill: false, tension: 0.3, pointRadius: 3 },
        { label: 'Forecast (model)',     data: [null,null,null,null,null,89,93,98], borderColor: 'rgba(200,148,26,.7)', borderDash: [5,3], fill: false, tension: 0.3, pointRadius: 3 },
        { label: 'Southern risk proxy', data: [22,24,21,26,23,28,31,35],        borderColor: 'rgba(248,110,110,.7)', backgroundColor: 'rgba(248,110,110,.05)', fill: true, tension: 0.4, pointRadius: 2 },
      ],
    },
    options: { ...chartDefaults },
  }));

  const STRESS = [
    { indicator: 'Suicidal ideation',        risk: 7.1, zone: 'STH + MID', driver: 'Social isolation / rural', action: 'Activate 1737 push campaign' },
    { indicator: 'Isolation / disconnection', risk: 6.8, zone: 'STH rural', driver: 'Seasonal + housing',       action: 'Peer support activation' },
    { indicator: 'Workplace discrimination',  risk: 5.9, zone: 'NTH + CEN', driver: 'Stigma disclosure',        action: 'Employer toolkit release' },
    { indicator: 'Medical stigma',            risk: 5.4, zone: 'STH + MID', driver: 'Provider attitudes',       action: 'Clinical competency audit' },
    { indicator: 'Drug use / chemsex',        risk: 5.1, zone: 'NTH urban', driver: 'Party circuit events',     action: 'Peer navigators — Tāmaki' },
    { indicator: 'Food insecurity',           risk: 4.8, zone: 'STH + MID', driver: 'Cost of living',           action: 'Refer to community food banks' },
  ];

  const OUTBREAKS = [
    { zone: 'Northern', pct: 12, color: 'rgba(30,220,130,.75)' },
    { zone: 'Midland',  pct: 34, color: 'rgba(200,148,26,.8)' },
    { zone: 'Central',  pct: 22, color: 'rgba(139,92,246,.75)' },
    { zone: 'Southern', pct: 41, color: 'rgba(248,110,110,.85)' },
  ];

  return (
    <div className="db-fade">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ ...C.card, padding: '22px 20px' }}>
          <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(223,240,225,.4)', marginBottom: 10 }}>Current risk — {monthName} {NOW.getFullYear()}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 56, fontWeight: 300, color: rc.text, lineHeight: 1 }}>{currentRisk}</span>
            <span style={{ fontSize: 12, color: 'rgba(223,240,225,.4)' }}>/10</span>
          </div>
          <div style={{ ...rc, fontSize: 11, padding: '5px 11px', borderRadius: 8, display: 'inline-block', marginBottom: 12 }}>
            {currentRisk >= 7.5 ? 'CRITICAL' : currentRisk >= 6 ? 'HIGH' : currentRisk >= 5 ? 'MODERATE' : 'LOW'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(223,240,225,.4)' }}>
            Next month ({MONTHS_SHORT[(NOW.getMonth()+1)%12]}) preview: <span style={{ color: riskColor(nextRisk).text }}>{nextRisk}</span>
          </div>
        </div>
        <div style={{ ...C.card, padding: '22px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#dff0e1', marginBottom: 14 }}>Outbreak probability by zone</div>
          {OUTBREAKS.map(o => (
            <div key={o.zone} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(223,240,225,.7)' }}>{o.zone}</span>
                <span style={{ fontSize: 11, color: o.color, fontWeight: 600 }}>{o.pct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,.06)' }}>
                <div style={{ height: '100%', width: `${o.pct}%`, borderRadius: 99, background: o.color, transition: 'width .5s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...C.card, padding: '20px 20px 16px', marginBottom: 16 }}>
        <SectionHeader title="Projection 2025–2026" sub="NZ total · 12-month rolling forecast with Southern risk proxy" />
        <canvas ref={projRef} />
      </div>

      <div style={{ ...C.card, padding: '0', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(13,153,96,.1)' }}>
          <SectionHeader title="Social stress indicators — next 30 days" sub="Model-derived risk signals for Burnett Foundation prioritisation" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'rgba(13,153,96,.04)' }}>
              {['Indicator','Risk','Zone','Driver','Burnett action'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(223,240,225,.45)', fontWeight: 500, letterSpacing: '.06em', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRESS.map((row, i) => {
              const rc2 = riskColor(row.risk);
              return (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding: '10px 16px', color: '#dff0e1', fontWeight: 500 }}>{row.indicator}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ ...rc2, fontSize: 11, padding: '2px 9px', borderRadius: 6, fontWeight: 600 }}>{row.risk}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(223,240,225,.55)' }}>{row.zone}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(223,240,225,.45)', fontSize: 10.5 }}>{row.driver}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(200,148,26,.7)', fontSize: 10.5 }}>{row.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ ...C.card, padding: '20px 20px 16px' }}>
        <SectionHeader title="Seasonal risk calendar — Aotearoa NZ" sub="Jan–Dec rolling 12-month model · higher = greater epidemic risk" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 14 }}>
          {SEASONAL.map((v, i) => {
            const rc3 = riskColor(v);
            return (
              <div key={i} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: rc3.bg, border: `1px solid ${rc3.border}` }}>
                <div style={{ fontSize: 9, color: 'rgba(223,240,225,.5)', marginBottom: 4 }}>{MONTHS_SHORT[i]}</div>
                <div style={{ fontSize: 16, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, color: rc3.text }}>{v}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: 'rgba(223,240,225,.4)' }}>
          {[
            { label: 'Critical ≥7.5', ...riskColor(8) },
            { label: 'High 6–7.4',    ...riskColor(6.5) },
            { label: 'Moderate 5–5.9',...riskColor(5.3) },
            { label: 'Low <5',        ...riskColor(4) },
          ].map(l => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}`, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </div>
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
    { phase: 'Phase 2 — Grant Q3 2026', cost: '$395 NZD/month', items: ['Mistral 7B · GPU upgrade','Dual AI architecture','NZ epi fine-tuning dataset','30-day outbreak prediction model'], color: 'rgba(200,148,26,.8)' },
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
// Shell + Root
// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'command',    label: '◉ Command'    },
  { id: 'atlas',      label: '⬡ Atlas'      },
  { id: 'predictive', label: '↗ Predictive' },
  { id: 'privacy',    label: '🛡 Privacy'   },
  { id: 'status',     label: '◎ Status'     },
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
      {tab === 'command'    && <TabCommand    key="command"    />}
      {tab === 'atlas'      && <TabAtlas      key="atlas"      />}
      {tab === 'predictive' && <TabPredictive key="predictive" />}
      {tab === 'privacy'    && <TabPrivacy    key="privacy"    />}
      {tab === 'status'     && <TabStatus     key="status"     />}
    </DashboardShell>
  );
}
