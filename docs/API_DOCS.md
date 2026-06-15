# Mātauranga NOVA — API Documentation

**Base URL (production):** `https://your-domain.nz`  
**Base URL (local dev):** `http://localhost:10000`  
**Version:** 2.0 · **Updated:** June 2026  
**Content-Type:** `application/json` (all endpoints)  
**Streaming:** `text/event-stream` (chat and analyst endpoints)

---

## Authentication

### Public endpoints
No authentication required. Consent header required for `/api/chat`.

### Admin endpoints
Cookie-based session authentication. Login via `POST /api/admin/login` to receive a signed `HttpOnly` session cookie. Include the cookie in all subsequent admin requests.

- Cookie name: `nova_session`
- Expiry: 8 hours
- Flags: HttpOnly, SameSite=Lax, Secure (production)

---

## Rate Limiting

| Endpoint group | Limit | Window | Key |
|---------------|-------|--------|-----|
| `/api/chat` | 20 requests | 15 minutes | Session UUID |
| `/api/admin/login` | 5 requests | 15 minutes | Session UUID |
| `/api/admin/*` | 60 requests | 15 minutes | Session UUID |

Rate limit headers returned on every response:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 19
X-RateLimit-Reset: 1718000000
```

When limit exceeded → `429 Too Many Requests`

---

## Public Endpoints

---

### GET /api/health

Returns current service health status.

**Request**
```bash
curl -s https://your-domain.nz/api/health
```

**Response 200**
```json
{
  "ok": true,
  "ollamaUp": true,
  "modelLoaded": true,
  "breakerOpen": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Overall service health |
| `ollamaUp` | boolean | Ollama reachable at 127.0.0.1:11434 |
| `modelLoaded` | boolean | Mistral 7B model loaded and responsive |
| `breakerOpen` | boolean | Circuit breaker tripped (AI degraded) |

**Response when degraded**
```json
{
  "ok": false,
  "ollamaUp": false,
  "modelLoaded": false,
  "breakerOpen": true
}
```

---

### GET /api/metadata

Returns static configuration — regions, topic list, model version.

**Request**
```bash
curl -s https://your-domain.nz/api/metadata
```

**Response 200**
```json
{
  "regions": [
    { "code": "NTH", "label": "Northern (Auckland / Northland)" },
    { "code": "MID", "label": "Midland (Waikato / Bay of Plenty)" },
    { "code": "CEN", "label": "Central (Wellington / Taranaki)" },
    { "code": "STH", "label": "Southern (Canterbury / Otago)" },
    { "code": "NAT", "label": "National / prefer not to say" }
  ],
  "topics": [
    { "code": "HIV", "category": "clinical", "label_en": "HIV general", "label_mi": "Mate Āraikore" },
    { "code": "PrEP", "category": "clinical", "label_en": "PrEP (pre-exposure)", "label_mi": "PrEP" }
  ],
  "model": "mistral:latest",
  "version": "2.0"
}
```

---

### POST /api/chat

Streaming chat endpoint. Returns Server-Sent Events (SSE).

**Headers required**
```
Content-Type: application/json
Accept: text/event-stream
```

**Request body**
```json
{
  "message": "What is PrEP?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "regionCode": "NTH",
  "language": "en",
  "consent": true,
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hey — how are you doing?" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | ✓ | User message (max 2000 chars) |
| `sessionId` | string | ✓ | UUID v4, client-generated, ephemeral |
| `regionCode` | string | ✓ | One of: NTH, MID, CEN, STH, NAT |
| `language` | string | — | en, es, mi (auto-detected if omitted) |
| `consent` | boolean | ✓ | Must be `true` |
| `history` | array | — | Prior conversation turns (max 10) |

**SSE Event stream**

```
event: meta
data: {"lang":"en","region":"NTH","crisis":false,"topics":["PrEP"]}

event: chunk
data: {"text":"PrEP stands for"}

event: chunk
data: {"text":" pre-exposure prophylaxis"}

event: done
data: {"text":""}
```

**SSE Events**

| Event | When | Data |
|-------|------|------|
| `meta` | First, always | lang, region, crisis flag, detected topics |
| `crisis_resources` | If crisis detected | Crisis text with 111/Lifeline/1737 |
| `chunk` | During streaming | Partial text token |
| `done` | Stream complete | Empty text |
| `error` | On error | Error message |

**Error responses**
```json
{ "error": "consent required" }                         // 400
{ "error": "sessionId required (ephemeral UUID v4)" }  // 400
{ "error": "Too many messages. Please wait a moment." } // 429
```

**curl example (streaming)**
```bash
curl -N -s -X POST https://your-domain.nz/api/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "message": "What is U=U?",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "regionCode": "NAT",
    "consent": true
  }'
```

---

### POST /api/feedback

Submit a session satisfaction rating.

**Request body**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "regionCode": "NAT",
  "rating": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | ✓ | Same UUID used in chat |
| `regionCode` | string | ✓ | NTH, MID, CEN, STH, NAT |
| `rating` | integer | ✓ | 1–5 |

**Response 200**
```json
{ "ok": true }
```

---

## Admin Endpoints (cookie auth required)

---

### POST /api/admin/login

Authenticate and receive session cookie.

**Request body**
```json
{
  "password": "your-admin-password"
}
```

**Response 200** — sets `nova_session` cookie
```json
{ "ok": true }
```

**Response 401**
```json
{ "error": "Invalid password" }
```

---

### POST /api/admin/logout

Invalidate current session.

**Response 200**
```json
{ "ok": true }
```

---

### GET /api/admin/me

Verify active session.

**Response 200**
```json
{ "ok": true, "role": "admin" }
```

**Response 401**
```json
{ "error": "Unauthorized" }
```

---

### GET /api/admin/summary

Full anonymous analytics summary.

**Response 200**
```json
{
  "sessions": 142,
  "crises": 3,
  "topTopics": [
    { "code": "PrEP", "label_en": "PrEP (pre-exposure)", "count": 41 }
  ],
  "languages": { "en": 98, "es": 31, "mi": 13 },
  "regions": { "NTH": 67, "STH": 28, "CEN": 22, "MID": 15, "NAT": 10 },
  "piiEvents": 0,
  "weeklyTrend": [ ... ]
}
```

---

### GET /api/admin/export.csv

Download all anonymous analytics as CSV.

**Response 200** — `text/csv`
```csv
session_uuid,region_code,topic_code,language,timestamp_hour,crisis_flag
a3f9d12e8b4c,NTH,PrEP,en,2026-06-15T09:00:00Z,0
```

---

### POST /api/admin/analyst

SSE streaming AI analyst over aggregate data.

**Request body**
```json
{
  "question": "Which topic has grown most this month?",
  "context": { "sessions": 142, "topTopics": [...] }
}
```

**SSE stream** — same format as `/api/chat`

---

### GET /api/admin/actions

Load institutional action tracking states.

**Response 200**
```json
{
  "actions": {
    "stigma_training": "in_progress",
    "prep_access_rural": "pending",
    "takatapui_liaison": "completed"
  }
}
```

---

### POST /api/admin/actions

Update an action state. Keys and statuses are allowlisted server-side.

**Request body**
```json
{
  "key": "prep_access_rural",
  "status": "in_progress"
}
```

Valid statuses: `pending` · `in_progress` · `completed`

**Response 200**
```json
{ "ok": true }
```

---

## n8n Webhook

### POST /webhook/nova-crisis-alert

Internal webhook for n8n Crisis Alert Logger workflow. Logs a crisis event counter (no PII).

**Base URL:** `http://localhost:5678`  
**Auth:** None (loopback only — not publicly exposed)

**Request body**
```json
{
  "region": "NTH",
  "topic": "Suicide_Ideation",
  "lang": "en"
}
```

**Response 200**
```json
{ "logged": true }
```

---

## Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | Bad Request | Missing required field or invalid value |
| 401 | Unauthorized | Admin session required or expired |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Ollama down or circuit breaker open |

All errors return JSON: `{ "error": "description" }`
