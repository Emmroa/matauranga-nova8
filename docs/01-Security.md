# Quad-Layer Armor — Arquitectura de Seguridad

> I hangaia a NOVA mai i te rā tuatahi me ngā paparangi whakamarumaru e whā.  
> (NOVA fue construida desde el primer día con cuatro capas de protección.)

← [[00-Overview]] | [[02-Backend]] →

---

## Las 4 Capas

```
Mensaje del usuario
      │
      ▼
┌─────────────────────────────────┐
│  CAPA 1 — PII Scrubbing         │  ← Primero
│  Elimina datos personales       │
└─────────────────────────────────┘
      │ texto limpio
      ▼
┌─────────────────────────────────┐
│  CAPA 2 — Rate Limiting         │  ← Anti-abuso
│  + Anti-DDoS (Slow Down)        │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  CAPA 3 — Zero Data Retention   │  ← Solo contadores
│  Solo topic tags agregados      │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  CAPA 4 — Helmet                │  ← Headers HTTP
│  CSP + HSTS + seguridad HTTP    │
└─────────────────────────────────┘
```

---

## CAPA 1 — PII Scrubbing (`scrubPII`)

Elimina automáticamente datos personales **antes** de cualquier procesamiento:

| Tipo de dato | Patrón detectado | Reemplazado por |
|---|---|---|
| Email | `usuario@dominio.com` | `[EMAIL_REMOVED]` |
| Teléfono NZ | `+64`, `021-xxx-xxxx` | `[PHONE_REMOVED]` |
| IRD (impuestos NZ) | `xx-xxx-xxx` | `[IRD_REMOVED]` |
| NHI (salud NZ) | `ABC1234` | `[NHI_REMOVED]` |
| Tarjeta de crédito | `xxxx-xxxx-xxxx-xxxx` | `[CARD_REMOVED]` |
| Dirección | `123 Main Street` | `[ADDRESS_REMOVED]` |

**Implementación (`index.js:130-138`):**
```js
function scrubPII(text) {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REMOVED]')
    .replace(/\b(?:\+?64|0)[-.\s]?(?:\d[-.\s]?){6,10}\b/g, '[PHONE_REMOVED]')
    .replace(/\b\d{2,3}-\d{3}-\d{3}\b/g, '[IRD_REMOVED]')
    .replace(/\b[A-Z]{3}\d{4}\b/g, '[NHI_REMOVED]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_REMOVED]')
    .replace(/\b\d{1,4}\s+[A-Z][a-z]+\s+(Street|Road|...)\b/gi, '[ADDRESS_REMOVED]')
}
```

---

## CAPA 2 — Rate Limiting + Anti-DDoS

### Chat endpoint (`/chat`)
- **Max:** 15 mensajes por minuto por IP
- **Slow-down:** después de 10 mensajes, delay de 500ms por mensaje adicional
- **Max delay:** 10 segundos

### Stats endpoint (`/stats`)
- **Max:** 30 requests cada 15 minutos
- Requiere header `X-Dashboard-Auth` con contraseña

**Librerías:** `express-rate-limit`, `express-slow-down`

---

## CAPA 3 — Zero Data Retention

**Principio:** El texto de las conversaciones **nunca** se almacena.

Solo se guardan **contadores anónimos**:
```json
{
  "totalSessions": 42,
  "totalMessages": 187,
  "languages": { "en": 120, "es": 45, "mi": 22 },
  "topics": {
    "HIV": 34,
    "PrEP": 18,
    "Anxiety": 12
  },
  "crisisActivations": 3
}
```

- Guardado en `stats.json` cada 30 segundos
- **Nunca** incluye el texto del mensaje
- IDs de sesión son UUID efímeros (invalidados al cerrar)

---

## CAPA 4 — Helmet (HTTP Security Headers)

```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}))
```

**Headers activos:**
- `Content-Security-Policy` — bloquea scripts externos no autorizados
- `Strict-Transport-Security` — fuerza HTTPS por 1 año
- `X-Frame-Options` — previene clickjacking
- `X-Content-Type-Options` — previene MIME sniffing

---

## CORS

Solo permite requests desde:
- `https://matauranga-nova.onrender.com`
- `http://localhost:10000`

Métodos permitidos: `GET`, `POST`  
Headers permitidos: `Content-Type`, `X-Dashboard-Auth`

---

## Protección del Dashboard

```
GET /stats
  └── Requiere header: X-Dashboard-Auth: <DASHBOARD_PASSWORD>
  └── Variable de entorno: DASHBOARD_PASSWORD (default: 'burnett2026')
  └── Rate limited: 30 req / 15 min
  └── Error 401 si contraseña incorrecta
```
