# Mātauranga NOVA — Arquitectura General

> He hoa kōrero mō te HIV i Aotearoa  
> Burnett Foundation Innovation Challenge 2026  
> Autor: Emanuel Figueroa

---

## ¿Qué es NOVA?

NOVA es un compañero digital para personas que navegan el VIH en Aotearoa Nueva Zelanda. No es un médico ni un terapeuta — es un acompañante cálido, sin juicio, disponible en cualquier momento.

**Stack tecnológico:**
- **Backend:** Node.js + Express
- **IA:** Claude Sonnet 4.5 (demo usa respuestas locales)
- **Seguridad:** Quad-Layer Armor (ver [[01-Security]])
- **Deploy:** Render.com → futuro: Catalyst Cloud NZ

---

## Diagrama de alto nivel

```
Usuario
  │
  ▼
index.html (frontend)
  │  POST /chat
  ▼
index.js (Express backend)
  ├── [CAPA 1] PII Scrubbing
  ├── [CAPA 2] Rate Limiting + Anti-DDoS
  ├── [CAPA 3] Zero Data Retention (stats.json)
  └── [CAPA 4] Helmet (HTTP security headers)
        │
        ├── Topic Extraction (local regex — 30 topics)
        ├── Language Detection (EN / ES / MI)
        ├── Crisis Detection → Lifeline / 1737 / 111
        └── Demo Reply (sin IA externa en modo demo)

dashboard.html
  │  GET /stats (X-Dashboard-Auth header)
  ▼
Analytics anónimas agregadas
```

---

## Archivos del proyecto

| Archivo | Descripción |
|---------|-------------|
| `index.js` | Backend Express — toda la lógica del servidor |
| `index.html` | Landing page + chat de usuario |
| `dashboard.html` | Dashboard de analytics protegido con contraseña |
| `package.json` | Dependencias Node.js |
| `stats.json` | Persistencia de estadísticas (generado en runtime) |

---

## Navegación de la arquitectura

- [[01-Security]] — Quad-Layer Armor
- [[02-Backend]] — Endpoints y lógica del servidor
- [[03-Topics]] — Sistema de detección de temas (30 topics)
- [[04-7-Moments]] — Los 7 Momentos de intervención
- [[05-Frontend]] — UI: landing page y dashboard
- [[06-Roadmap]] — Objetivos futuros y migración a producción
