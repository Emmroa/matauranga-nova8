# Roadmap — Objetivos Futuros

← [[05-Frontend]] | [[00-Overview]] →

---

## Estado Actual: Demo / Prototipo

```
Plataforma:   Render.com (hosting gratuito)
IA:           Claude Sonnet 4.5 (limitada por cuota API en demo)
Base datos:   stats.json (archivo plano)
IA offline:   Demo replies (respuestas predefinidas)
```

---

## Mes 1 — Infraestructura

### Migración a Catalyst Cloud (NZ)
- Soberanía de datos en Nueva Zelanda
- Cumplimiento del NZ Privacy Act 2020
- Residencia de datos verificada en NZ

### IA Self-hosted: Ollama + Llama 3.3 70B
```
Render.com → Catalyst Cloud NZ
  └── Ollama (self-hosted)
        └── Llama 3.3 70B
              ├── Zero external API calls
              ├── Fine-tuning en patrones de conversación de NOVA
              └── Fallback a Claude API para casos complejos
```

**Ventajas:**
- Sin costo por llamada de API
- Sin dependencia de proveedor externo
- Fine-tuning posible con datos anonimizados de NOVA

### Base de datos
```
stats.json → PostgreSQL
  ├── Analytics históricas (por mes)
  ├── Mejor rendimiento bajo carga
  └── Backup automático
```

### Load testing
- Target: 1000 usuarios concurrentes
- Pentesting profesional
- Auditoría de seguridad

---

## Mes 1-2 — Co-diseño Comunitario

### Talleres
- 4-6 sesiones en Auckland, Wellington, Christchurch
- Participantes: personas viviendo con VIH, trabajadores de salud māori, líderes comunitarios Pacific

### Revisiones necesarias
- [ ] Revisión lingüística en te reo Māori
- [ ] Auditoría de seguridad cultural
- [ ] Privacy Impact Assessment (PIA) con input comunitario
- [ ] Refinamiento del system prompt basado en experiencia vivida

---

## Mes 2 — Compliance Legal

- [ ] Privacy Impact Assessment (PIA) completo
- [ ] Documentación de cumplimiento NZ Privacy Act 2020
- [ ] Revisión de alineación con Te Tiriti o Waitangi
- [ ] Terms of Service + Privacy Policy finales
- [ ] Aprobación de gobernanza Burnett Foundation

---

## Mes 2 — Beta Launch

### Rollout controlado
- 50-100 usuarios beta (clientes Burnett Foundation, opt-in, con consentimiento)
- Widget embebido en burnettfoundation.org.nz
- Monitoreo de activaciones de crisis en tiempo real

### Widget embed (producción)
```html
<script
  src="https://nova.burnettfoundation.org.nz/nova-widget.js"
  data-lang="auto"
  data-consent="true"
  data-analytics="true">
</script>
```

---

## Arquitectura de Producción (objetivo)

```
Usuario
  │
  ▼
NOVA Widget (cualquier sitio web)
  │  HTTPS
  ▼
Catalyst Cloud NZ
  ├── Load Balancer
  ├── NOVA Express Server
  │     ├── Quad-Layer Armor (mismo de demo)
  │     ├── PII Scrubbing
  │     └── Topic Detection
  │           │
  │           ▼
  │     Ollama (self-hosted)
  │           └── Llama 3.3 70B (fine-tuned)
  │                 └── Fallback: Claude API
  │
  └── PostgreSQL
        ├── analytics (agregadas, anónimas)
        └── crisis_log (timestamps, nunca texto)
```

---

## Comparación Demo vs Producción

| Aspecto | Demo (actual) | Producción |
|---|---|---|
| Hosting | Render.com (US) | Catalyst Cloud (NZ) |
| IA | Claude API (limitada) | Ollama + Llama 3.3 70B |
| Base de datos | `stats.json` | PostgreSQL |
| Costo IA | ~$0.003/mensaje | ~$0 (self-hosted) |
| Soberanía de datos | ❌ Servers en EEUU | ✅ Servidores en NZ |
| Fine-tuning | ❌ | ✅ En patrones NOVA |
| Capacidad | ~100 users/día | 1000+ concurrentes |
| Compliance PIA | Parcial | Completo |

---

## V2 — Ideas post-beta

- Widget flotante embebible (JavaScript + iframe)
- Integración con calendario de Burnett Foundation (turnos)
- Notificaciones push para recordatorio de PrEP
- Dashboard extendido con datos mensuales históricos
- API para clínicas asociadas (con autenticación OAuth)
