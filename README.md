# Mātauranga NOVA

> A private AI companion for HIV-related kōrero in Aotearoa New Zealand.  
> Zero Data Retention. Science-led. Culturally safe.

Built for the **Burnett Foundation Aotearoa Innovation Challenge 2026** by Emanuel Figueroa.

---

## What is NOVA?

Mātauranga NOVA is a bilingual (English / Te Reo Māori / Español) AI chat companion that lets people ask questions about HIV — stigma, treatment, prevention, identity, crisis — in a completely private environment. No account required. No messages stored. Nothing logged beyond anonymous counters.

The name combines **mātauranga** (Māori: knowledge, understanding) with **NOVA** — a new light. The interface is designed to feel safe and unhurried, with a neural-canvas background that responds to touch and typing.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 · Vite 6 · React Router · Chart.js · lucide-react |
| Styling | Inline design tokens · Cormorant Garamond + Outfit (Google Fonts) |
| PWA | Web App Manifest · Service Worker (cache-first shell / network-first API) |
| Backend | Node.js 20+ · Express 5 (ESM) · port 10000 |
| AI model | phi3:mini via Ollama (loopback `127.0.0.1:11434`) |
| Database | better-sqlite3 · `backend/data/analytics.db` |
| Queue | p-queue (concurrency = 1, sequential inference) |
| Circuit breaker | opossum (wraps every Ollama call) |
| Auth | bcryptjs · cookie-based sessions · 8h expiry |
| Process manager | PM2 (`nova-backend`, port 10000) |
| Reverse proxy | Nginx · TLS 1.2/1.3 · HTTP → HTTPS 301 |
| TLS certificate | ZeroSSL ECC (ec-256) via acme.sh + DuckDNS DNS-01 |
| Firewall | UFW — allow 22/80/443 only |
| Brute-force | fail2ban — sshd jail |
| Platform | Catalyst Cloud NZ |

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

## Analytics Dashboard — 7 Tabs

Access at `/dashboard` (requires admin login).

| # | Tab | Description |
|---|-----|-------------|
| 1 | ◉ Command | Live KPIs · time-series with μ±1.5σ bands · anomaly detection · topic breakdown by category · language distribution · AI-generated insights |
| 2 | ⬡ Atlas | Regional activity map — NTH / MID / CEN / STH / NAT zones |
| 3 | ↗ Predictive | Seasonal trend model · stress calendar · outbreak risk indicators |
| 4 | 🛡 Privacy | ZDR compliance view · NZ Privacy Act 2020 · HIPC 2020 · Te Mana Raraunga framework |
| 5 | ◎ Status | Live service health (Ollama · backend · nginx) · infrastructure roadmap |
| 6 | 📋 Actions | Social Stress Indicator tracker (13 indicators) with 3-state institutional response (Pending / In Progress / Completed) · Live PII Audit counter (Layer 1) |
| 7 | 🤖 Intelligence | Internal AI chat assistant (anonymous data only) · PDF report generator (Monthly · Crisis · Privacy · Regional) |

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
| POST | `/api/admin/analyst` | SSE AI analyst (phi3:mini over aggregate data) |
| GET | `/api/admin/actions` | Load institutional action states |
| POST | `/api/admin/actions` | Update action status (allowlisted keys + statuses) |
| POST | `/api/admin/assistant` | SSE AI assistant with caller-supplied sanitized context |

---

## Running Locally (Development)

### Prerequisites
- Node.js 20+
- [Ollama](https://ollama.ai) with `phi3:mini` pulled (`ollama pull phi3:mini`)

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
| Health Information Privacy Code 2020 (HIPC) | Health data (HIV status) never stored |
| Te Mana Raraunga | Māori data sovereignty — no profiling, no re-identification |
| UN OHCHR HIV rights framework | Non-stigmatising language in all prompts |

Crisis safety resources surfaced automatically:
- **1737** — free text or call, 24/7
- **Lifeline** — 0800 543 354
- **111** — immediate danger

---

## Languages

| Code | Language | % of NZ HIV community |
|------|----------|----------------------|
| `en` | English | primary |
| `mi` | Te Reo Māori | tangata whenua |
| `es` | Español | Pacific + LatAm diaspora |

---

## Credits

**Developer:** Emanuel Figueroa  
**Organisation:** Burnett Foundation Aotearoa  
**Challenge:** Innovation Challenge 2026  
**AI Model:** phi3:mini (Microsoft) via Ollama — fully local, zero cloud  
**Hosting:** Catalyst Cloud NZ (data sovereignty)

---

## Licence

All rights reserved — Burnett Foundation Aotearoa 2026.  
Code shared for evaluation purposes only.
