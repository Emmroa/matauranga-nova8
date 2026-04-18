# Backend — Express Server

← [[01-Security]] | [[03-Topics]] →

---

## Stack

| Componente | Librería | Versión |
|---|---|---|
| Servidor web | `express` | ^4.19.2 |
| Variables de entorno | `dotenv` | ^16.4.5 |
| Seguridad HTTP | `helmet` | ^7.1.0 |
| CORS | `cors` | ^2.8.5 |
| Rate limiting | `express-rate-limit` | ^7.4.0 |
| Slow-down anti-DDoS | `express-slow-down` | ^2.0.3 |

**Node.js requerido:** `>=18.0.0`  
**Puerto:** `process.env.PORT || 10000`

---

## Endpoints

### `POST /chat`

El endpoint principal del compañero NOVA.

**Request:**
```json
{
  "message": "Hola, quiero saber sobre PrEP"
}
```

**Flujo interno:**
```
1. Validar mensaje (existe, es string, max 2000 chars)
2. scrubPII(message) → elimina datos personales
3. extractTopics(scrubbed) → detecta temas [ver 03-Topics]
4. detectLanguage(scrubbed) → 'en' | 'es' | 'mi'
5. Actualizar stats (solo contadores, nunca el texto)
6. Detectar crisis → incrementar crisisActivations si aplica
7. selectDemoReply(topics) → seleccionar respuesta
8. Responder { reply: "..." }
```

**Response:**
```json
{
  "reply": "Kia ora. Este es un prototipo..."
}
```

**Errores:**
- `400` — mensaje vacío o > 2000 chars
- `500` — error interno

---

### `POST /session-start`

Registra el inicio de una nueva sesión.

```json
// Response
{
  "status": "ok",
  "sessionId": "sid_abc123"
}
```

Incrementa `stats.totalSessions` y `stats.monthSessions`.

---

### `GET /stats`

Dashboard analytics protegido.

**Requiere:** `X-Dashboard-Auth: <password>`

**Response:** objeto `stats` completo (ver estructura abajo).

---

### `GET /health`

Health check público — sin datos sensibles.

```json
{
  "status": "ok",
  "mode": "demo",
  "uptime": 3600,
  "totalSessions": 42,
  "totalMessages": 187,
  "topicsTracked": 30,
  "layers": {
    "layer1_piiScrub": "active",
    "layer2_rateLimit": "active",
    "layer3_zeroRetention": "active",
    "layer4_helmetCompliance": "active"
  }
}
```

---

### `GET /`

Sirve `index.html` (landing page).

---

## Estructura de Stats

```js
{
  totalSessions: 0,
  monthSessions: 0,
  totalMessages: 0,
  firstSessionDate: null,   // ISO string
  lastSessionDate: null,    // ISO string
  languages: {
    en: 0,
    es: 0,
    mi: 0
  },
  topics: {
    // 30 temas — ver 03-Topics
    HIV: 0, New_Diagnosis: 0, PrEP: 0, PEP: 0, DoxyPEP: 0, UeqU: 0,
    Syphilis: 0, Chlamydia: 0, Gonorrhoea: 0, STI_Testing: 0,
    Long_Term_Living: 0, ART_Medication: 0,
    Suicide_Ideation: 0, Self_Harm: 0, Crisis_Acute: 0,
    Anxiety: 0, Depression: 0, Loneliness: 0,
    Internal_Stigma: 0, External_Discrimination: 0, Bullying: 0,
    Online_Hate: 0, Workplace_Discrimination: 0, Medical_Discrimination: 0,
    LGBTQIA_Takatapui: 0, Disclosure: 0, Whanau_Family: 0,
    WINZ: 0, Housing_Council: 0, Legal_Rights: 0, Immigration: 0
  },
  crisisActivations: 0,
  crisisActivationsMonth: 0
}
```

---

## Persistencia de Stats

- Guardado en: `stats.json` (misma carpeta del proyecto)
- Auto-guardado: cada **30 segundos** (`setInterval(saveStats, 30000)`)
- Al apagar el servidor: `SIGTERM` y `SIGINT` disparan `saveStats()` antes de salir
- Al arrancar: `loadStats()` lee el archivo existente y hace merge con `INITIAL_STATS`

---

## Respuestas Demo

En modo demo (sin API key activa), NOVA usa respuestas predefinidas según los temas detectados:

| Condición | Respuesta |
|---|---|
| `Suicide_Ideation` \| `Self_Harm` \| `Crisis_Acute` | Crisis: Lifeline 0800 543 354 + 1737 + 111 |
| `New_Diagnosis` | Apoyo para nuevo diagnóstico |
| `PrEP` \| `PEP` \| `DoxyPEP` | Información de prevención + Burnett Foundation |
| `Internal_Stigma` \| `External_Discrimination` \| `Bullying` | Validación + Human Rights Act 1993 |
| (ningún tema) | Mensaje general del prototipo |

---

## Variables de Entorno

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `10000` |
| `DASHBOARD_PASSWORD` | Contraseña del dashboard | `burnett2026` |
| `GOOGLE_API_KEY` | Clave Gemini API (futuro) | — |
