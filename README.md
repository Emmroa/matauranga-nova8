# Mātauranga NOVA

> **Digital sexual health educator and HIV stigma reduction AI for Aotearoa NZ.**  
> Zero Data Retention. Trilingual. Science-led. Culturally safe.

Built by **Emanuel Figueroa** — Auckland, Aotearoa NZ  
Mātauranga NOVA · Community Health Initiative · Aotearoa NZ

---

## What is NOVA?

Mātauranga NOVA is a trilingual AI educator covering **HIV, STIs (syphilis, gonorrhoea, chlamydia, DoxyPEP), PrEP/PEP, and sexual health in general** — in a completely private environment. No account required. No messages stored. Nothing logged beyond anonymous counters.

The name combines **mātauranga** (Māori: knowledge, understanding) with **NOVA** — a new light. NOVA exists to fight HIV stigma and reduce shame around sexual health through honest, caring conversation grounded in Te Whare Tapa Whā and Māori data sovereignty principles.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 · Vite 6 · React Router · Chart.js · lucide-react |
| Styling | Inline design tokens · Cormorant Garamond + Outfit (Google Fonts) |
| PWA | Web App Manifest · Service Worker (cache-first shell / network-first API) |
| Backend | Node.js 20+ · Express 5 (ESM) · port 10000 |
| AI model | Mistral 7B via Ollama (loopback `127.0.0.1:11434`) |
| Database | better-sqlite3 · `backend/data/analytics.db` |
| Queue | p-queue (concurrency = 1, sequential inference) |
| Circuit breaker | opossum (wraps every Ollama call) |
| Auth | bcryptjs · cookie-based sessions · 8h expiry |
| Process manager | PM2 (`nova-backend`, port 10000) |
| Reverse proxy | Nginx · TLS 1.2/1.3 · HTTP → HTTPS 301 |
| TLS certificate | ZeroSSL ECC (ec-256) via acme.sh + DuckDNS DNS-01 |
| Firewall | UFW — allow 22/80/443 only |
| Brute-force | fail2ban — sshd jail |
| Platform | Catalyst Cloud NZ (sovereign NZ hosting) |

---

## Key Features

| Feature | Description |
|---------|-------------|
| Trilingual | English · Te Reo Māori · Español — automatic detection |
| 7 Moments framework | Structured conversation flow across 7 emotional entry points |
| Crisis protocol | Auto-detects crisis signals; surfaces 111 · Lifeline 0800 543 354 · 1737 immediately |
| Anonymous analytics dashboard | 6-tab admin dashboard — KPIs, atlas, privacy audit, AI analyst, PDF reports |
| Sexual health scope | HIV · ITS (sífilis, gonorrea, clamidia, DoxyPEP) · PrEP/PEP · salud sexual general |
| Quad-Layer Armor | PII scrub → rate limiting → zero retention → Helmet.js CSP/HSTS |

---

## Privacy Architecture — Quad-Layer Armor

NOVA enforces Zero Data Retention (ZDR) in code, not just in policy.

```
┌─────────────────────────────────────────────────────────────┐
│  L1  PII SCRUBBING (server.js:scrubPII)                     │
│      NZ-specific: email · NZ phone · NHI · IRD · card ·     │
│      street address — stripped BEFORE reaching Ollama       │
├─────────────────────────────────────────────────────────────┤
│  L2  RATE LIMITING (express-rate-limit)                     │
│      Session-based (not IP) · chat / login / admin lanes    │
├─────────────────────────────────────────────────────────────┤
│  L3  ZERO DATA RETENTION                                    │
│      No message text in SQLite — only region/topic/lang     │
│      codes. Session IDs stored as 12-char truncated hashes. │
│      Timestamps truncated to hour precision.                │
├─────────────────────────────────────────────────────────────┤
│  L4  SECURITY HEADERS (Helmet + Nginx)                      │
│      HSTS · CSP · X-Frame-Options DENY ·                    │
│      X-Content-Type-Options · Referrer-Policy               │
└─────────────────────────────────────────────────────────────┘
```

**What is stored** (SQLite `analytics.db`):
- Anonymous event counts: `region_code · topic_code · language · timestamp_hour · crisis_flag`
- No message content. No raw session IDs. No IP addresses.

---

## Analytics Dashboard — 6 Tabs

Access at `/dashboard` (requires admin login).

| # | Tab | Description |
|---|-----|-------------|
| 1 | ◉ Command | Live KPIs · time-series with μ±1.5σ bands · anomaly detection · topic breakdown by category · language distribution · AI-generated insights |
| 2 | ⬡ Atlas | Regional activity map — NTH / MID / CEN / STH / NAT zones |
| 3 | 🛡 Privacy | ZDR compliance view · NZ Privacy Act 2020 · HIPC 2020 · Te Mana Raraunga framework |
| 4 | ◎ Status | Live service health (Ollama · backend · nginx) · infrastructure roadmap |
| 5 | 📋 Actions | Social Stress Indicator tracker (13 indicators) with 3-state institutional response (Pending / In Progress / Completed) · Live PII Audit counter (Layer 1) |
| 6 | 🤖 Intelligence | Internal AI chat assistant (anonymous data only) · PDF report generator (Monthly · Crisis · Privacy · Regional) |

---

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health (Ollama up, model loaded, circuit breaker) |
| GET | `/api/metadata` | Regions, topics, model version |
| POST | `/api/chat` | SSE streaming chat — requires `consent: true` + valid UUID v4 |

### Admin (cookie auth required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Login → sets httpOnly cookie |
| POST | `/api/admin/logout` | Clear session cookie |
| GET | `/api/admin/me` | Verify session |
| GET | `/api/admin/summary` | Full analytics summary + piiEvents snapshot |
| GET | `/api/admin/export.csv` | Download analytics as CSV |
| POST | `/api/admin/analyst` | SSE AI analyst (Mistral over aggregate data) |
| GET | `/api/admin/actions` | Load institutional action states |
| POST | `/api/admin/actions` | Update action status (allowlisted keys + statuses) |
| POST | `/api/admin/assistant` | SSE AI assistant with caller-supplied sanitized context |

---

## Running Locally (Development)

### Prerequisites
- Node.js 20+
- [Ollama](https://ollama.ai) with `mistral` pulled (`ollama pull mistral`)

### Backend

```bash
cd backend
cp .env.example .env          # fill in SESSION_SECRET and ADMIN_PASSWORD
npm install
node server.js
# → listening on http://localhost:10000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 (proxies /api/ to :10000 via vite.config.js)
```

### Health check

```bash
curl http://localhost:10000/api/health
# {"ok":true,"ollamaUp":true,"modelLoaded":true,"breakerOpen":false}
```

---

## Production Deploy

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for full Nginx + PM2 + acme.sh + UFW setup.

Quick status check on the running server:

```bash
pm2 status
curl -s http://localhost:10000/api/health | python3 -m json.tool
sudo systemctl status nginx fail2ban
```

---

## Compliance

| Standard | Application |
|----------|------------|
| NZ Privacy Act 2020 | No personal information collected or retained |
| Health Information Privacy Code 2020 (HIPC) | Health data (HIV status, STI status) never stored |
| Te Mana Raraunga | Māori data sovereignty — no profiling, no re-identification |
| UN OHCHR HIV rights framework | Non-stigmatising language in all prompts |

Crisis safety resources surfaced automatically:
- **1737** — free text or call, 24/7
- **Lifeline** — 0800 543 354
- **111** — immediate danger

---

## Design Principles — What NOVA Deliberately Does Not Do

NOVA could implement features common in international HIV-tech tools. We chose not to, as design principles aligned with **Te Mana Raraunga** (Māori data sovereignty) and privacy-first community health practice.

In Aotearoa New Zealand, the population is small and closely connected. Communities most affected by HIV — Takatāpui, Pasifika takatāpui, rural Māori living with HIV — are small enough that statistical patterns can identify individuals even without names. We accepted this as a foundational design constraint, not a deferred consideration.

### What NOVA does not do

- **No regional segmentation of conversational analytics.** Cross-tabulation of region × topic is not computed. The query `topicsByRegion` has been removed from the codebase entirely — not suppressed, not deferred — removed.
- **No transmission cluster analysis or network inference.** This approach is inappropriate for Aotearoa's scale. We do not build it.
- **No epidemiological prediction or outbreak models.** There is no Predictive tab. There is no risk forecast. There is no Social Epidemic Index. These were removed from the codebase in May 2026 as part of compliance hardening.
- **No conversation text storage.** Zero Data Retention is verified at the source-code level. User messages are scrubbed of PII (NZ-specific patterns: NHI, IRD, +64 phone, NZ addresses), processed in memory by Mistral 7B, and discarded. No log file, database column, or temporary file persists any conversation text.
- **No individual tracking.** Session IDs are HMAC-SHA256 hashes truncated to 12 hex characters — irreversible by design. IP addresses are hashed for rate limiting only and never persisted. X-Forwarded-For, User-Agent, and Referer headers are stripped before any processing.
- **No third-party analytics, fingerprinting, or telemetry.** No Google Analytics, no Plausible, no anything. The frontend ships zero external trackers.

### What NOVA does instead

- Trauma-informed conversational support in three languages (English · te reo Māori · Spanish), with crisis protocols routing to Lifeline (0800 543 354), 1737, and 111.
- The Atlas tab visualises only **published Health NZ aggregates** (AIDS Epidemiology Group · Te Whatu Ora). Source citation is explicit on every card.
- National-level aggregate analytics inform community health service planning, with small-cell suppression applied (n<6 per dimension; percentages omitted while sample size is small).
- Specific outreach priorities and resource allocation are determined by **community health providers in consultation with affected communities, kaupapa Māori health providers, and people living with HIV** — not inferred by NOVA's analytics.

### The principle

> **The absence of these features is not a limitation. It is the architecture.**

Responsible AI in sexual health and HIV care is defined as much by what we refuse to build as by what we build.

---

## Languages

| Code | Language | % of NZ HIV community |
|------|----------|----------------------|
| `en` | English | primary |
| `mi` | Te Reo Māori | tangata whenua |
| `es` | Español | Pacific + LatAm diaspora |

---

## Credits

**Developer:** Emanuel Figueroa — Auckland, Aotearoa NZ  
**Organisation:** Mātauranga NOVA · Community Health Initiative · Aotearoa NZ  
**AI Model:** Mistral 7B via Ollama — fully local, zero cloud  
**Hosting:** Catalyst Cloud NZ (sovereign NZ infrastructure)

---

## Licence

Built by Emanuel Figueroa · Auckland, Aotearoa NZ · Privacy Act 2020.  
Code shared for evaluation purposes only.
