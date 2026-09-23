#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# Kiwi AI System — Master End-to-End Acceptance Test Runner
# Verifies:
# 1. Host Toolchain & PM2 Process Supervision
# 2. Go ↔ Python Bridge (POST /api/secure/chat)
# 3. Streaming & WebSockets (GET /api/secure/ws)
# 4. Mobile App MVP / PWA (Static assets, DOM, simulated browser client)
# 5. Unit & Regression Test Suites (Go & Python)
# ==============================================================================

ROOT_DIR="/root/kiwi"
GATEWAY_URL="http://127.0.0.1:8080"
GATEWAY_WS="ws://127.0.0.1:8080/api/secure/ws"
BRAIN_URL="http://127.0.0.1:9100"
API_TOKEN="${API_TOKEN:-kiwi_secret_token_dev}"
PYTHON_BIN="${ROOT_DIR}/services/orchestrator/.venv/bin/python"
PYTEST_BIN="${ROOT_DIR}/services/orchestrator/.venv/bin/pytest"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; pass_count=$((pass_count + 1)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; fail_count=$((fail_count + 1)); }
log_stage() {
  echo ""
  echo -e "${YELLOW}================================================================${NC}"
  echo -e "${YELLOW} $1 ${NC}"
  echo -e "${YELLOW}================================================================${NC}"
}

# --- STAGE 1: PM2 Dual Process Supervision ---
log_stage "STAGE 1: PM2 Process Supervision & Health Checks"

if pm2 status | grep -q "kiwi-gateway.*online"; then
  log_pass "PM2 service 'kiwi-gateway' is ONLINE"
else
  log_fail "PM2 service 'kiwi-gateway' is NOT online"
fi

if pm2 status | grep -q "kiwi-brain.*online"; then
  log_pass "PM2 service 'kiwi-brain' is ONLINE"
else
  log_fail "PM2 service 'kiwi-brain' is NOT online"
fi

# Health endpoints
gateway_health=$(curl -s "${GATEWAY_URL}/health" || true)
if echo "$gateway_health" | grep -q '"brain":"connected"'; then
  log_pass "Gateway /health probe: Gateway running and Brain connected"
else
  log_fail "Gateway /health probe failed: $gateway_health"
fi

brain_health=$(curl -s "${BRAIN_URL}/health" || true)
if echo "$brain_health" | grep -q '"service":"kiwi-brain"'; then
  log_pass "Brain /health probe: Python brain active"
else
  log_fail "Brain /health probe failed: $brain_health"
fi

# --- STAGE 2: Go ↔ Python Bridge Verification ---
log_stage "STAGE 2: Go ↔ Python HTTP Chat Bridge Verification"

# 2a: Unauthenticated check
unauth_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${GATEWAY_URL}/api/secure/chat" \
  -H "Content-Type: application/json" -d '{"message":"hello"}')
if [ "$unauth_code" -eq 401 ]; then
  log_pass "Unauthenticated POST /api/secure/chat rejected with HTTP 401"
else
  log_fail "Expected HTTP 401 for unauth chat, got $unauth_code"
fi

# 2b: Authenticated chat check
bridge_resp=$(curl -s -X POST "${GATEWAY_URL}/api/secure/chat" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message":"e2e verification ping"}')

if echo "$bridge_resp" | grep -q '"conversation_id"' && echo "$bridge_resp" | grep -qi "kiwi"; then
  log_pass "Authenticated POST /api/secure/chat returned valid Kiwi AI response"
else
  log_fail "Bridge chat response did not contain conversation_id or Kiwi persona: $bridge_resp"
fi

# --- STAGE 3: Streaming & WebSockets Verification ---
log_stage "STAGE 3: WebSocket Streaming Verification"

if [ -f "${ROOT_DIR}/scripts/test_ws_streaming.py" ]; then
  if "${PYTHON_BIN}" "${ROOT_DIR}/scripts/test_ws_streaming.py"; then
    log_pass "WebSocket streaming test suite passed (Bearer, QueryParam, AuthFrame, Disconnect)"
  else
    log_fail "WebSocket streaming test suite failed"
  fi
else
  log_fail "Script ${ROOT_DIR}/scripts/test_ws_streaming.py missing"
fi

# --- STAGE 4: PWA Frontend Verification ---
log_stage "STAGE 4: Milestone 3 PWA Frontend Verification"

if [ -f "${ROOT_DIR}/scripts/test_pwa_verification.py" ]; then
  if "${PYTHON_BIN}" "${ROOT_DIR}/scripts/test_pwa_verification.py"; then
    log_pass "PWA verification suite passed (Assets, Manifest, DOM, Simulated Client)"
  else
    log_fail "PWA verification suite failed"
  fi
else
  log_fail "Script ${ROOT_DIR}/scripts/test_pwa_verification.py missing"
fi

# --- STAGE 5: Unit & Integration Regression Suites ---
log_stage "STAGE 5: Go & Python Unit Regression Suites"

log_info "Running Go test suite (gateway, ws, brain)..."
if (cd "${ROOT_DIR}" && go test ./...); then
  log_pass "All Go unit and integration tests passed"
else
  log_fail "Go test suite had failures"
fi

log_info "Running Python FastAPI & Streaming tests..."
if (cd "${ROOT_DIR}/services/orchestrator" && "${PYTEST_BIN}" -q tests/test_internal_api.py tests/test_streaming.py); then
  log_pass "Python internal API and streaming test suites passed"
else
  log_fail "Python test suite had failures"
fi

# --- Summary ---
echo ""
echo -e "${YELLOW}================================================================${NC}"
echo -e "${YELLOW}                  E2E VERIFICATION SUMMARY                      ${NC}"
echo -e "${YELLOW}================================================================${NC}"
echo -e "Total Passed Checks: ${GREEN}${pass_count}${NC}"
echo -e "Total Failed Checks: ${RED}${fail_count}${NC}"

if [ "$fail_count" -eq 0 ]; then
  echo -e "\n${GREEN}🎉 ALL END-TO-END ACCEPTANCE CRITERIA MET!${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ END-TO-END VERIFICATION FAILED WITH ${fail_count} ERRORS!${NC}\n"
  exit 1
fi
