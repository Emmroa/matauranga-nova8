# Mātauranga NOVA — Security Audit

**Version:** 1.0 · **Audit Date:** June 2026  
**Auditor:** Internal (Emanuel Figueroa)  
**Overall Score: 87 / 100**

---

## Security Score Breakdown

| Category | Weight | Score | Weighted |
|----------|--------|-------|---------|
| Input validation & sanitisation | 20% | 90 | 18.0 |
| Authentication & session management | 15% | 88 | 13.2 |
| Data protection & zero retention | 20% | 96 | 19.2 |
| Transport security | 10% | 95 | 9.5 |
| Security headers | 10% | 90 | 9.0 |
| Rate limiting & DoS protection | 10% | 82 | 8.2 |
| Dependency management | 5% | 75 | 3.75 |
| Logging & monitoring | 5% | 78 | 3.9 |
| Incident response readiness | 5% | 72 | 3.6 |
| **TOTAL** | **100%** | — | **88.35 → 87/100** |

---

## OWASP Top 10 (2021) Compliance

| # | Risk | Status | Implementation |
|---|------|--------|---------------|
| A01 | Broken Access Control | ✅ Pass | Admin routes protected by signed httpOnly cookie (8h TTL). No IDOR — no user-specific resources. |
| A02 | Cryptographic Failures | ✅ Pass | TLS 1.2/1.3 only. ZeroSSL ECC ec-256. bcryptjs for password hashing. HMAC-SHA256 for session IDs. |
| A03 | Injection | ✅ Pass | No SQL string interpolation — better-sqlite3 parameterised statements only. No eval. No shell exec in user path. |
| A04 | Insecure Design | ✅ Pass | Zero Data Retention is a design principle, not an afterthought. No feature stores message text. |
| A05 | Security Misconfiguration | ✅ Pass | Helmet.js CSP/HSTS. UFW 22/80/443 only. No default credentials. No debug routes in production. |
| A06 | Vulnerable Components | ⚠️ Partial | Dependencies audited at deploy. No automated `npm audit` in CI yet (planned Q3 2026). |
| A07 | Auth & Session Failures | ✅ Pass | SameSite=Lax, HttpOnly, Secure cookies. No JWT in localStorage. Session invalidated on logout. |
| A08 | Software & Data Integrity | ✅ Pass | No deserialization of untrusted data. Package lockfile committed. n8n workflows version-controlled. |
| A09 | Logging & Monitoring | ⚠️ Partial | n8n health check alerts. No centralised SIEM. Log retention policy in place (30 days). |
| A10 | SSRF | ✅ Pass | Ollama only accessible on 127.0.0.1:11434. No user-controlled URLs in backend. n8n on loopback only. |

---

## NZ Privacy Act 2020 — Information Privacy Principles (IPPs 1–13)

| IPP | Principle | Status | How NOVA Complies |
|-----|-----------|--------|-------------------|
| 1 | Purpose of collection | ✅ | Anonymous aggregate analytics only. Purpose stated in consent modal before use. |
| 2 | Source of information | ✅ | Information collected directly from user interaction, not third parties. |
| 3 | Collection of information from individual | ✅ | Consent required before any data flows. Consent modal explains all data use. |
| 3A | Collection of health information | ✅ | No health information (HIV status, STI status) is collected or stored. |
| 4 | Manner of collection | ✅ | Collection is not misleading. Privacy notice is prominent and plain-language. |
| 5 | Storage and security | ✅ | SQLite encrypted at rest. UFW + fail2ban. TLS in transit. chmod 600 on credential files. |
| 6 | Access to personal information | ✅ | No personal information is stored, so access requests return nothing. |
| 7 | Correction of personal information | ✅ | No personal information is stored. Nothing to correct. |
| 8 | Accuracy | ✅ | Anonymous aggregates only; no individual-level data that could be inaccurate. |
| 9 | Retention | ✅ | No personal data retained. Anonymous aggregates kept for service improvement only. |
| 10 | Use of personal information | ✅ | Aggregate counts used only for community health service planning. |
| 11 | Disclosure of personal information | ✅ | No personal information to disclose. No data sold or shared with third parties. |
| 12 | Unique identifiers | ✅ | Session IDs are HMAC-SHA256 truncated to 12 hex chars — irreversible. |
| 13 | Transborder data flows | ✅ | 100% Catalyst Cloud NZ. Data never leaves Aotearoa. Ollama runs on localhost. |

---

## Health Information Privacy Code 2020 (HIPC)

| Rule | Requirement | Status | Notes |
|------|-------------|--------|-------|
| Rule 1 | Purpose limitation for health information | ✅ | NOVA does not collect health information. HIV/STI status is never stored. |
| Rule 2 | Source of health information | ✅ | Not applicable — no health information collected. |
| Rule 3 | Collection with consent | ✅ | Explicit consent required. Users can decline. |
| Rule 5 | Storage and security of health information | ✅ | No health information stored. SQLite contains only topic codes (e.g. "HIV") — not individual status. |
| Rule 6 | Access to health information | ✅ | No individual health records exist. |
| Rule 10 | Use of health information | ✅ | Aggregate topic counts used for anonymous population-level reporting only. |
| Rule 11 | Disclosure of health information | ✅ | No health information to disclose. |

---

## Te Mana Raraunga — Māori Data Sovereignty

| Principle | Status | Implementation |
|-----------|--------|---------------|
| Rangatiratanga (authority) | ✅ | Users control their session. No data collected without consent. |
| Whakapapa (relationships) | ✅ | Data not cross-tabulated in ways that could identify communities. |
| Whanaungatanga (obligations) | ✅ | Small-cell suppression (n<6) prevents community-level identification. |
| Kotahitanga (collective benefit) | ✅ | Anonymous aggregates inform community health services, not commercial use. |
| Manaakitanga (reciprocity) | ✅ | Service is free. No monetisation of user data. |
| Kaitiakitanga (stewardship) | ✅ | No regional×topic cross-tabulation. No transmission cluster analysis. |

---

## Penetration Testing Checklist

### Authentication
- [x] Admin login requires password (bcrypt)
- [x] Brute force protected (5 attempts / 15 min rate limit)
- [x] Session cookie: HttpOnly, SameSite=Lax, Secure
- [x] Session expires after 8 hours
- [x] Logout invalidates server-side session
- [ ] Multi-factor authentication (planned Q3 2026)

### Input Validation
- [x] PII scrubbing before AI processing (L1)
- [x] Message length limits enforced
- [x] sessionId validated as UUID v4
- [x] regionCode validated against allowlist
- [x] consent field must be boolean true
- [x] Admin action keys validated against allowlist

### Transport
- [x] TLS 1.2/1.3 only (SSLv3, TLS 1.0, 1.1 disabled)
- [x] HSTS header: max-age=31536000
- [x] HTTP redirects to HTTPS (301)
- [x] Certificate: ZeroSSL ECC ec-256

### Headers
- [x] Content-Security-Policy (Helmet.js)
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Referrer-Policy: no-referrer
- [x] Permissions-Policy: camera=(), microphone=()
- [x] Server header removed

### Data
- [x] No message text written to any storage
- [x] Session IDs hashed before storage
- [x] IP addresses never persisted
- [x] Database file permissions: 600
- [x] Environment variables: not in codebase

### Network
- [x] UFW: only 22, 80, 443 open
- [x] Ollama: loopback only (127.0.0.1:11434)
- [x] n8n: loopback only (127.0.0.1:5678)
- [x] fail2ban: SSH brute-force jail active
- [ ] Intrusion detection system (planned Q4 2026)

---

## Known Limitations and Mitigations

| Limitation | Risk | Mitigation |
|------------|------|-----------|
| No automated dependency scanning | Medium | Manual `npm audit` at each deploy. Planned CI integration Q3 2026. |
| Single-server architecture | Medium | PM2 auto-restart. n8n daily health check alerts. Catalyst Cloud SLA. |
| No MFA for admin | Low-Medium | Rate limiting on login. Strong password requirement. Planned Q3 2026. |
| No centralised SIEM | Low | n8n health alerts. fail2ban logs. PM2 logs. Manual review weekly. |
| Mistral 7B prompt injection risk | Low | Anti-jailbreak rules in system prompt. No tool use or code execution by AI. |
| n8n accessible from localhost | Low | Port 5678 bound to 127.0.0.1 only. No public exposure. UFW blocks port. |
| Gmail App Password in env file | Low | File is chmod 600. Not in git. Stored only on Catalyst Cloud NZ server. |

---

## Recommendations (Priority Order)

1. **[High]** Add `npm audit` to deployment pipeline — automated vulnerability scanning
2. **[High]** Enable MFA for admin dashboard login
3. **[Medium]** Implement centralised logging (e.g. Loki + Grafana on same server)
4. **[Medium]** Add automated security headers testing (e.g. securityheaders.com in CI)
5. **[Low]** Third-party penetration test by Q4 2026
6. **[Low]** Intrusion detection (ossec or similar)
