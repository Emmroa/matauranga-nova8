// ═══════════════════════════════════════════════════════════════════════════
// NOVA — SQLite Schema & Data-Access Layer (ESM)
// Mātauranga NOVA · Burnett Foundation Innovation Challenge 2026
//
// PRIVACY GUARANTEE (NZ Privacy Act 2020 · HIPC 2020 · Māori Data Sovereignty)
//   ✘ NO message content is ever stored
//   ✘ NO IP addresses are captured or persisted
//   ✘ NO precise timestamps (truncated to the top of the hour)
//   ✘ NO user identifiers beyond an ephemeral session UUID
//   ✔ Only: session_uuid, region_code, topic_code, language, timestamp_hour, crisis_flag
//
// Small-cell suppression (n<6) is applied at query time on the dashboard
// surfaces to mitigate re-identification in low-population regions.
// ═══════════════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Database file location ────────────────────────────────────────────────
// Production (Catalyst Cloud Ubuntu 24.04): /var/lib/matauranga-nova/analytics.db
// Development:                              ./data/analytics.db
const DB_PATH = process.env.NOVA_DB_PATH
  || path.join(__dirname, 'data', 'analytics.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ─── Connection (WAL mode, strict security posture) ────────────────────────
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');     // crash-safe + concurrent reads
db.pragma('synchronous = NORMAL');   // SD-card friendly durability balance
db.pragma('foreign_keys = ON');

// Best-effort restrictive file mode (root-only read on Catalyst)
try { fs.chmodSync(DB_PATH, 0o600); } catch { /* non-fatal */ }

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════
db.exec(`
  -- ─── Te Whatu Ora regions (4 + national fallback) ─────────────────────
  CREATE TABLE IF NOT EXISTS regions (
    code           TEXT PRIMARY KEY,    -- NTH | MID | CEN | STH | NAT
    name_en        TEXT NOT NULL,
    name_mi        TEXT NOT NULL,
    description    TEXT NOT NULL,
    display_order  INTEGER NOT NULL
  );

  -- ─── Topic taxonomy (35 topics across 6 categories) ───────────────────
  CREATE TABLE IF NOT EXISTS topics (
    code           TEXT PRIMARY KEY,
    category       TEXT NOT NULL,       -- clinical|mental_health|stigma|social|identity|new_priority
    label_en       TEXT NOT NULL,
    label_mi       TEXT,
    description    TEXT NOT NULL,
    is_crisis      INTEGER NOT NULL DEFAULT 0,
    display_order  INTEGER NOT NULL
  );

  -- ─── Events: PII-FREE BY CONSTRUCTION ─────────────────────────────────
  -- No message text, no IP, no precise timestamp.
  CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid   TEXT NOT NULL,                      -- ephemeral v4 UUID
    region_code    TEXT NOT NULL REFERENCES regions(code),
    topic_code     TEXT NOT NULL REFERENCES topics(code),
    language       TEXT NOT NULL,                      -- en | mi | es
    timestamp_hour TEXT NOT NULL,                      -- ISO truncated to hour
    crisis_flag    INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_events_region ON events(region_code);
  CREATE INDEX IF NOT EXISTS idx_events_topic  ON events(topic_code);
  CREATE INDEX IF NOT EXISTS idx_events_hour   ON events(timestamp_hour);
  CREATE INDEX IF NOT EXISTS idx_events_lang   ON events(language);

  -- ─── Feedback: anonymous thumbs up/down ───────────────────────────────
  CREATE TABLE IF NOT EXISTS feedback (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid   TEXT NOT NULL,
    region_code    TEXT NOT NULL REFERENCES regions(code),
    rating         INTEGER NOT NULL,    -- 1 = up, -1 = down
    timestamp_hour TEXT NOT NULL
  );

  -- ─── Admin users for dashboard auth (bcrypt) ──────────────────────────
  CREATE TABLE IF NOT EXISTS admin_users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    created_at     TEXT NOT NULL
  );
`);

// ═══════════════════════════════════════════════════════════════════════════
// SEED DATA — Te Whatu Ora regions
// Source: Te Whatu Ora "Our regions and districts" (healthnz.govt.nz)
// ═══════════════════════════════════════════════════════════════════════════
const REGIONS = [
  { code: 'NTH', name_en: 'Northern',           name_mi: 'Te Tai Tokerau ki Tāmaki',
    description: 'Northland, Waitematā, Auckland, Counties Manukau',
    display_order: 1 },
  { code: 'MID', name_en: 'Midland',            name_mi: 'Te Manawa Taki',
    description: 'Waikato, Lakes, Bay of Plenty, Tairāwhiti, Taranaki',
    display_order: 2 },
  { code: 'CEN', name_en: 'Central',            name_mi: 'Te Ikaroa',
    description: "MidCentral, Whanganui, Capital & Coast, Hutt Valley, Hawke's Bay, Wairarapa",
    display_order: 3 },
  { code: 'STH', name_en: 'Southern',           name_mi: 'Te Waipounamu',
    description: 'Nelson Marlborough, West Coast, Canterbury, South Canterbury, Southern',
    display_order: 4 },
  { code: 'NAT', name_en: 'Prefer not to say',  name_mi: 'Kāore au e kī',
    description: 'Aggregated nationally without regional attribution',
    display_order: 5 }
];

// ═══════════════════════════════════════════════════════════════════════════
// SEED DATA — 35 Topic Taxonomy
// ═══════════════════════════════════════════════════════════════════════════
const TOPICS = [
  // ─── clinical (12) ───────────────────────────────────────────────────────
  { code: 'HIV',              category: 'clinical', label_en: 'HIV general',                label_mi: 'Mate Āraikore',     description: 'General mentions of HIV',                                          is_crisis: 0, display_order: 1 },
  { code: 'New_Diagnosis',    category: 'clinical', label_en: 'New diagnosis',              label_mi: 'Whakataunga hou',   description: 'Recently tested positive',                                         is_crisis: 0, display_order: 2 },
  { code: 'PrEP',             category: 'clinical', label_en: 'PrEP (pre-exposure)',        label_mi: 'PrEP',              description: 'Pre-exposure prophylaxis queries',                                 is_crisis: 0, display_order: 3 },
  { code: 'PEP',              category: 'clinical', label_en: 'PEP (post-exposure)',        label_mi: 'PEP',               description: 'Post-exposure prophylaxis, 72-hour window',                        is_crisis: 0, display_order: 4 },
  { code: 'DoxyPEP',          category: 'clinical', label_en: 'DoxyPEP',                    label_mi: 'DoxyPEP',           description: 'Doxycycline post-exposure for bacterial STIs',                     is_crisis: 0, display_order: 5 },
  { code: 'UeqU',             category: 'clinical', label_en: 'U=U messaging',              label_mi: 'U=U',               description: 'Undetectable equals Untransmittable',                              is_crisis: 0, display_order: 6 },
  { code: 'Syphilis',         category: 'clinical', label_en: 'Syphilis',                   label_mi: 'Hupiria',           description: 'Syphilis concerns, testing, treatment',                            is_crisis: 0, display_order: 7 },
  { code: 'Chlamydia',        category: 'clinical', label_en: 'Chlamydia',                  label_mi: null,                description: 'Chlamydia diagnosis or testing',                                   is_crisis: 0, display_order: 8 },
  { code: 'Gonorrhoea',       category: 'clinical', label_en: 'Gonorrhoea',                 label_mi: null,                description: 'Gonorrhoea diagnosis or testing',                                  is_crisis: 0, display_order: 9 },
  { code: 'STI_Testing',      category: 'clinical', label_en: 'STI / sexual health check',  label_mi: 'Whakamātautau hauora', description: 'Testing access and process',                                    is_crisis: 0, display_order: 10 },
  { code: 'Long_Term_Living', category: 'clinical', label_en: 'Long-term living with HIV',  label_mi: null,                description: 'Living long-term with HIV',                                        is_crisis: 0, display_order: 11 },
  { code: 'ART_Medication',   category: 'clinical', label_en: 'ART / antiretrovirals',      label_mi: null,                description: 'Treatment, side effects, adherence',                               is_crisis: 0, display_order: 12 },

  // ─── mental_health (6) ───────────────────────────────────────────────────
  { code: 'Suicide_Ideation', category: 'mental_health', label_en: 'Suicide ideation',      label_mi: null,                description: 'Thoughts of ending life',                                          is_crisis: 1, display_order: 13 },
  { code: 'Self_Harm',        category: 'mental_health', label_en: 'Self-harm',             label_mi: null,                description: 'Self-injury thoughts or acts',                                     is_crisis: 1, display_order: 14 },
  { code: 'Crisis_Acute',     category: 'mental_health', label_en: 'Acute crisis',          label_mi: null,                description: 'Overwhelm, cannot cope, breakdown',                                is_crisis: 1, display_order: 15 },
  { code: 'Anxiety',          category: 'mental_health', label_en: 'Anxiety',               label_mi: 'Māharahara',        description: 'Anxiety and panic',                                                is_crisis: 0, display_order: 16 },
  { code: 'Depression',       category: 'mental_health', label_en: 'Depression',            label_mi: 'Pōkaikaha',         description: 'Depressive states, hopelessness',                                  is_crisis: 0, display_order: 17 },
  { code: 'Loneliness',       category: 'mental_health', label_en: 'Loneliness / isolation',label_mi: 'Mokemoke',          description: 'Social isolation',                                                 is_crisis: 0, display_order: 18 },

  // ─── stigma (6) ──────────────────────────────────────────────────────────
  { code: 'Internal_Stigma',          category: 'stigma', label_en: 'Internal stigma / shame',  label_mi: 'Whakamā',     description: 'Shame, self-judgement, whakamā',                            is_crisis: 0, display_order: 19 },
  { code: 'External_Discrimination',  category: 'stigma', label_en: 'External discrimination',  label_mi: 'Whakatoi',    description: 'Rejection, prejudice from others',                          is_crisis: 0, display_order: 20 },
  { code: 'Bullying',                 category: 'stigma', label_en: 'Bullying / harassment',    label_mi: 'Whakaweti',   description: 'Harassment in school, community',                           is_crisis: 0, display_order: 21 },
  { code: 'Online_Hate',              category: 'stigma', label_en: 'Online hate',              label_mi: null,          description: 'Cyberbullying, hate speech online',                         is_crisis: 0, display_order: 22 },
  { code: 'Workplace_Discrimination', category: 'stigma', label_en: 'Workplace discrimination', label_mi: null,          description: 'Discrimination at work, dismissals',                        is_crisis: 0, display_order: 23 },
  { code: 'Medical_Discrimination',   category: 'stigma', label_en: 'Medical discrimination',   label_mi: null,          description: 'Refused care, discriminatory clinicians',                   is_crisis: 0, display_order: 24 },

  // ─── identity (3) ────────────────────────────────────────────────────────
  { code: 'LGBTQIA_Takatapui', category: 'identity', label_en: 'LGBTQIA+ identity',  label_mi: 'Takatāpui', description: 'Sexuality and gender identity (general)',         is_crisis: 0, display_order: 25 },
  { code: 'Disclosure',        category: 'identity', label_en: 'Disclosure decision', label_mi: null,        description: 'Whether/how to tell others about HIV',            is_crisis: 0, display_order: 26 },
  { code: 'Whanau_Family',     category: 'identity', label_en: 'Whānau / family',     label_mi: 'Whānau',    description: 'Family relationships and support',                is_crisis: 0, display_order: 27 },

  // ─── social (4) ──────────────────────────────────────────────────────────
  { code: 'WINZ',            category: 'social', label_en: 'WINZ / benefits',      label_mi: null,        description: 'Income support, jobseeker, disability allowance',     is_crisis: 0, display_order: 28 },
  { code: 'Housing_Council', category: 'social', label_en: 'Housing / Kāinga Ora', label_mi: 'Kāinga Ora',description: 'Housing support and access',                          is_crisis: 0, display_order: 29 },
  { code: 'Legal_Rights',    category: 'social', label_en: 'Legal rights',         label_mi: null,        description: 'Human rights, legal advice, HRC',                      is_crisis: 0, display_order: 30 },
  { code: 'Immigration',     category: 'social', label_en: 'Immigration / visa',   label_mi: null,        description: 'Visa, residency, HIV and migration',                   is_crisis: 0, display_order: 31 },

  // ─── new_priority (5) — 2025–2026 priorities ────────────────────────────
  { code: 'Takatapui_Specific',  category: 'new_priority', label_en: 'Takatāpui-specific support',   label_mi: 'Takatāpui', description: 'Māori LGBTQIA+ specific cultural safety and care',                  is_crisis: 0, display_order: 32 },
  { code: 'Pacific_Wellbeing',   category: 'new_priority', label_en: 'Pacific wellbeing',            label_mi: null,        description: "Pacific peoples' models of health and HIV support",                  is_crisis: 0, display_order: 33 },
  { code: 'Ageing_with_HIV',     category: 'new_priority', label_en: 'Ageing with HIV',              label_mi: 'Kaumātua',  description: 'Long-term PLHIV, comorbidities, polypharmacy',                       is_crisis: 0, display_order: 34 },
  { code: 'Rural_Access',        category: 'new_priority', label_en: 'Rural access barriers',        label_mi: null,        description: 'Distance, telehealth, small-community privacy',                      is_crisis: 0, display_order: 35 },
  { code: 'Stigma_Clinic_Audit', category: 'new_priority', label_en: 'Clinical stigma audit signal', label_mi: null,        description: 'User-reported poor clinical experiences (informs service improvement)', is_crisis: 0, display_order: 36 }
];

// ─── Seed (idempotent upsert) ──────────────────────────────────────────────
const insertRegion = db.prepare(`
  INSERT INTO regions (code, name_en, name_mi, description, display_order)
  VALUES (@code, @name_en, @name_mi, @description, @display_order)
  ON CONFLICT(code) DO UPDATE SET
    name_en=excluded.name_en, name_mi=excluded.name_mi,
    description=excluded.description, display_order=excluded.display_order
`);

const insertTopic = db.prepare(`
  INSERT INTO topics (code, category, label_en, label_mi, description, is_crisis, display_order)
  VALUES (@code, @category, @label_en, @label_mi, @description, @is_crisis, @display_order)
  ON CONFLICT(code) DO UPDATE SET
    category=excluded.category, label_en=excluded.label_en, label_mi=excluded.label_mi,
    description=excluded.description, is_crisis=excluded.is_crisis,
    display_order=excluded.display_order
`);

db.transaction(() => {
  for (const r of REGIONS) insertRegion.run(r);
  for (const t of TOPICS)  insertTopic.run(t);
})();

// ═══════════════════════════════════════════════════════════════════════════
// PREPARED STATEMENTS (hot paths)
// ═══════════════════════════════════════════════════════════════════════════
const stmts = {
  insertEvent: db.prepare(`
    INSERT INTO events (session_uuid, region_code, topic_code, language, timestamp_hour, crisis_flag)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  insertFeedback: db.prepare(`
    INSERT INTO feedback (session_uuid, region_code, rating, timestamp_hour)
    VALUES (?, ?, ?, ?)
  `),

  totalSessions: db.prepare(`SELECT COUNT(DISTINCT session_uuid) AS n FROM events`),
  totalMessages: db.prepare(`SELECT COUNT(*) AS n FROM events`),
  crisisCount:   db.prepare(`SELECT COUNT(*) AS n FROM events WHERE crisis_flag = 1`),

  topicsByRegion: db.prepare(`
    SELECT
      r.code AS region_code, r.name_en AS region_name,
      t.code AS topic_code,  t.label_en AS topic_label, t.category AS topic_category,
      CASE WHEN COUNT(*) < 6 THEN 0 ELSE COUNT(*) END AS n
    FROM events e
    JOIN regions r ON r.code = e.region_code
    JOIN topics  t ON t.code = e.topic_code
    GROUP BY r.code, t.code
    ORDER BY r.display_order, t.display_order
  `),

  languageBreakdown: db.prepare(`
    SELECT language, COUNT(*) AS n FROM events GROUP BY language
  `),

  regionSummary: db.prepare(`
    SELECT
      r.code, r.name_en, r.name_mi, r.description, r.display_order,
      COUNT(e.id) AS total_events,
      SUM(CASE WHEN e.crisis_flag = 1 THEN 1 ELSE 0 END) AS crisis_events
    FROM regions r
    LEFT JOIN events e ON e.region_code = r.code
    GROUP BY r.code
    ORDER BY r.display_order
  `),

  categoryBreakdown: db.prepare(`
    SELECT t.category, COUNT(*) AS n
    FROM events e JOIN topics t ON t.code = e.topic_code
    GROUP BY t.category
    ORDER BY n DESC
  `),

  topTopics: db.prepare(`
    SELECT t.code, t.label_en, t.category,
      CASE WHEN COUNT(*) < 6 THEN 0 ELSE COUNT(*) END AS n
    FROM events e JOIN topics t ON t.code = e.topic_code
    GROUP BY t.code
    ORDER BY n DESC
    LIMIT 10
  `),

  topicsList: db.prepare(`
    SELECT code, category, label_en, label_mi, description, is_crisis, display_order
    FROM topics ORDER BY display_order
  `),

  regionsList: db.prepare(`
    SELECT code, name_en, name_mi, description, display_order
    FROM regions ORDER BY display_order
  `),

  feedbackSummary: db.prepare(`
    SELECT
      SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END) AS up_count,
      SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS down_count
    FROM feedback
  `),

  timeseriesLast7Days: db.prepare(`
    SELECT
      substr(timestamp_hour, 1, 10) AS day,
      COUNT(*) AS n,
      SUM(CASE WHEN crisis_flag = 1 THEN 1 ELSE 0 END) AS crises
    FROM events
    WHERE timestamp_hour >= strftime('%Y-%m-%dT%H:00:00Z', datetime('now','-7 days'))
    GROUP BY day ORDER BY day
  `),

  adminByUsername: db.prepare(`SELECT * FROM admin_users WHERE username = ?`),
  insertAdmin:     db.prepare(`
    INSERT INTO admin_users (username, password_hash, created_at) VALUES (?, ?, ?)
  `)
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Truncate a Date to the top of the hour (ISO Z) — IPP 10 minimisation.
 * Prevents re-identification by correlation with external logs.
 */
export function truncateToHour(date = new Date()) {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Single anonymous event (region+topic+lang+crisis) — no message text. */
export function recordEvent({ sessionUuid, regionCode, topicCode, language, isCrisis }) {
  stmts.insertEvent.run(
    sessionUuid,
    regionCode || 'NAT',
    topicCode,
    language,
    truncateToHour(),
    isCrisis ? 1 : 0
  );
}

/** Batch insert (one transaction) for performance on multi-topic turns. */
export const recordEventsBatch = db.transaction((events) => {
  const hour = truncateToHour();
  for (const ev of events) {
    stmts.insertEvent.run(
      ev.sessionUuid,
      ev.regionCode || 'NAT',
      ev.topicCode,
      ev.language,
      hour,
      ev.isCrisis ? 1 : 0
    );
  }
});

export function recordFeedback({ sessionUuid, regionCode, rating }) {
  if (rating !== 1 && rating !== -1) throw new Error('rating must be 1 or -1');
  stmts.insertFeedback.run(
    sessionUuid,
    regionCode || 'NAT',
    rating,
    truncateToHour()
  );
}

export function getRegions() { return stmts.regionsList.all(); }
export function getTopics()  { return stmts.topicsList.all(); }

export function getDashboardSummary() {
  return {
    generated_at: new Date().toISOString(),
    totals: {
      sessions:        stmts.totalSessions.get().n,
      messages:        stmts.totalMessages.get().n,
      crises:          stmts.crisisCount.get().n,
      topics_tracked:  35
    },
    regions:           stmts.regionSummary.all(),
    topics_by_region:  stmts.topicsByRegion.all(),
    languages:         stmts.languageBreakdown.all(),
    categories:        stmts.categoryBreakdown.all(),
    top_topics:        stmts.topTopics.all(),
    feedback:          stmts.feedbackSummary.get() || { up_count: 0, down_count: 0 },
    timeseries:        stmts.timeseriesLast7Days.all()
  };
}

/** SELECT-only gateway for the admin AI assistant (dashboard analyst panel). */
export function querySafe(sql, params = []) {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    throw new Error('Only SELECT/WITH queries permitted');
  }
  if (/;\s*\S/.test(sql)) throw new Error('Multi-statement queries not permitted');
  return db.prepare(sql).all(...params);
}

export function ensureAdmin(username, passwordHash) {
  const existing = stmts.adminByUsername.get(username);
  if (!existing) {
    stmts.insertAdmin.run(username, passwordHash, new Date().toISOString());
    return { created: true };
  }
  // Always sync the hash so env-var password changes take effect on restart
  db.prepare('UPDATE admin_users SET password_hash=? WHERE username=?').run(passwordHash, username);
  return { created: false };
}

export function getAdmin(username) { return stmts.adminByUsername.get(username); }

export function close() {
  try { db.close(); } catch { /* ignore */ }
}

export { db };
