# Sistema de Detección de Temas

← [[02-Backend]] | [[04-7-Moments]] →

---

## Principio

La detección de temas ocurre **localmente** mediante expresiones regulares.  
**Ningún texto es enviado a servicios externos para el análisis.**

```
texto scrubbeado
      │
      ▼
TOPIC_PATTERNS (30 regexes)
      │
      ▼
Array de topics detectados: ["HIV", "Anxiety", "PrEP"]
      │
      ▼
stats.topics.HIV++ (solo el contador)
```

---

## Los 30 Temas

### Categoría: VIH y Tratamiento

| Topic key | Qué detecta | Ejemplos |
|---|---|---|
| `HIV` | VIH/SIDA | vih, hiv, seropositiv, aids, sida |
| `New_Diagnosis` | Diagnóstico reciente | "just found out", "me acabo de enterar" |
| `UeqU` | Indetectable = Intransmisible | u=u, undetectable, indetectable |
| `Long_Term_Living` | Vivir con VIH a largo plazo | "living with hiv for", "años con vih" |
| `ART_Medication` | Medicación antirretroviral | art, antiretroviral, biktarvy, tenofovir |

---

### Categoría: Prevención

| Topic key | Qué detecta | Ejemplos |
|---|---|---|
| `PrEP` | PrEP | prep, pre-exposure prophylaxis |
| `PEP` | PEP (urgente, 72h) | pep, post-exposure, 72 hours |
| `DoxyPEP` | DoxyPEP | doxypep, doxycycline, doxiciclina |
| `STI_Testing` | Test de ITS | sti test, full screen, sexual health check |

---

### Categoría: ITS

| Topic key | Qué detecta |
|---|---|
| `Syphilis` | syphilis, sífilis, treponema |
| `Chlamydia` | chlamydia, clamidia |
| `Gonorrhoea` | gonorrhoea, gonorrhea, gonorrea |

---

### Categoría: Salud Mental y Crisis

| Topic key | Qué detecta | Nivel |
|---|---|---|
| `Suicide_Ideation` | Ideación suicida | 🔴 CRISIS |
| `Self_Harm` | Autolesión | 🔴 CRISIS |
| `Crisis_Acute` | Crisis aguda | 🔴 CRISIS |
| `Anxiety` | Ansiedad, pánico | ⚠️ |
| `Depression` | Depresión | ⚠️ |
| `Loneliness` | Soledad, aislamiento | ⚠️ |

**Triggers de crisis:** Cualquiera de `Suicide_Ideation`, `Self_Harm`, `Crisis_Acute` activa el protocolo de crisis → Lifeline / 1737 / 111.

---

### Categoría: Estigma y Discriminación

| Topic key | Qué detecta |
|---|---|
| `Internal_Stigma` | Vergüenza, odio hacia uno mismo |
| `External_Discrimination` | Discriminación externa, rechazo |
| `Bullying` | Acoso, bullying |
| `Online_Hate` | Odio online, ciberacoso |
| `Workplace_Discrimination` | Discriminación laboral |
| `Medical_Discrimination` | Discriminación médica |

---

### Categoría: Identidad y Comunidad

| Topic key | Qué detecta |
|---|---|
| `LGBTQIA_Takatapui` | gay, lesbian, trans, queer, takatāpui, rainbow |
| `Disclosure` | Revelar el diagnóstico a alguien |
| `Whanau_Family` | Whānau, familia, padres, hermanos |

---

### Categoría: Servicios Sociales NZ

| Topic key | Qué detecta |
|---|---|
| `WINZ` | Work and Income NZ, beneficio, jobseeker |
| `Housing_Council` | Kāinga Ora, vivienda, homeless |
| `Legal_Rights` | Human Rights Act, abogado, HRC |
| `Immigration` | Visado, residencia, trabajo migrante |

---

## Detección de Idioma

```js
function detectLanguage(text) {
  // Te reo Māori
  if (/tēnā koe|kia ora|whānau|aroha|hauora|māori/i.test(text)) return 'mi'
  // Español
  if (/hola|gracias|cómo|estás|qué|tengo|soy/i.test(text)) return 'es'
  // Default
  return 'en'
}
```

**Idiomas soportados:** Inglés (`en`), Español (`es`), Te reo Māori (`mi`)

---

## Logging seguro

El log del servidor **nunca incluye el texto del mensaje**:

```
📊 Session | Lang: es | Topics: [HIV, PrEP]
```

Solo idioma detectado y temas — nunca el contenido.
