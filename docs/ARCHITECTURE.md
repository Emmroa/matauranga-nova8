# Mātauranga NOVA — Technical Architecture

**Version:** 2.0 · **Updated:** June 2026  
**Stack:** Node.js · Express · Mistral 7B · Ollama · SQLite · React · Vite · PM2 · n8n · Catalyst Cloud NZ

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CATALYST CLOUD NZ                            │
│                    (100% NZ sovereign hosting)                      │
│                                                                     │
│  ┌──────────────┐    HTTPS/443     ┌──────────────────────────┐    │
│  │   User       │ ───────────────► │      Nginx               │    │
│  │  (Browser)   │                  │  TLS 1.2/1.3 · HSTS      │    │
│  └──────────────┘                  │  HTTP → HTTPS 301        │    │
│                                    └──────────┬───────────────┘    │
│                                               │ proxy_pass          │
│                                               ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              React Frontend (Vite · PWA)                    │   │
│  │         /  Landing · /chat  Chat · /dashboard  Admin        │   │
│  └──────────────────────────┬────────────────────────────────┘    │
│                              │ /api/* (port 10000)                  │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │         Express 5 Backend (ESM · PM2 · port 10000)          │   │
│  │                                                             │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │   │
│  │  │ L1 PII  │  │ L2 Rate  │  │ L3 Zero  │  │ L4 Helmet │  │   │
│  │  │ Scrub   │  │ Limit    │  │ Retain   │  │ CSP/HSTS  │  │   │
│  │  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │   │
│  │       └────────────┴──────────────┴───────────────┘        │   │
│  │                           │                                 │   │
│  │              ┌────────────┴───────────┐                     │   │
│  │              ▼                        ▼                     │   │
│  │  ┌───────────────────┐   ┌────────────────────┐            │   │
│  │  │  Ollama (loopback │   │  SQLite            │            │   │
│  │  │  127.0.0.1:11434) │   │  analytics.db      │            │   │
│  │  │  Mistral 7B       │   │  (anon aggregates) │            │   │
│  │  └───────────────────┘   └────────────────────┘            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │    n8n Automation (port 5678 · loopback only)               │   │
│  │    6 workflows · Gmail SMTP · pm2 scheduler                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 19 | UI framework |
| Build tool | Vite | 6 | Bundler + dev server |
| Routing | React Router | 6 | SPA navigation |
| Charts | Chart.js | 4 | Analytics dashboard |
| PWA | Web App Manifest + SW | — | Installable, offline shell |
| Backend | Node.js | 20+ | Runtime |
| Framework | Express | 5 (ESM) | HTTP server |
| AI model | Mistral 7B | via Ollama | Language model (local) |
| Inference | Ollama | latest | Model serving (loopback) |
| Queue | p-queue | — | Sequential inference (concurrency=1) |
| Circuit breaker | opossum | — | Wraps every Ollama call, 10s timeout |
| Database | better-sqlite3 | — | Anonymous analytics |
| Auth | bcryptjs + cookies | — | Admin session (8h TTL) |
| Process mgr | PM2 | — | Backend daemon + restart |
| Automation | n8n | 2.8.4 | Workflow automation |
| Reverse proxy | Nginx | — | TLS termination, HTTP→HTTPS |
| TLS | ZeroSSL ECC (ec-256) | — | Via acme.sh + DuckDNS DNS-01 |
| Firewall | UFW | — | Allow 22/80/443 only |
| Brute-force | fail2ban | — | SSH jail |
| Platform | Catalyst Cloud NZ | c1.c8r16 | Sovereign NZ hosting |

---

## Quad-Layer Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  L1  PII SCRUBBING  (server.js · scrubPII function)             │
│                                                                 │
│  Patterns stripped BEFORE message reaches Ollama:              │
│  • NZ NHI numbers       (e.g. ABC1234)                         │
│  • NZ IRD numbers       (8–9 digit tax IDs)                    │
│  • NZ phone numbers     (+64 and 0x formats)                   │
│  • Email addresses      (RFC 5322 pattern)                      │
│  • Credit card numbers  (Luhn-adjacent patterns)               │
│  • NZ street addresses  (number + street + suburb)             │
│  Implementation: regex replace → "[removed]" token             │
├─────────────────────────────────────────────────────────────────┤
│  L2  RATE LIMITING  (express-rate-limit · session-based)        │
│                                                                 │
│  Key: session UUID (never IP address)                          │
│  • /api/chat        20 requests / 15 min per session           │
│  • /api/admin/login 5 requests  / 15 min                       │
│  • /api/admin/*     60 requests / 15 min per session           │
│  Circuit breaker (opossum): opens after 3 failures             │
│  Timeout: 10 seconds per Ollama call                           │
│  Half-open probe: every 30 seconds                             │
├─────────────────────────────────────────────────────────────────┤
│  L3  ZERO DATA RETENTION  (database.js · recordEvent)          │
│                                                                 │
│  What is stored (SQLite analytics.db):                         │
│  • session_uuid    → HMAC-SHA256 truncated to 12 hex chars     │
│  • region_code     → NTH / MID / CEN / STH / NAT              │
│  • topic_code      → 36 predefined codes (e.g. HIV, PrEP)     │
│  • language        → en / es / mi                              │
│  • timestamp_hour  → truncated to hour precision               │
│  • crisis_flag     → 0 or 1                                    │
│                                                                 │
│  What is NEVER stored:                                         │
│  • Message text (any of it)                                    │
│  • Raw session IDs                                             │
│  • IP addresses                                                │
│  • User-Agent or browser fingerprints                          │
│  • Location beyond region code                                 │
├─────────────────────────────────────────────────────────────────┤
│  L4  SECURITY HEADERS  (Helmet.js + Nginx)                     │
│                                                                 │
│  • Content-Security-Policy: strict (no inline scripts)         │
│  • Strict-Transport-Security: max-age=31536000; includeSubDomains │
│  • X-Frame-Options: DENY                                       │
│  • X-Content-Type-Options: nosniff                             │
│  • Referrer-Policy: no-referrer                                │
│  • Permissions-Policy: camera=(), microphone=(), geolocation=()│
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
User types message
       │
       ▼
  [Browser]
  Client-side: sessionId (UUID v4, ephemeral)
  Headers: X-Session-Id, X-Region-Code, consent: true
       │
       │ HTTPS POST /api/chat
       ▼
  [Nginx] TLS termination
       │
       ▼
  [Express Backend]
       │
       ├─► L1: scrubPII() — strip NHI/IRD/phone/email/card/address
       │
       ├─► L2: rateLimiter() — check session bucket
       │
       ├─► detectLanguage() — score-based EN/ES/MI detection
       │
       ├─► detectTopics() — regex match against 140 topic signals
       │
       ├─► detectCrisis() — check against CRISIS_TOPICS set
       │
       ├─► recordEvent() — write anonymous row to SQLite
       │         (session_hash · region · topic · lang · hour · crisis)
       │
       ├─► if crisis → SSE 'crisis_resources' event immediately
       │
       ├─► ollamaQueue.add() → Ollama API (127.0.0.1:11434)
       │         System prompt: NOVA_SYSTEM_PROMPT
       │         Model: mistral:latest
       │         Stream: true
       │
       └─► SSE stream chunks → Browser (text/event-stream)
                 Events: meta · crisis_resources · chunk · done · error

Message text: NEVER written to disk, log, or database.
```

---

## n8n Automation Architecture

```
n8n (port 5678, loopback only)
│
├── WF1: Weekly Stats Report
│     Schedule (Mon 08:00 NZST)
│     → GET localhost:10000/api/health
│     → Code: format report
│     → Code: write /home/ubuntu/reports/weekly_*.txt
│     → EmailSend: Gmail SMTP → admin
│
├── WF2: Crisis Alert Logger
│     Webhook POST /webhook/nova-crisis-alert
│     → Code: append /home/ubuntu/logs/crisis_log.txt
│
├── WF3: Daily Health Check
│     Schedule (daily 09:00 NZST)
│     → GET localhost:10000/api/health
│     → IF ok=false → Code: append /home/ubuntu/logs/health_alerts.txt
│
├── WF4: LinkedIn Post Generator
│     Schedule (Mon 09:00 NZST)
│     → GET localhost:10000/api/health
│     → Code: generate post content
│     → EmailSend: Gmail SMTP → admin for review
│
├── WF5a: Server Auto Shutdown
│     Schedule (Fri 18:00 NZST)
│     → Code: execSync('/usr/bin/pm2 stop nova-backend')
│
└── WF5b: Server Auto Start
      Schedule (Mon 07:00 NZST)
      → Code: execSync('/usr/bin/pm2 start nova-backend')

Credentials: NOVA Gmail SMTP (stored encrypted in n8n credential manager)
Config: NODE_FUNCTION_ALLOW_BUILTIN=fs,path,child_process
```

---

## API Endpoints Reference

See [API_DOCS.md](./API_DOCS.md) for full documentation with request/response examples.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Service health status |
| GET | `/api/metadata` | None | Regions, topics, model version |
| POST | `/api/chat` | Consent header | SSE streaming chat |
| POST | `/api/admin/login` | Body credentials | Set session cookie |
| POST | `/api/admin/logout` | Cookie | Clear session |
| GET | `/api/admin/me` | Cookie | Verify session |
| GET | `/api/admin/summary` | Cookie | Analytics summary |
| GET | `/api/admin/export.csv` | Cookie | CSV export |
| POST | `/api/admin/analyst` | Cookie | SSE AI analyst |
| GET | `/api/admin/actions` | Cookie | Load action states |
| POST | `/api/admin/actions` | Cookie | Update action status |
| POST | `/api/admin/assistant` | Cookie | SSE AI assistant |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✓ | HMAC secret for session signing (min 32 chars) |
| `ADMIN_PASSWORD` | ✓ | Bcrypt-hashed admin password |
| `PORT` | — | Backend port (default: 10000) |
| `OLLAMA_BASE_URL` | — | Ollama URL (default: http://127.0.0.1:11434) |
| `OLLAMA_MODEL` | — | Model name (default: mistral) |
| `NOVA_DB_PATH` | — | SQLite path (default: ./data/analytics.db) |
| `NODE_ENV` | — | production \| development |
| `NOVA_GMAIL_USER` | n8n only | Gmail address (read from gmail.env) |
| `NOVA_GMAIL_APP_PASSWORD` | n8n only | Gmail App Password |
| `NOVA_REPORT_TO` | n8n only | Report recipient email |
