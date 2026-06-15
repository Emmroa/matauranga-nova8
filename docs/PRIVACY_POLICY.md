# Privacy Policy — Mātauranga NOVA

**Last updated:** June 2026  
**Organisation:** Mātauranga NOVA · Community Health Initiative · Aotearoa NZ  
**Governing law:** New Zealand Privacy Act 2020

---

## Plain-language summary

> NOVA does not store what you type. Ever.  
> We count anonymous topics and languages to improve the service. That's all.  
> Nothing you share with NOVA can be traced back to you.

---

## 1. Who we are

Mātauranga NOVA is a free digital sexual health educator built by Emanuel Figueroa, operating as Mātauranga NOVA · Community Health Initiative · Aotearoa NZ. We are not a clinical service, a registered health provider, or a government agency.

---

## 2. What we collect

### What we DO collect (anonymous aggregates only)

When you use NOVA, we record **one anonymous count** per conversation topic. That record contains:

| Field | Example | What it means |
|-------|---------|---------------|
| Session hash | `a3f9d12e8b4c` | A 12-character code — not your session ID, not reversible |
| Region code | `NTH` | Which of 5 NZ regions you selected (or "National / prefer not to say") |
| Topic code | `PrEP` | Which health topic was discussed (from a list of 36 predefined codes) |
| Language | `en` | Which language you used |
| Hour | `2026-06-15T09:00:00Z` | The hour the conversation happened (not the minute or second) |
| Crisis flag | `0` or `1` | Whether crisis resources were automatically surfaced |

This is the complete list. Nothing else is stored.

### What we NEVER collect

- The text of any message you send to NOVA
- The text of any response NOVA gives you
- Your name, email address, phone number, or any contact details
- Your IP address (it is never written to any storage)
- Your device type, browser, or operating system
- Your location beyond the region you choose
- Your HIV status, STI status, or any personal health information
- Any government identifier (NHI, IRD, passport number)
- Any payment information

---

## 3. How we protect what little we collect

### Before the AI sees your message (Layer 1 — PII Scrubbing)

Your message is automatically scanned before it reaches the AI. Any NZ-specific identifiers — NHI numbers, IRD numbers, phone numbers (+64 format), email addresses, credit card patterns, and NZ street addresses — are replaced with `[removed]`. This happens in memory, before any processing.

### Zero Data Retention (Layer 3)

Message text never touches the database, log files, or any storage. The only thing written to the database is the anonymous aggregate row described in section 2.

### Session anonymisation

Your session ID (a UUID generated in your browser) is hashed using HMAC-SHA256 and truncated to 12 hexadecimal characters before being stored. This hash cannot be reversed to identify you.

### Infrastructure

All data stays in Aotearoa New Zealand on Catalyst Cloud NZ infrastructure. Nothing is sent to overseas servers. The AI model (Mistral 7B) runs entirely locally on our server — your messages never leave NZ.

---

## 4. Cookies

NOVA uses **no tracking cookies** and **no third-party cookies**.

The only cookie set is a session authentication cookie for the admin dashboard (`nova_session`). This cookie is:
- Only set when an administrator logs into the dashboard
- HttpOnly (cannot be read by JavaScript)
- SameSite=Lax (CSRF protection)
- Expires after 8 hours

Regular users of NOVA's chat service receive no cookies.

---

## 5. Third parties

NOVA uses **no third-party analytics** (no Google Analytics, no Plausible, no Mixpanel, no Meta Pixel). The frontend ships zero external trackers.

External services referenced in NOVA's responses (NZAF, Lifeline, Burnett Foundation, Body Positive NZ) are provided as community resources only. We have no data-sharing arrangements with them.

---

## 6. How we use aggregate data

Anonymous aggregate counts are used solely to:
- Understand which health topics are most needed
- Identify when crisis support resources are being activated
- Plan future features and language support
- Support community health service planning (anonymously, at population level)

We never sell, rent, or share data with commercial entities. We never use data for advertising.

---

## 7. Your rights under the NZ Privacy Act 2020

Under the Privacy Act 2020, you have the right to:

- **Access** information we hold about you (we hold none that can be attributed to you)
- **Correct** information we hold about you (not applicable — no attributable data)
- **Complain** to the Privacy Commissioner if you believe your privacy has been breached

Because we store no personally identifiable information, most privacy rights cannot be practically exercised — there is nothing to access, correct, or delete. This is by design.

**Privacy Commissioner:** privacy.org.nz · 0800 803 909

---

## 8. Health information

NOVA is not a health provider. We do not collect or store health information as defined under the Health Information Privacy Code 2020. If you share your HIV status, STI diagnosis, or other health details with NOVA during a conversation, that text:
- Is never written to any storage
- Is used only to provide a helpful response in that session
- Disappears when the conversation ends

---

## 9. Children

NOVA is intended for adults (18+) and older teenagers with appropriate support. We do not knowingly collect any information from children under 13.

---

## 10. Changes to this policy

We will update this policy when our practices change. The date at the top of this document reflects the last update. Significant changes will be noted in our changelog.

---

## 11. Contact

For privacy enquiries: contact details available via github.com/Emmroa/matauranga-nova8

For complaints: Office of the Privacy Commissioner · privacy.org.nz · 0800 803 909
