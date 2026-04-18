# Frontend — Interfaz de Usuario

← [[04-7-Moments]] | [[06-Roadmap]] →

---

## Dos páginas

| Archivo | URL | Descripción |
|---|---|---|
| `index.html` | `/` | Landing page + chat público |
| `dashboard.html` | `/dashboard.html` | Analytics protegido con contraseña |

---

## index.html — Landing Page

### Paleta de colores
```css
--bg:     #040c07   /* Fondo principal (verde muy oscuro) */
--txt:    #f0ead4   /* Texto principal (crema) */
--gold:   #c9973a   /* Dorado — acento principal */
--goldl:  #e8b84b   /* Dorado claro (hover) */
--em:     #2dd4a7   /* Verde teal — énfasis */
--dim:    #8a9880   /* Texto secundario */
```

### Tipografías
- **Cormorant Garamond** — títulos, serif elegante
- **Sora** — cuerpo de texto, sans-serif moderna
- **DM Mono** — código, tags, etiquetas técnicas

### Secciones (en orden)

```
nav          → Navegación fija con menú hamburguesa (mobile)
#home        → Hero con partículas neurales animadas
#how-it-works → Qué hace / qué no hace NOVA
#about       → Las 3 características principales
#chat        → Widget de chat en vivo
             → Preview del dashboard
#mom-sec     → Los 7 Momentos
             → Configuración AI (Claude Sonnet 4.5)
#armor-sec   → Quad-Layer Armor (visual)
#privacy     → Privacy + Compliance checklist
#culture     → Te Whare Tapa Whā
#future      → Timeline de objetivos futuros
#install     → Cómo embeber NOVA en otro sitio
             → CTA con stats animadas
             → Disclaimer
footer       → Links y recursos de crisis
```

### Fondo neural animado (`canvas#neural-bg`)
- 80 partículas flotantes
- Conexiones entre partículas cercanas (< 150px)
- Interacción con el mouse
- Colores: dorado `rgba(201,151,58,0.4)` y teal `rgba(45,212,167,0.15)`

### Chat en tiempo real (JavaScript)
```js
// Endpoint
POST /chat { message, sessionId }

// Flujo
1. POST /session-start al cargar la página
2. Usuario escribe → Enter o botón →
3. Mostrar mensaje usuario (dorado)
4. Mostrar indicador typing (tres puntos pulsantes)
5. Fetch /chat → mostrar respuesta NOVA
6. Si error → mostrar mensaje con Lifeline
```

---

## dashboard.html — Analytics Dashboard

### Acceso
- Login con contraseña → verifica contra `GET /stats`
- Contraseña guardada en `sessionStorage` (no persiste entre pestañas)

### Sidebar (navegación)
```
Overview
  ├── Dashboard (KPIs)
  └── 30 Topics (gráfico completo)
Categories
  ├── HIV & Prevention
  ├── Mental Health
  ├── Stigma
  └── Social Services
Demographics
  ├── Languages
  └── Crisis
```

### KPIs principales
| KPI | Color | Fuente |
|---|---|---|
| Total Sessions | Teal | `stats.totalSessions` |
| Messages | Verde | `stats.totalMessages` |
| Topics Tracked | Dorado | `Object.keys(stats.topics).length` |
| Crisis Activations | Rojo | `stats.crisisActivations` |

### Gráficos (Chart.js 4.4.0)

| Canvas ID | Tipo | Datos |
|---|---|---|
| `cAll` | Bar horizontal | Los 30 topics |
| `cHiv` | Bar | HIV, Diagnosis, U=U, Long-term, ART |
| `cPrev` | Bar | PrEP, PEP, DoxyPEP, STI Testing |
| `cSti` | Doughnut | Syphilis, Chlamydia, Gonorrhoea |
| `cMent` | Bar | Anxiety, Depression, Loneliness, Crisis... |
| `cStig` | Bar horizontal | 6 tipos de estigma/discriminación |
| `cSoc` | Bar | WINZ, Housing, Legal, Immigration |
| `cLang` | Doughnut | EN, ES, MI |
| `cId` | Bar | LGBTQIA+, Disclosure, Whānau |

### Internacionalización (I18N)
- Idiomas: Inglés (`en`) y Te reo Māori (`mi`)
- Guardado en `localStorage('novaLang')`
- Todas las etiquetas tienen atributo `data-k` para traducción

### Chat de datos integrado
- Botón flotante (FAB) en esquina inferior derecha
- Responde preguntas sobre los datos del dashboard
- 5 quick questions predefinidas:
  - Top 5 topics
  - Crisis summary
  - Languages
  - Stigma
  - HIV stats

### Exportación
- **CSV:** descarga `nova-YYYY-MM-DD.csv`
- **JSON:** descarga `nova-YYYY-MM-DD.json`
- Auto-refresh de datos: cada **30 segundos**

---

## Responsive Breakpoints

| Breakpoint | Cambios |
|---|---|
| `≤ 1200px` | Sidebar estrecho, grillas a 2 cols |
| `≤ 960px` | Sidebar como drawer, menú hamburguesa |
| `≤ 640px` | Una columna, botones full-width |
| `≤ 380px` | Ajustes de font-size mínimos |
| Landscape ≤ 500px | Hero sin altura mínima |
