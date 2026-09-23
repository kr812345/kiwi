# Dispatch: Worker M3 (Mobile App MVP / PWA Implementation)

## Context
Project: Kiwi AI System - Milestone 3: Mobile App MVP / PWA
Original Request: /root/kiwi/.agents/ORIGINAL_REQUEST.md
Master Plan: /root/kiwi/PLAN.md
Project Spec: /root/kiwi/PROJECT.md
Working Directory: /root/kiwi/.agents/teamwork_preview_worker_m3

## Authoritative Explorer Reports
- Explorer 1 (Frontend Assets): `/root/kiwi/.agents/teamwork_preview_explorer_m3_1/report.md`
- Explorer 2 (Gateway Static Serving): `/root/kiwi/.agents/teamwork_preview_explorer_m3_2/report.md`
- Explorer 3 (E2E & Test Harness): `/root/kiwi/.agents/teamwork_preview_explorer_m3_3/report.md`

## File Ownership
You exclusively own and may edit or create:
- `/root/kiwi/apps/mobile/public/index.html`
- `/root/kiwi/apps/mobile/public/app.js`
- `/root/kiwi/apps/mobile/src/` (symlinks or files to match PROJECT.md layout)
- `/root/kiwi/services/gateway/main.go`
- `/root/kiwi/services/gateway/main_test.go`
- `/root/kiwi/scripts/test_pwa_verification.py`
- `/root/kiwi/scripts/e2e_verify.sh`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. **Frontend PWA Implementation**:
   - Create `/root/kiwi/apps/mobile/public/index.html` following the complete blueprint in Explorer 1's `report.md` §3 (meta tags, PWA links, avatar container, status bar, chat messages container, input form, settings modal).
   - Create `/root/kiwi/apps/mobile/public/app.js` following the complete blueprint in Explorer 1's `report.md` §4 (token auth modal with `GET /api/secure/ping`, WebSocket client connecting to `/api/secure/ws?token=...`, typewriter streaming effect, avatar states `[ ^ _ ^ ]`, `[ > _ < ]`, `[ ★ ᴗ ★ ]`, `[ @ _ @ ]`, exponential backoff reconnection from 1s to 30s, and service worker registration).
   - Reconcile `apps/mobile/src/` directory layout with symlinks to `public/` as specified in Explorer 1's `report.md` §5.

2. **Go Gateway Static Serving**:
   - Update `services/gateway/main.go` following Explorer 2's `report.md` §3 to mount static file serving at root `/` on `mux` using adaptive directory resolution, PWA cache control headers (`no-cache` for `sw.js`, `application/manifest+json` for `manifest.json`), SPA fallback to `index.html`, and `corsMiddleware`.
   - Update `services/gateway/main_test.go` to add unit tests for static file serving, manifest headers, service worker cache headers, and CORS preflight.
   - Build Go gateway binary: `cd /root/kiwi/services/gateway && go build -o kiwi-gateway .`
   - Restart in PM2: `pm2 restart kiwi-gateway`

3. **Verification Test Harnesses**:
   - Implement `/root/kiwi/scripts/test_pwa_verification.py` based on Explorer 3's `report.md` §3 (5 stages: HTTP/MIME checks, manifest/SW checks, DOM structure, JS syntax check, simulated PWA client streaming).
   - Implement `/root/kiwi/scripts/e2e_verify.sh` based on Explorer 3's `report.md` §4 (master acceptance runner for bridge, PM2, streaming, and PWA). Make it executable (`chmod +x`).

4. **Execute Verification**:
   - Run Go unit tests: `go test -v ./...` in `/root/kiwi`
   - Run Python unit tests: `pytest -v tests/test_internal_api.py tests/test_streaming.py` in `/root/kiwi/services/orchestrator`
   - Run WebSocket tests: `/root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/test_ws_streaming.py`
   - Run PWA verification tests: `/root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/test_pwa_verification.py`
   - Run Master E2E runner: `/root/kiwi/scripts/e2e_verify.sh`

5. **Reporting**:
   - Write comprehensive report and handoff in `/root/kiwi/.agents/teamwork_preview_worker_m3/handoff.md` with full command outputs.
   - Send completion message to orchestrator.

## 2026-09-21T00:32:48Z
You are Worker M3 (PWA & Gateway Worker).
Your working directory is /root/kiwi/.agents/teamwork_preview_worker_m3.
Read /root/kiwi/.agents/ORIGINAL_REQUEST.md, /root/kiwi/PROJECT.md, and your dispatch instructions in /root/kiwi/.agents/teamwork_preview_worker_m3/DISPATCH.md before beginning.
Also read the authoritative reports from Explorer 1, Explorer 2, and Explorer 3.
Implement:
1. apps/mobile/public/index.html and apps/mobile/public/app.js
2. Reconcile apps/mobile/src/
3. Mount static file serving & CORS in services/gateway/main.go, add tests in main_test.go, build kiwi-gateway, restart in PM2
4. Implement scripts/test_pwa_verification.py and scripts/e2e_verify.sh
5. Run all build and test commands (Go tests, Python tests, WebSocket tests, PWA tests, e2e_verify.sh)
6. Write your handoff report to /root/kiwi/.agents/teamwork_preview_worker_m3/handoff.md and send a completion message to the orchestrator.
