#!/bin/bash
# Start Pip on this machine: brain on :9100, gateway on :8080.
# No Postgres, no Brave. The desktop tools use the in-memory fake driver.
# Unit tests and integration tests run first. PIP_SKIP_TESTS=1 skips that gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${PIP_LOCAL_DIR:-$HOME/.pip-local}"
mkdir -p "$DATA/work" "$DATA/config"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export PIP_WORK_ROOT="$DATA/work"
export PIP_VAULT_PATH="$DATA/vault.json"
export PIP_VAULT_KEY_FILE="$DATA/vault.key"
export PIP_VAULT_ALLOW_CREATE=1
export PIP_JOBS_PATH="$DATA/jobs.sqlite"
export PIP_MODEL_CONFIG="$DATA/config/model.json"
export PIP_DESKTOP_DRIVER="${PIP_DESKTOP_DRIVER:-fake}"
export BRAIN_URL="${BRAIN_URL:-http://127.0.0.1:9100}"
export PORT="${PORT:-8080}"
export API_TOKEN="${API_TOKEN:-kiwi_secret_token_dev}"
unset DATABASE_URL

if [ "${PIP_SKIP_TESTS:-}" != "1" ]; then
  "$ROOT/scripts/test-pip.sh"
fi

cd "$ROOT"
echo "Building gateway..."
go build -o "$ROOT/services/gateway/kiwi-gateway" ./services/gateway

echo "Pip data: $DATA"
echo "Brain:    http://127.0.0.1:9100/health"
echo "Gateway:  http://127.0.0.1:${PORT}/health"
echo "Chat:     POST http://127.0.0.1:${PORT}/api/secure/chat"
echo "Desktop driver: $PIP_DESKTOP_DRIVER"
echo
echo "Leave this running. In another terminal, the phone UI is:"
echo "  cd $ROOT/apps/mobile && npm install && npm run dev"
echo "Then open http://127.0.0.1:3000/chat"

python3 -m uvicorn api.server:app --app-dir "$ROOT/services/orchestrator" --host 127.0.0.1 --port 9100 &
BRAIN_PID=$!
GATEWAY_PID=""
trap 'kill $BRAIN_PID ${GATEWAY_PID:-} 2>/dev/null || true' EXIT

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf http://127.0.0.1:9100/health >/dev/null; then
    break
  fi
  sleep 0.5
done

"$ROOT/services/gateway/kiwi-gateway" &
GATEWAY_PID=$!

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 0.3
done

echo
curl -s "http://127.0.0.1:${PORT}/health" || true
echo
echo "Pip is up. Ctrl-C stops both."
wait
