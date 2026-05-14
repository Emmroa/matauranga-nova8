# Contributing to Mātauranga NOVA

Nau mai, haere mai. Thank you for your interest in contributing.

NOVA is a health tool used by people navigating HIV stigma, crisis, and disclosure. Every line of code affects real people in vulnerable moments. Please read this guide fully before submitting a pull request.

---

## Cultural Context

### Te Tiriti o Waitangi

NOVA operates in Aotearoa New Zealand and is committed to the principles of Te Tiriti:
- **Tino rangatiratanga** — Māori communities have authority over their own health data and narratives
- **Partnership** — contributions that touch te reo Māori content must be reviewed by a fluent speaker
- **Active protection** — we actively protect against re-identification and surveillance

### Te Whare Tapa Whā (Sir Mason Durie)

NOVA's design is informed by this holistic Māori model of health:

| Dimension | Application in NOVA |
|-----------|---------------------|
| **Taha tinana** (physical) | PrEP, ART, STI testing topics |
| **Taha hinengaro** (mental) | Crisis detection, anxiety, depression topics |
| **Taha wairua** (spiritual) | Non-judgmental, identity-affirming language |
| **Taha whānau** (family/social) | Disclosure, whānau support, loneliness topics |

Changes that touch topic detection, language, or crisis response must be considered through this lens.

---

## Getting Started Locally

### 1. Clone

```bash
git clone git@github.com:Emmroa/matauranga-nova8.git
cd matauranga-nova8
```

### 2. Install Ollama and pull the model

```bash
# Install Ollama: https://ollama.ai
ollama pull phi3:mini
```

### 3. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set SESSION_SECRET (32 random bytes) and ADMIN_PASSWORD
npm install
node server.js
# → http://localhost:10000
```

Generate a secure `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/` to `http://localhost:10000` automatically.

### 5. Verify

```bash
curl http://localhost:10000/api/health
# {"ok":true,"ollamaUp":true,"modelLoaded":true,"breakerOpen":false}
```

---

## Project Structure

```
matauranga-nova-v2/
├── backend/
│   ├── server.js          # Express app — all routes, middleware, PII scrubbing
│   ├── database.js        # SQLite store — analytics only, ZDR enforced
│   ├── data/
│   │   ├── analytics.db   # SQLite — never commit
│   │   └── actions.json   # Institutional action states
│   └── .env.example       # Template — copy to .env, never commit .env
├── frontend/
│   ├── src/
│   │   ├── main.jsx       # React entry point
│   │   ├── App.jsx        # Router
│   │   ├── Chat.jsx       # Main chat UI + SSE consumer
│   │   ├── shared/
│   │   │   └── nova.js    # NeuralCanvas · i18n UI strings · consent helpers
│   │   └── components/
│   │       └── Dashboard.jsx  # 7-tab analytics dashboard
│   ├── public/
│   │   ├── manifest.json  # PWA manifest
│   │   ├── sw.js          # Service worker
│   │   └── icons/         # Koru PWA icons (192/512/maskable)
│   └── index.html
├── ecosystem.config.js    # PM2 config — source of truth for env vars
├── README.md
├── SECURITY.md
└── CONTRIBUTING.md
```

---

## Non-Negotiable Rules

These rules exist to protect users. PRs that violate them will not be merged regardless of other quality.

### 1. Never break Zero Data Retention

```
✘ DO NOT log req.body.message at any level
✘ DO NOT store message content in SQLite or any file
✘ DO NOT add analytics that capture user text
✘ DO NOT pass raw session IDs to the database
✘ DO NOT add third-party scripts (analytics, tracking pixels)
✔ Only store: region_code · topic_code · language · timestamp_hour · crisis_flag
```

If you add a new database column, ask: *can this column be used to re-identify a user?* If yes, don't add it.

### 2. PII scrubbing must run before any external call

`scrubPII()` in `server.js` must be called on all user-supplied text before it reaches Ollama, the topic extractor, or any log. If you add a new NZ-specific PII pattern, add it to both the regex and the counter in `piiCounters`.

### 3. Admin endpoints must use `requireAdmin`

Every new `/api/admin/*` route must pass through the `requireAdmin` middleware. No exceptions.

### 4. Input validation on all new endpoints

Use allowlists (not denylists) for key validation. See `ALLOWED_ACTION_KEYS` and `ALLOWED_STATUSES` in `server.js` as the pattern to follow.

### 5. No new external dependencies without discussion

Every new npm dependency increases the attack surface. Open an issue before adding packages, especially in the backend.

---

## Code Style

- **Backend:** ESM (`import`/`export`), no TypeScript, no bundler
- **Frontend:** React functional components, hooks only, no class components
- **No JSX in `.js` files** — use `React.createElement` (see `nova.js`) or rename to `.jsx`
- **No comments explaining what code does** — use clear names instead
- **Comments only for non-obvious WHY** — hidden constraints, security invariants, workarounds
- **No TypeScript** — the project intentionally avoids build-time complexity in the backend
- **Design tokens** — use the `C` object in `Dashboard.jsx` for all colours; teal `#0d9960`, gold `#c8941a`, bg `#010d03`

---

## Making a Pull Request

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes following the rules above
3. Run a build to catch frontend errors: `cd frontend && npm run build`
4. Verify the backend starts cleanly: `node backend/server.js`
5. Smoke test the health endpoint: `curl http://localhost:10000/api/health`
6. If you touched crisis detection, test with a crisis message and verify 1737 / Lifeline resources appear
7. Commit with a conventional commit message:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `refactor:` no behaviour change
   - `security:` security improvement
8. Open a PR with a clear description of what changed and why

---

## Sensitive Areas — Extra Care Required

| Area | Why |
|------|-----|
| `scrubPII()` | Regex changes can accidentally miss PII patterns |
| `TOPIC_PATTERNS` | Affects crisis detection — false negatives are dangerous |
| `CRISIS_TOPICS` set | Determines when 1737/Lifeline is surfaced |
| Te Reo Māori strings in `nova.js` | Must be reviewed by a fluent speaker |
| `requireAdmin` middleware | Auth bypass could expose user analytics |
| `recordEventsBatch` in `database.js` | ZDR boundary — no message content crosses here |

---

## Languages and Translations

NOVA supports English (`en`), Te Reo Māori (`mi`), and Español (`es`). UI strings live in the `UI` object in `frontend/src/shared/nova.js`. Topic detection patterns in `server.js` include patterns for all three languages.

If you add or modify te reo Māori content, please get a review from a fluent te reo Māori speaker before merging. Incorrect or culturally inappropriate kupu in a health context can cause harm.

---

## Questions

Open a GitHub issue tagged `question` or email: emanuel.figueroa.alejandro@gmail.com

Ngā mihi.
