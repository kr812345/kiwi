#!/bin/bash
# Run Pip's unit tests, then Pip's integration tests.
# scripts/dev-local.sh calls this before it builds or starts either server.
# PIP_SKIP_TESTS=1 skips both suites when you start through dev-local.sh.
# Department end-to-end tiers stay out of this gate; they are not wired.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_phase() {
  local name="$1"
  shift
  echo "======== Pip ${name} tests ========"
  if "$@"; then
    echo "======== Pip ${name} tests passed ========"
  else
    echo "======== Pip ${name} tests FAILED ========"
    exit 1
  fi
}

run_phase unit bash -c "
  set -euo pipefail
  cd '$ROOT/services/orchestrator'
  python3 -m pytest tests/unit -q --tb=short
  cd '$ROOT'
  go test -count=1 ./services/gateway/...
"

run_phase integration bash -c "
  set -euo pipefail
  cd '$ROOT/services/orchestrator'
  python3 -m pytest tests/integration -q --tb=short
  cd '$ROOT'
  go test -tags integration -count=1 -run 'TestIntegration' ./services/gateway/
"
