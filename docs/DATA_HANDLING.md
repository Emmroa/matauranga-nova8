# Data Handling Policy — Mātauranga NOVA

**Version:** 1.0 · **Updated:** June 2026  
**Technical audience:** Developers · Auditors · Health sector partners

---

## 1. Data Minimisation Approach

Mātauranga NOVA was designed from the ground up on the principle of **collecting as little as possible, retaining as little as possible**. This is not a post-hoc privacy measure — it is the foundational architecture.

The question asked at every design decision was: *"Do we need this data to improve the service, or are we collecting it out of habit?"*

Everything that was not strictly necessary was removed. This includes:
- Message text (not needed for aggregate analytics)
- IP addresses (session UUIDs provide rate limiting without IP)
- Raw session IDs (hashed + truncated before storage)
- Minute/second timestamps (hour precision is sufficient)
- User agent strings (not needed for any service function)

---

## 2. Anonymous Aggregate Schema

### SQLite database: `backend/data/analytics.db`

#### Table: `events`

```sql
CREATE TABLE events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_uuid   TEXT    NOT NULL,   -- HMAC-SHA256 truncated to 12 hex chars
  region_code    TEXT    NOT NULL,   -- NTH | MID | CEN | STH | NAT
  topic_code     TEXT    NOT NULL,   -- 36 predefined codes (e.g. HIV, PrEP)
  language       TEXT    NOT NULL,   -- en | es | mi
  timestamp_hour TEXT    NOT NULL,   -- ISO 8601, truncated to hour
  crisis_flag    INTEGER NOT NULL DEFAULT 0  -- 0 or 1
);
```

#### Table: `topics` (reference data, not user data)

```sql
CREATE TABLE topics (
  code          TEXT PRIMARY KEY,
  category      TEXT,    -- clinical | mental_health | stigma | identity | social | new_priority
  label_en      TEXT,
  label_mi      TEXT,
  description   TEXT,
  is_crisis     INTEGER,
  display_order INTEGER
);
```

#### Table: `feedback` (optional, anonymised)

```sql
CREATE TABLE feedback (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_uuid TEXT NOT NULL,  -- same 12-char hash
  region_code  TEXT,
  rating       INTEGER,        -- 1-5
  created_at   TEXT
);
```

### What is NOT in the database

| Data type | Stored? | Notes |
|-----------|---------|-------|
| Message text | ❌ Never | Processed in memory only, discarded |
| Response text | ❌ Never | Streamed to client, never written |
| Raw session ID | ❌ Never | Hashed to 12 chars before use |
| IP address | ❌ Never | Not read after rate-limit check |
| User-Agent | ❌ Never | Stripped from headers before processing |
| Location | ❌ Never | Only region_code (user-selected) |
| Health status | ❌ Never | Topic code only (e.g. "PrEP", not "user has HIV") |
| Name / email | ❌ Never | Never requested |

---

## 3. Session ID Handling

```
User browser generates: UUID v4 (e.g. 550e8400-e29b-41d4-a716-446655440000)
         │
         ▼
Server: HMAC-SHA256(rawSessionId, SESSION_SECRET)
         │
         ▼
Store: First 12 hex characters only (e.g. "a3f9d12e8b4c")
```

- The raw UUID is **never stored**
- The 12-char hash is **not reversible** — you cannot reconstruct the original UUID
- Collision probability at n=10,000 sessions: negligible (2^48 space)
- SESSION_SECRET is stored in environment variables, not in codebase

---

## 4. Retention Periods

| Data type | Retention | Justification |
|-----------|-----------|---------------|
| Anonymous event rows | Indefinite | Population-level trend analysis |
| Feedback ratings | 12 months | Service improvement, then deleted |
| PM2 logs | 30 days (auto-rotate) | Debugging only |
| n8n execution logs | 30 days (n8n default) | Automation debugging |
| Nginx access logs | 7 days | Security monitoring only |
| fail2ban logs | 7 days | Intrusion detection |
| Crisis log (n8n) | 90 days | Crisis service planning |
| Health alert log (n8n) | 30 days | Infrastructure monitoring |

---

## 5. n8n Data Handling

n8n workflows process the following data:

| Workflow | Input | What n8n stores | Retention |
|----------|-------|-----------------|-----------|
| Weekly Stats Report | NOVA health API response | Execution log (no PII) | 30 days |
| Crisis Alert Logger | Region + topic + lang (from webhook body — no message text) | crisis_log.txt + execution log | 90 days |
| Daily Health Check | Health API response | health_alerts.txt if failed | 30 days |
| LinkedIn Post Generator | Health API response | Execution log only | 30 days |
| Server Auto Shutdown/Start | None (pm2 command) | pm2_schedule.log | 30 days |

**n8n credential storage:** Gmail App Password is stored encrypted in n8n's SQLite database, using the encryption key in `/home/ubuntu/.n8n/config`. The raw credential file is at `/home/ubuntu/.n8n/gmail.env` (chmod 600, not in git).

**n8n port:** 5678, bound to 127.0.0.1 only. Not accessible from the internet.

---

## 6. Ollama / Mistral 7B — Data Sovereignty

```
User message → [PII scrubbed] → Ollama API (http://127.0.0.1:11434)
                                        │
                                        ▼
                               Mistral 7B (local)
                               running on Catalyst Cloud NZ
                                        │
                                        ▼
                               Response streamed back
                               (never stored by Ollama)
```

**Key guarantees:**
- Ollama runs on `127.0.0.1:11434` — loopback only, not accessible from outside the server
- Mistral 7B weights are stored locally on the Catalyst Cloud NZ server
- No API calls are made to external AI services (no OpenAI, no Anthropic, no Google)
- Data never leaves Aotearoa NZ
- Ollama does not log conversation content in production mode

---

## 7. Infrastructure Data Handling

| Component | Data handled | Where stored | Access |
|-----------|-------------|-------------|--------|
| Nginx | HTTP request logs (IP, path, status) | `/var/log/nginx/` | Root only, 7-day rotation |
| PM2 | Process stdout/stderr | `~/.pm2/logs/` | Ubuntu user, 30-day rotation |
| fail2ban | Failed SSH attempts | `/var/log/fail2ban.log` | Root only |
| SQLite | Anonymous aggregate events | `backend/data/analytics.db` | Ubuntu user, chmod 640 |
| n8n SQLite | Workflow config + execution logs | `~/.n8n/database.sqlite` | Ubuntu user, chmod 644 |

---

## 8. Incident Response Procedure

### Classification

| Severity | Definition | Response time |
|----------|------------|--------------|
| P1 — Critical | Evidence of PII exposure or data breach | 1 hour |
| P2 — High | Unauthorised access to admin dashboard | 4 hours |
| P3 — Medium | Service unavailability > 1 hour | 24 hours |
| P4 — Low | Non-critical security finding | 72 hours |

### Response steps (P1/P2)

1. **Contain** — take affected service offline if needed (`pm2 stop nova-backend`)
2. **Assess** — review Nginx logs, PM2 logs, fail2ban logs
3. **Notify** — inform affected parties if any personal data was exposed
4. **Report** — notify the Office of the Privacy Commissioner within 72 hours if a notifiable privacy breach occurred (Privacy Act 2020 s113)
5. **Remediate** — patch, rotate credentials, restore service
6. **Review** — post-incident review within 7 days

### Contact for security reports

Security findings can be reported via GitHub: github.com/Emmroa/matauranga-nova8/security

See also [SECURITY.md](../SECURITY.md) in the root of this repository.

---

## 9. Compliance Certifications

| Standard | Status | Notes |
|----------|--------|-------|
| NZ Privacy Act 2020 | ✅ Compliant | ZDR architecture, IPPs 1–13 reviewed |
| Health Information Privacy Code 2020 | ✅ Compliant | No health information stored |
| Te Mana Raraunga (Māori Data Sovereignty) | ✅ Aligned | NZ-only infrastructure, no cross-tabulation, small-cell suppression |
| OWASP Top 10 (2021) | ✅ 8/10 Pass, 2/10 Partial | See SECURITY_AUDIT.md |
| ISO 27001 | ⏳ Not certified | Planned third-party audit Q4 2026 |
| SOC 2 Type II | ⏳ Not certified | Not required at current scale |
