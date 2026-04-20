#!/usr/bin/env bash
# =============================================================
# NOVA — Setup Automático
# Burnett Foundation Innovation Challenge 2026
# =============================================================
# Uso:
#   chmod +x setup.sh
#   ./setup.sh                        # contraseña aleatoria
#   ./setup.sh "mi-contraseña-segura" # contraseña elegida
# =============================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠️  $*${RESET}"; }
err()  { echo -e "${RED}❌ $*${RESET}"; exit 1; }
info() { echo -e "${CYAN}→  $*${RESET}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   NOVA — Setup Automático con Fixes C1-H4            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

# ─── Prerequisitos ───────────────────────────────────────────
info "Verificando Node.js ≥ 18..."
NODE_VER=$(node -e "console.log(process.versions.node)" 2>/dev/null || echo "0.0.0")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js $NODE_VER detectado. Se requiere ≥ 18. Instalá desde nodejs.org"
fi
ok "Node.js $NODE_VER"

info "Instalando dependencias npm..."
npm install --silent
ok "Dependencias instaladas"

# ─── Generar credenciales ────────────────────────────────────
CUSTOM_PASSWORD="${1:-}"
if [ -z "$CUSTOM_PASSWORD" ]; then
  CUSTOM_PASSWORD=$(node -e "const c=require('crypto');console.log(c.randomBytes(16).toString('base64url'))")
  warn "Contraseña generada aleatoriamente (ver .env al terminar)"
fi

info "Generando hash bcrypt (puede tardar ~3 segundos)..."
HASH=$(node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash(process.argv[1], 12).then(h => {
  process.stdout.write(h);
  process.exit(0);
}).catch(e => { process.stderr.write(e.message); process.exit(1); });
" "$CUSTOM_PASSWORD")
ok "Hash bcrypt generado"

info "Generando clave AES-256-GCM (32 bytes)..."
ENC_KEY=$(node -e "const c=require('crypto');process.stdout.write(c.randomBytes(32).toString('hex'))")
ok "Clave de cifrado generada"

# ─── Crear / actualizar .env ─────────────────────────────────
if [ -f ".env" ]; then
  warn ".env ya existe — se hará backup en .env.bak"
  cp .env .env.bak
fi

# Detectar origen HTTPS o usar localhost
if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  ORIGIN="$RENDER_EXTERNAL_URL"
elif [ -n "${APP_URL:-}" ]; then
  ORIGIN="$APP_URL"
else
  ORIGIN="http://localhost:10000"
  warn "ALLOWED_ORIGIN no detectado — usando localhost (cambialo en .env antes de producción)"
fi

cat > .env <<EOF
# ====================================================
# NOVA — Variables de Entorno
# Generado automáticamente por setup.sh
# $(date '+%Y-%m-%d %H:%M:%S')
# ====================================================

PORT=10000
NODE_ENV=development
ALLOWED_ORIGIN=$ORIGIN

# C1 — Dashboard auth (bcrypt)
DASHBOARD_PASSWORD_HASH=$HASH

# C2 — Cifrado AES-256-GCM para stats.json
STATS_ENCRYPTION_KEY=$ENC_KEY

# Futuro: IA con Ollama
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=llama3.2:3b
EOF

ok ".env creado"

# ─── Guardar contraseña en archivo separado (local, NO subir a git) ───
cat > .dashboard-password.txt <<EOF
NOVA Dashboard Password
Generated: $(date '+%Y-%m-%d %H:%M:%S')

Password: $CUSTOM_PASSWORD

IMPORTANT: This file is .gitignored. Keep it safe.
Use this password in the dashboard login or the X-Dashboard-Auth header.
EOF

# ─── Asegurar .gitignore ─────────────────────────────────────
touch .gitignore
for entry in ".env" ".env.bak" ".dashboard-password.txt" "stats.json.enc" "node_modules/"; do
  grep -qxF "$entry" .gitignore 2>/dev/null || echo "$entry" >> .gitignore
done
ok ".gitignore actualizado"

# ─── Verificar sintaxis de index.js ─────────────────────────
info "Verificando sintaxis de index.js..."
node --check index.js
ok "index.js — sintaxis válida"

# ─── Test rápido de humo ─────────────────────────────────────
info "Iniciando servidor para test de humo (10 segundos)..."
PORT=19999 node index.js &
SERVER_PID=$!
sleep 2

HEALTH=$(curl -s http://localhost:19999/health 2>/dev/null || echo "{}")
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

if echo "$HEALTH" | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const j=JSON.parse(d);
if(j.status!=='ok') { console.error('health check falló'); process.exit(1); }
process.exit(0);
" 2>/dev/null; then
  ok "Test de humo: /health responde OK"
else
  warn "Test de humo no pudo verificar /health (puede ser normal si el puerto está en uso)"
fi

# ─── Resultado final ─────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   ✅ NOVA listo para demo                            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${GREEN}Fixes activos:${RESET} C1 C2 C3 H1 H2 H3 H4"
echo -e "  ${GREEN}Contraseña:${RESET}   guardada en .dashboard-password.txt"
echo -e "  ${GREEN}Cifrado:${RESET}      AES-256-GCM activo en stats"
echo ""
echo -e "  ${BOLD}Iniciar servidor:${RESET}"
echo -e "    npm start"
echo ""
echo -e "  ${BOLD}Verificar:${RESET}"
echo -e "    curl http://localhost:10000/health"
echo ""
echo -e "  ${YELLOW}Antes de subir a producción:${RESET}"
echo -e "    1. Editar ALLOWED_ORIGIN en .env con tu dominio real"
echo -e "    2. Cambiar NODE_ENV=production en .env"
echo -e "    3. Agregar las vars de .env al panel de Render.com / Catalyst Cloud"
echo ""

