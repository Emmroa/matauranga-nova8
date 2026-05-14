# Security Policy — Mātauranga NOVA

## Overview

NOVA handles sensitive health conversations. Security is not a feature — it is the foundation of the project. This document describes the technical controls in place and how to report vulnerabilities.

---

## Quad-Layer Armor

### Layer 1 — PII Scrubbing (`server.js:scrubPII`)

All user messages are scrubbed of New Zealand-specific personally identifiable information **before** the text reaches the Ollama model. Matches are counted (anonymously) but the original text is never stored, logged, or forwarded.

| PII Type | Pattern | Replacement |
|----------|---------|-------------|
| Email address | RFC 5321 local@domain | `[EMAIL]` |
| NZ phone number | `+64`, `0xx`, `02x` mobile | `[PHONE]` |
| NHI number | `ABC1234` / `ABC12D3` | `[NHI]` |
| IRD number | 8–9 digits with optional dashes | `[IRD]` |
| Credit card | 16 digits (grouped) | `[CARD]` |
| Street address | NZ address patterns | `[ADDRESS]` |

Counter increments are tracked in-memory (`piiCounters`) and exposed only as aggregate totals via the authenticated admin dashboard. They reset on process restart and are never written to disk.

### Layer 2 — Rate Limiting (`express-rate-limit`)

Rate limits are applied per session (hashed), not per IP, to avoid penalising shared networks (clinics, community centres).

| Route | Limit |
|-------|-------|
| `POST /api/chat` | 20 req / 15 min per session |
| `POST /api/admin/login` | 10 req / 15 min |
| `POST /api/admin/analyst` | 30 req / 15 min |

### Layer 3 — Zero Data Retention (ZDR)

This is enforced in code at `server.js:recordEventsBatch` and throughout the database layer.

**What IS stored** (SQLite `backend/data/analytics.db`):

| Column | Value |
|--------|-------|
| `session_uuid` | 12-char hex truncation of HMAC-SHA256 |
| `region_code` | One of: `NTH / MID / CEN / STH / NAT` |
| `topic_code` | Regex-matched topic label |
| `language` | `en / mi / es` |
| `timestamp_hour` | Truncated to hour precision |
| `crisis_flag` | Boolean |

**What is NEVER stored:**
- Message content (any length, any language)
- Raw session IDs or UUIDs
- IP addresses (rate limiter uses in-memory hashed IP only)
- User agent strings beyond what Express logs transiently
- Names, email addresses, NHI, IRD, or any PII

### Layer 4 — Security Headers

Applied by both Nginx and Helmet (Express middleware).

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer-when-downgrade
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self';
  img-src 'self' data: blob:;
  worker-src 'self';
  manifest-src 'self';
  frame-ancestors 'none';
```

---

## Infrastructure Security

| Control | Status |
|---------|--------|
| TLS 1.2/1.3 only (ZeroSSL ECC ec-256) | ✅ Active |
| HTTP → HTTPS 301 redirect | ✅ Active |
| UFW firewall — allow 22/80/443 only | ✅ Active |
| fail2ban — sshd jail | ✅ Active |
| SSH key authentication (Ed25519) | ✅ Active |
| npm audit — 0 vulnerabilities | ✅ Verified 2026-05-14 |
| OS security updates | ✅ 0 pending 2026-05-14 |

---

## Admin Authentication

- Passwords hashed with **bcrypt** (cost factor 10)
- Sessions use a signed cookie (`nova_admin`) with HMAC-SHA256 + timestamp
- Session secret: 64-char hex random (generated with `crypto.randomBytes(32)`)
- Session expiry: 8 hours
- `SESSION_SECRET` stored in `.env` — never in `ecosystem.config.js` or source control

---

## What We Do Not Do

- We do not use third-party analytics (no Google Analytics, no Mixpanel)
- We do not send data to any external API (AI model runs fully local via Ollama)
- We do not set third-party cookies
- We do not fingerprint browsers
- We do not log user messages at any level (access logs, application logs, error logs)

---

## Current Security Checklist

| Item | Status |
|------|--------|
| PII scrubbing (L1) | ✅ |
| Rate limiting (L2) | ✅ |
| Zero Data Retention (L3) | ✅ |
| Security headers (L4) | ✅ |
| HTTPS + HSTS | ✅ |
| UFW firewall | ✅ |
| fail2ban | ✅ |
| npm audit 0 vulns | ✅ |
| SSH key auth (Ed25519) | ✅ |
| CSP header | ✅ |
| Ollama version up to date | ⚠️ v0.21 — upgrade pending |

---

## Reporting a Vulnerability

If you discover a security vulnerability in NOVA, please report it **privately**:

**Email:** emanuel.figueroa.alejandro@gmail.com  
**Subject line:** `[NOVA SECURITY] <brief description>`

Please include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

**Please do not** open a public GitHub issue for security vulnerabilities — especially for anything that could expose user privacy.

---

## Scope

In scope for responsible disclosure:
- `backend/server.js` — all routes and middleware
- `frontend/src/` — XSS, data leakage via the UI
- Nginx configuration — header bypasses, TLS issues
- Authentication — session fixation, CSRF, brute force

Out of scope:
- Social engineering attacks on the operator
- Denial-of-service against the Ollama inference server
- Vulnerabilities in phi3:mini model outputs (report to Microsoft)
