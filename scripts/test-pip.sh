#!/bin/bash
# Run Pip's unit tests, then Pip's integration tests.
# Department end-to-end tiers stay out of this gate; they are not wired.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== unit tests ==="
(
  cd "$ROOT/services/orchestrator"
  python3 -m pytest tests/unit -q --tb=short
)
(
  cd "$ROOT"
  go test -count=1 ./services/gateway/...
)

echo "=== integration tests ==="
(
  cd "$ROOT/services/orchestrator"
  python3 -m pytest tests/integration -q --tb=short
)
(
  cd "$ROOT"
  go test -tags integration -count=1 -run TestIntegration ./services/gateway/
)

echo "=== all unit and integration tests passed ==="
