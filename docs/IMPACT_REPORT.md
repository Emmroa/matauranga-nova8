# Mātauranga NOVA — Impact Report

**Period:** June 2026 (Launch)  
**Prepared by:** Emanuel Figueroa — Auckland, Aotearoa NZ  
**Organisation:** Mātauranga NOVA · Community Health Initiative · Aotearoa NZ

---

## Mission

To reduce HIV stigma and shame around sexual health in Aotearoa New Zealand through honest, private, culturally safe AI-powered education — accessible to every community, in every language they need.

## Vision

An Aotearoa where no one delays HIV testing, STI treatment, or sexual health care because of fear, shame, or lack of access to safe information.

---

## NZ Sexual Health Context (2024–2025)

### HIV

| Indicator | Figure | Source |
|-----------|--------|--------|
| New HIV diagnoses (2024) | 95 | AIDS Epidemiology Group, University of Otago |
| People living with HIV on ART | ~2,312 | Health NZ / NZAF 2024 |
| Late diagnoses (CD4 <350) | ~28% | AIDS Epidemiology Group 2024 |
| U=U policy signed | 15 Feb 2026 | NZ Government |
| 2030 zero transmission target | Active | Te Tiriti-based health strategy |

### STIs (ESR Surveillance 2023–2024)

| STI | Trend | Notes |
|-----|-------|-------|
| Syphilis | +38% (2022–2024) | Significant increase, particularly infectious syphilis |
| Gonorrhoea | Rising | Increasing antibiotic resistance a concern |
| Chlamydia | Stable-high | Most commonly reported STI in NZ |
| DoxyPEP uptake | Early stage | NZSHS guidelines published 2024 |

### Access gaps
- Rural communities: nearest sexual health clinic may be 2+ hours away
- Migrant communities: language barriers, cultural stigma, unfamiliarity with NZ system
- Takatāpui: limited culturally safe, explicitly affirming resources
- Young people: fear of judgment, no private way to ask questions

---

## How NOVA Addresses the Gap

### The gap
Between knowing you need information and being able to access it safely, there is a wall of stigma, fear, distance, language, and cost. NOVA removes that wall.

### What NOVA provides

| Need | NOVA response |
|------|--------------|
| Safe space to ask questions | Zero data retention — nothing stored, nothing judged |
| Information in my language | Trilingual: English, Te Reo Māori, Español |
| Culturally safe approach | Te Whare Tapa Whā framework, Takatāpui-affirming |
| Crisis support right now | Auto-detect + immediate 111/Lifeline/1737 resources |
| STI and sexual health info | Full scope: HIV, syphilis, gonorrhoea, chlamydia, PrEP/PEP, DoxyPEP |
| Available 24/7 | Always on, no appointment needed |
| Free | No cost, no account, no barriers |

---

## Languages Served

| Code | Language | Community served |
|------|----------|-----------------|
| `en` | English | Primary language of Aotearoa NZ |
| `mi` | Te Reo Māori | Tangata whenua — Māori, Takatāpui |
| `es` | Español | Pacific LatAm diaspora, migrant communities |

Language detection is automatic, score-based, and switches mid-conversation if the user changes language. NOVA never assumes.

---

## Crisis Protocol

NOVA automatically detects crisis signals — suicidal ideation, self-harm, acute distress — using a set of validated topic codes. When detected:

1. The user is acknowledged warmly and personally **first**
2. Crisis resources are surfaced **immediately** via a dedicated SSE event:
   - **111** — emergency services
   - **Lifeline 0800 543 354** — 24/7, free
   - **1737** — free text or call, 24/7
3. NOVA stays present — never abandons someone in crisis
4. A `crisis_flag=1` is recorded in anonymous aggregate data (no message content)

The crisis protocol is logged (count only) to:
- `/home/ubuntu/logs/crisis_log.txt` (via n8n Workflow 2)
- Anonymous SQLite aggregate (`crisis_flag` column)

This data informs crisis resource allocation and service planning at an anonymous, population level.

---

## Communities Served

### Takatāpui (Māori LGBTQIA+)
NOVA uses Takatāpui-affirming language throughout. Te reo Māori responses use simple, confident phrases. The `Takatapui_Specific` topic code enables tracking of Takatāpui-specific support needs (anonymously) to inform service improvement.

### Pacific communities
Spanish-language support serves Pacific LatAm diaspora communities. The `Pacific_Wellbeing` topic code tracks Pacific health concerns. NOVA understands Pacific wellbeing models, not just biomedical frameworks.

### Māori communities
Te Whare Tapa Whā is the foundational health framework. Responses address Tinana (body), Hinengaro (mind), Wairua (spirit), and Whānau (community). Small-cell suppression (n<6) protects small Māori communities from re-identification.

### Migrant and refugee communities
Spanish-language support. NOVA explains NZ-specific health resources (NZAF, Burnett Foundation, Body Positive NZ) without assuming prior knowledge. Immigration and visa concerns are addressed under the `Immigration` topic code.

### Rural communities
No clinic required. NOVA is accessible from any device, anywhere in Aotearoa. Rural access barriers are tracked under the `Rural_Access` topic code, generating anonymous signals for telehealth service planning.

---

## Alignment with NZ Health Strategy 2026

| Strategy priority | NOVA alignment |
|-------------------|---------------|
| Equity for Māori | Te Whare Tapa Whā framework · Te reo Māori · Takatāpui support |
| Pacific health equity | Spanish language · Pacific wellbeing model |
| Mental health integration | Crisis protocol · anxiety/depression topic tracking |
| Digital health access | PWA, mobile-first, no account needed |
| Privacy and data sovereignty | Te Mana Raraunga · NZ-only infrastructure |
| Workforce development | Clinical stigma audit signal informs provider training |

---

## Goals 2026–2027

| Goal | Metric | Timeline |
|------|--------|----------|
| 500 unique sessions | Session count (anonymous) | Dec 2026 |
| Crisis protocol activations reviewed monthly | n8n report | Ongoing |
| Te reo Māori response depth expanded | Cultural responsiveness audit | Q3 2026 |
| NZAF partnership exploration | Meeting scheduled | Q4 2026 |
| Sexual health clinic API integration | Pilot with 1 clinic | Q2 2027 |
| Ministry of Health alignment meeting | Formal briefing | Q1 2027 |
| Independent privacy audit | Third-party review | Q4 2026 |
