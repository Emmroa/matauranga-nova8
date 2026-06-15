// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — ATLAS · HIV in Aotearoa · HIV i Aotearoa
// Public Health Context · 2024–2025
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaces the previous Atlas tab (regional breakdown 38/22/18/17, SDHI
// sub-indices) which contained construction not backed by public sources.
// All numbers below are verifiable against publicly released NZ government
// and research publications.
//
// SOURCES (all public, all citable)
// - HIV Epidemiology Group · University of Otago · Newsletter #84 (May 2025)
// - HIV Epidemiology Group · public release 2025 preliminary data (May 2026)
// - HIV Monitoring Report 2025 · Ministry of Health (Nov 2025)
// - National HIV Action Plan for Aotearoa New Zealand 2023–2030
// - Burnett Foundation Aotearoa · published statistics
// ═══════════════════════════════════════════════════════════════════════════

const ATLAS_KPIS = [
  {
    value: '80',
    label: 'New HIV diagnoses · Aotearoa',
    period: '2025 · preliminary',
    delta: '↓ from 95 in 2024',
    deltaTone: 'good',
    source: 'HIV Epidemiology Group · May 2026',
    accent: '#0ea5e9'
  },
  {
    value: '95',
    label: 'New HIV diagnoses · Aotearoa',
    period: '2024 · full year',
    delta: '78 men · 13 women · 4 trans women',
    deltaTone: 'neutral',
    source: 'HEG Newsletter #84 · May 2025',
    accent: '#cbd5e1'
  },
  {
    value: '2,312',
    label: 'People on antiretroviral therapy',
    period: '2024',
    delta: 'Living with diagnosed HIV',
    deltaTone: 'neutral',
    source: 'HIV Monitoring Report 2025',
    accent: '#1edc82'
  },
  {
    value: '45%',
    label: 'Reduction since 2010 baseline',
    period: 'Locally-acquired HIV',
    delta: 'Target: 90% reduction by 2030',
    deltaTone: 'warn',
    source: 'National HIV Action Plan',
    accent: '#f59e0b'
  }
];

const ATLAS_TREND = [
  { year: '2021', value: 67, note: 'COVID-19 impact period' },
  { year: '2022', value: 76, note: 'COVID-19 impact period' },
  { year: '2023', value: 97, note: null },
  { year: '2024', value: 95, note: null },
  { year: '2025', value: 80, note: 'Preliminary' }
];
const ATLAS_TREND_MAX = 100;

const ATLAS_ACQUISITION = [
  { label: 'Men who have sex with men (MSM)', count: 53, pct: 56, color: '#0ea5e9' },
  { label: 'Heterosexual contact',             count: 23, pct: 24, color: '#8b5cf6' },
  { label: 'Other or unknown means',           count: 17, pct: 18, color: '#cbd5e1' },
  { label: 'Perinatal transmission',           count: 2,  pct: 2,  color: '#f59e0b' }
];

const ATLAS_SOURCES = [
  { org: 'HIV Epidemiology Group',
    detail: 'University of Otago · Newsletter #84 (May 2025) · 2025 preliminary release (May 2026)' },
  { org: 'HIV Monitoring Report 2025',
    detail: 'Ministry of Health · Manatū Hauora · published November 2025' },
  { org: 'National HIV Action Plan for Aotearoa New Zealand 2023–2030',
    detail: 'Ministry of Health · 90% reduction target from 2010 baseline' },
  { org: 'Burnett Foundation Aotearoa',
    detail: 'HIV in Aotearoa statistics · burnettfoundation.org.nz/learn/hiv/hiv-in-aotearoa/' }
];

// ─────────────────────────────────────────────────────────────────────────
// Shared inline-style helpers (autocontained)
// ─────────────────────────────────────────────────────────────────────────
const atlasStyles = {
  section: {
    background: 'rgba(255,255,255,.02)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 16,
    padding: '22px 24px',
    marginBottom: 18
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
    flexWrap: 'wrap'
  },
  sectionTitle: {
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: 'rgba(240,250,255,.92)',
    margin: 0,
    lineHeight: 1.3
  },
  sectionSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: 'rgba(220,240,255,.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: 4
  },
  sourceTag: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: 'rgba(220,240,255,.45)',
    letterSpacing: 0.6
  }
};

function atlasToneColor(tone) {
  if (tone === 'good') return '#1edc82';
  if (tone === 'warn') return '#f59e0b';
  if (tone === 'bad')  return '#f87171';
  return 'rgba(220,240,255,.6)';
}

// ─────────────────────────────────────────────────────────────────────────
function AtlasKpiCard({ kpi }) {
  return (
    <div style={{
      flex: '1 1 220px', minWidth: 210,
      background: 'rgba(255,255,255,.02)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 14, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 3, height: '100%',
        background: kpi.accent, opacity: 0.85
      }} />
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 10,
        textTransform: 'uppercase', letterSpacing: 1.2,
        color: 'rgba(220,240,255,.5)'
      }}>{kpi.period}</div>
      <div style={{
        fontFamily: "'Sora', system-ui, sans-serif",
        fontSize: 38, fontWeight: 600, lineHeight: 1,
        color: kpi.accent
      }}>{kpi.value}</div>
      <div style={{
        fontFamily: "'Sora', system-ui, sans-serif",
        fontSize: 13, color: 'rgba(240,250,255,.85)', lineHeight: 1.35
      }}>{kpi.label}</div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        color: atlasToneColor(kpi.deltaTone), marginTop: 4
      }}>{kpi.delta}</div>
      <div style={{
        marginTop: 'auto', paddingTop: 10,
        borderTop: '1px solid rgba(255,255,255,.06)',
        fontFamily: "'DM Mono', monospace", fontSize: 10,
        color: 'rgba(220,240,255,.45)', letterSpacing: 0.4
      }}>Source: {kpi.source}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function AtlasTrendRow({ row }) {
  const widthPct = Math.max(2, Math.round((row.value / ATLAS_TREND_MAX) * 100));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,.04)'
    }}>
      <div style={{
        width: 50, fontFamily: "'DM Mono', monospace",
        fontSize: 13, color: 'rgba(220,240,255,.7)', flexShrink: 0
      }}>{row.year}</div>
      <div style={{
        flex: 1, height: 14,
        background: 'rgba(255,255,255,.04)',
        borderRadius: 4, overflow: 'hidden', position: 'relative'
      }}>
        <div style={{
          width: `${widthPct}%`, height: '100%',
          background: 'linear-gradient(90deg, rgba(14,165,233,.85) 0%, rgba(14,165,233,.55) 100%)',
          transition: 'width 0.6s ease'
        }} />
      </div>
      <div style={{
        width: 50, textAlign: 'right',
        fontFamily: "'Sora', system-ui, sans-serif",
        fontSize: 15, fontWeight: 600,
        color: 'rgba(240,250,255,.92)', flexShrink: 0
      }}>{row.value}</div>
      <div style={{
        width: 160, fontFamily: "'DM Mono', monospace",
        fontSize: 10, color: 'rgba(220,240,255,.4)', flexShrink: 0
      }}>{row.note || ''}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function AtlasAcquisitionBar({ item }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 6, gap: 12
      }}>
        <div style={{
          fontFamily: "'Sora', system-ui, sans-serif",
          fontSize: 13, color: 'rgba(240,250,255,.88)'
        }}>{item.label}</div>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: 'rgba(220,240,255,.75)', whiteSpace: 'nowrap'
        }}>
          <span style={{ color: item.color, fontWeight: 600 }}>{item.count}</span>
          <span style={{ opacity: 0.5, margin: '0 6px' }}>·</span>
          <span>{item.pct}%</span>
        </div>
      </div>
      <div style={{
        height: 6, background: 'rgba(255,255,255,.04)',
        borderRadius: 3, overflow: 'hidden'
      }}>
        <div style={{
          width: `${item.pct}%`, height: '100%',
          background: item.color, opacity: 0.85
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TabAtlas — main component
// ─────────────────────────────────────────────────────────────────────────
function TabAtlas() {
  return (
    <div style={{ paddingBottom: 24 }}>

      {/* HEADER · BILINGUAL */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{
          fontFamily: "'Sora', system-ui, sans-serif",
          fontSize: 26, fontWeight: 600,
          color: 'rgba(245,250,255,.95)',
          margin: 0, lineHeight: 1.2
        }}>
          HIV in Aotearoa <span style={{ opacity: 0.4 }}>·</span> HIV i Aotearoa
        </h2>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: 'rgba(220,240,255,.55)', marginTop: 6, letterSpacing: 0.6
        }}>
          Public Health Context · 2024–2025
        </div>
      </div>

      {/* INFO BANNER */}
      <div style={{
        background: 'rgba(14,165,233,.06)',
        border: '1px solid rgba(14,165,233,.2)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 22,
        display: 'flex', gap: 12, alignItems: 'flex-start'
      }}>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 16,
          color: '#0ea5e9', flexShrink: 0, marginTop: 1
        }}>ⓘ</div>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: 'rgba(220,240,255,.75)', lineHeight: 1.6
        }}>
          Public reference data. All figures sourced from publicly released
          Aotearoa New Zealand government and research publications (HIV
          Epidemiology Group · University of Otago · Ministry of Health ·
          Burnett Foundation). National-level data only. NOVA does not
          perform regional segmentation, transmission modelling, or
          individual-level inference of its own conversational analytics.
        </div>
      </div>

      {/* KPI ROW */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 22
      }}>
        {ATLAS_KPIS.map((kpi, i) => <AtlasKpiCard key={i} kpi={kpi} />)}
      </div>

      {/* TREND CHART */}
      <div style={atlasStyles.section}>
        <div style={atlasStyles.sectionHeader}>
          <div>
            <h3 style={atlasStyles.sectionTitle}>
              Annual new HIV diagnoses · Aotearoa
            </h3>
            <div style={atlasStyles.sectionSub}>
              People first diagnosed in NZ · 2021–2025
            </div>
          </div>
          <div style={atlasStyles.sourceTag}>
            HIV Epidemiology Group · University of Otago
          </div>
        </div>
        <div>
          {ATLAS_TREND.map((row, i) => <AtlasTrendRow key={i} row={row} />)}
        </div>
        <div style={{
          marginTop: 14,
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: 'rgba(220,240,255,.45)', lineHeight: 1.6
        }}>
          Annual average 2016–2024 (excluding COVID-impacted 2020–2021): 128 diagnoses.
          The 2025 figure of 80 continues a downward trend, particularly among
          men who have sex with men.
        </div>
      </div>

      {/* ACQUISITION BREAKDOWN 2024 */}
      <div style={atlasStyles.section}>
        <div style={atlasStyles.sectionHeader}>
          <div>
            <h3 style={atlasStyles.sectionTitle}>How HIV was acquired · 2024</h3>
            <div style={atlasStyles.sectionSub}>
              People first diagnosed in NZ · n = 95
            </div>
          </div>
          <div style={atlasStyles.sourceTag}>HEG Newsletter #84</div>
        </div>
        <div>
          {ATLAS_ACQUISITION.map((item, i) => <AtlasAcquisitionBar key={i} item={item} />)}
        </div>
        <div style={{
          marginTop: 14, fontFamily: "'DM Mono', monospace",
          fontSize: 11, color: 'rgba(220,240,255,.45)', lineHeight: 1.6
        }}>
          A further 166 people were notified in NZ in 2024 who had been
          first diagnosed overseas, of whom 87% already had an undetectable
          viral load on antiretroviral therapy. Total notifications in 2024: 261.
        </div>
      </div>

      {/* NATIONAL HIV ACTION PLAN PROGRESS */}
      <div style={{
        ...atlasStyles.section,
        background: 'linear-gradient(135deg, rgba(245,158,11,.04) 0%, rgba(255,255,255,.02) 60%)',
        border: '1px solid rgba(245,158,11,.22)'
      }}>
        <div style={atlasStyles.sectionHeader}>
          <div>
            <h3 style={atlasStyles.sectionTitle}>
              National HIV Action Plan · Aotearoa 2023–2030
            </h3>
            <div style={atlasStyles.sectionSub}>Progress toward the 2030 goal</div>
          </div>
          <div style={atlasStyles.sourceTag}>
            Ministry of Health · HIV Monitoring Report 2025
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
          <div style={{
            flex: '1 1 240px', padding: '14px 16px',
            background: 'rgba(0,0,0,.18)', borderRadius: 10
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              textTransform: 'uppercase', letterSpacing: 1.1,
              color: 'rgba(220,240,255,.5)', marginBottom: 6
            }}>2030 Goal</div>
            <div style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: 14, color: 'rgba(240,250,255,.9)', lineHeight: 1.5
            }}>
              Zero new locally-acquired HIV transmissions in Aotearoa New Zealand by 2030.
            </div>
          </div>
          <div style={{
            flex: '1 1 240px', padding: '14px 16px',
            background: 'rgba(0,0,0,.18)', borderRadius: 10
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              textTransform: 'uppercase', letterSpacing: 1.1,
              color: 'rgba(220,240,255,.5)', marginBottom: 6
            }}>Current Progress</div>
            <div style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: 14, color: 'rgba(240,250,255,.9)', lineHeight: 1.5
            }}>
              45% reduction in locally-acquired HIV from 2010 baseline.
              Target trajectory: 90% reduction by 2030.
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 16, fontFamily: "'DM Mono', monospace",
          fontSize: 11, color: 'rgba(245,158,11,.85)', lineHeight: 1.6
        }}>
          The 45% reduction since 2010 remains short of the National HIV Action
          Plan trajectory. Continued investment in prevention (PrEP · PEP ·
          DoxyPEP · condom access · regular testing) and reducing stigma
          remain essential.
        </div>
      </div>

      {/* TE WHARE TAPA WHĀ CULTURAL FRAMING */}
      <div style={{
        ...atlasStyles.section,
        background: 'rgba(30,220,130,.03)',
        border: '1px solid rgba(30,220,130,.18)'
      }}>
        <div style={atlasStyles.sectionHeader}>
          <div>
            <h3 style={atlasStyles.sectionTitle}>
              Te Whare Tapa Whā · holistic context for the data above
            </h3>
            <div style={atlasStyles.sectionSub}>
              Four dimensions of wellbeing · framework by Sir Mason Durie
            </div>
          </div>
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: 'rgba(220,240,255,.7)', lineHeight: 1.7
        }}>
          The figures above describe clinical-epidemiological reality. Burnett
          Foundation Aotearoa service planning interprets them through the
          four pou of Te Whare Tapa Whā: <strong style={{ color: '#1edc82' }}>taha
          tinana</strong> (physical health · access to ART, testing, PrEP),{' '}
          <strong style={{ color: '#1edc82' }}>taha hinengaro</strong> (mental
          and emotional health · stigma reduction, peer support),{' '}
          <strong style={{ color: '#1edc82' }}>taha whānau</strong> (family
          and community · disclosure support, community testing),{' '}
          <strong style={{ color: '#1edc82' }}>taha wairua</strong>{' '}
          (spiritual and identity dimension · cultural safety, kaupapa Māori
          care pathways). Specific outreach priorities are determined by
          Burnett Foundation in consultation with affected communities,
          kaupapa Māori health providers, and people living with HIV — not
          inferred by NOVA.
        </div>
      </div>

      {/* SOURCES FOOTER */}
      <div style={{
        ...atlasStyles.section,
        background: 'rgba(0,0,0,.18)',
        border: '1px solid rgba(255,255,255,.06)'
      }}>
        <h3 style={{ ...atlasStyles.sectionTitle, fontSize: 14, marginBottom: 12 }}>
          Sources cited on this page
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ATLAS_SOURCES.map((s, i) => (
            <div key={i} style={{
              paddingLeft: 12,
              borderLeft: '2px solid rgba(14,165,233,.5)'
            }}>
              <div style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: 12, color: 'rgba(240,250,255,.85)', fontWeight: 500
              }}>{s.org}</div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                color: 'rgba(220,240,255,.5)', marginTop: 2, lineHeight: 1.5
              }}>{s.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTNOTE · PENDING BILINGUAL TRANSLATION */}
      <div style={{
        marginTop: 12, padding: '10px 14px',
        background: 'rgba(255,255,255,.015)', borderRadius: 8,
        fontFamily: "'DM Mono', monospace", fontSize: 10,
        color: 'rgba(220,240,255,.4)', lineHeight: 1.6
      }}>
        Bilingual te reo Māori translation of all narrative content pending Phase 1
        development (June 2026), validated by native speaker review per Te Mana
        Raraunga kaupapa.
      </div>

    </div>
  );
}
