# Mātauranga NOVA — Project Overview

**Prepared by:** Emanuel Figueroa — Auckland, Aotearoa NZ  
**Date:** June 2026  
**Audience:** Investors · Partners · Health Sector · CV/Portfolio

---

## The Problem

Aotearoa New Zealand has among the lowest HIV diagnosis rates in the developed world — but stigma remains the single greatest barrier to testing, treatment, and care.

**The numbers tell the story:**
- **95** new HIV diagnoses in NZ in 2024 (AIDS Epidemiology Group)
- **~40%** of people living with HIV delay testing by more than 2 years due to stigma
- **Syphilis cases increased by 38%** between 2022 and 2024 (ESR surveillance data)
- **Gonorrhoea rates** rising sharply, particularly in young men who have sex with men
- Communities most affected — Takatāpui, Pasifika, migrant communities, rural Māori — have the least access to culturally safe sexual health support

Existing resources are clinical, stigmatising, or hard to access. There is no culturally safe, private, free digital resource for sexual health education in Aotearoa that works in English, Te Reo Māori, and Spanish.

**NOVA fills that gap.**

---

## The Solution

**Mātauranga NOVA** is a free, private AI sexual health educator for Aotearoa NZ.

It covers HIV, STIs (syphilis, gonorrhoea, chlamydia, DoxyPEP), PrEP/PEP, and sexual health in general — in three languages, with zero data retention, running on 100% NZ infrastructure.

NOVA is not a chatbot. It is a digital educator grounded in:
- **Te Whare Tapa Whā** — Mason Durie's holistic model of Māori health
- **Mātauranga** — Māori knowledge and understanding
- **Community health practice** — built by someone who has lived experience in NZ health advocacy

---

## Target Audience

| Community | Why NOVA matters |
|-----------|-----------------|
| Takatāpui (Māori LGBTQIA+) | Culturally safe, te reo Māori support, no whakamā |
| Pacific communities | Spanish and English, Pacific wellbeing model |
| Migrant communities | Spanish, no NZ-specific knowledge assumed |
| Rural communities | Remote access, no clinic visit needed |
| Young people | Private, non-judgmental, available 24/7 |
| People newly diagnosed | Immediate support without waiting for appointment |
| Healthcare workers | Reference tool for patient conversations |

---

## Technology Differentiators

| Feature | NOVA | Generic AI (ChatGPT etc.) |
|---------|------|--------------------------|
| Data stored | Zero — no message text | Cloud servers, may train on data |
| Infrastructure | 100% NZ (Catalyst Cloud) | US/EU servers |
| Languages | EN + Te Reo Māori + Español | EN primary |
| Cultural framework | Te Whare Tapa Whā | None |
| Crisis protocol | Auto-detect + immediate resources | None |
| NZ legal compliance | Privacy Act 2020, HIPC, Te Mana Raraunga | Not NZ-specific |
| Cost to user | Free | Subscription |
| PII scrubbing | NZ-specific (NHI, IRD, +64) | None |

---

## Privacy-First Architecture

NOVA's **Quad-Layer Armor** enforces Zero Data Retention in code, not just policy:

1. **L1 — PII Scrubbing:** NZ-specific identifiers stripped before AI sees message
2. **L2 — Rate Limiting:** Session-based (not IP-based), protecting anonymity
3. **L3 — Zero Retention:** Message text never touches disk, database, or logs
4. **L4 — Security Headers:** Strict CSP, HSTS, X-Frame-Options DENY

**What is stored:** Anonymous aggregate counts only — region, topic, language, hour, crisis flag. No message content. No session IDs. No IP addresses.

This architecture was designed in direct response to **Te Mana Raraunga** (Māori Data Sovereignty) principles and the reality that NZ communities are small enough that even aggregate data can identify individuals without proper controls.

---

## Cultural Safety — Te Whare Tapa Whā

NOVA responds to the whole person across four dimensions:

| Dimension | Māori | How NOVA responds |
|-----------|-------|------------------|
| Body | Tinana | Clinical facts: U=U, PrEP, DoxyPEP, STI treatment |
| Mind | Hinengaro | Emotional validation, destigmatising language |
| Spirit | Wairua | Aroha, Tika me Pono, Kaitiakitanga |
| Family/community | Whānau | Community resources, disclosure support |

NOVA never reduces a person to their diagnosis. Every response opens with connection before information.

---

## Roadmap 2026–2027

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| Phase 1 | ✅ Live (Jun 2026) | Mistral 7B · Trilingual · Privacy-first analytics · n8n automation |
| Phase 2 | Q3 2026 | GPU upgrade · 8K context · MFA admin · Automated dependency scanning |
| Phase 3 | Q4 2026 | Te reo Māori cultural responsiveness depth · Takatāpui-specific pathways |
| Phase 4 | Q1 2027 | API for sexual health clinics · Healthpoint NZ integration |
| Phase 5 | Q2 2027 | Direct appointment booking · NZAF partnership · Ministry of Health alignment |

---

## Built By

**Emanuel Figueroa**  
Auckland, Aotearoa NZ  

Full-stack developer and community health advocate. Mātauranga NOVA was built to fill the gap Emanuel found in NZ sexual health resources — a gap that disproportionately affects communities he is part of and advocates for.

The project is built with:
- Deep respect for Te Tiriti o Waitangi and Māori Data Sovereignty
- Privacy-by-design as the foundation, not an afterthought
- Community health principles, not commercial health-tech logic

**Contact:** Available via LinkedIn or GitHub.  
**GitHub:** github.com/Emmroa/matauranga-nova8  
**Hosting:** Catalyst Cloud NZ — data never leaves Aotearoa
