# Dispatch: Explorer 2 (Gateway Static Serving Explorer)

## Context
Project: Kiwi AI System - Milestone 3: Mobile App MVP / PWA
Original Request: /root/kiwi/.agents/ORIGINAL_REQUEST.md
Master Plan: /root/kiwi/PLAN.md
Project Spec: /root/kiwi/PROJECT.md
Working Directory: /root/kiwi/.agents/teamwork_preview_explorer_m3_2

## Objective
Investigate `/root/kiwi/services/gateway/` (particularly `main.go`, routing, middleware, CORS, auth, and WebSocket handler).
Determine how the Go Gateway can serve the PWA static files from `/root/kiwi/apps/mobile/public` (or `/root/kiwi/apps/mobile`):
1. How to mount static file serving (e.g. `http.FileServer` at `/` or `/app` or `/static`). Should `/` serve `index.html` and static assets directly so users navigating to `http://127.0.0.1:8080/` get the PWA?
2. Auth middleware review: Does auth middleware intercept `/` or static files? If so, verify that static files and public assets (`/manifest.json`, `/sw.js`, `/styles.css`, `/app.js`, icons) bypass Bearer token authentication so the browser can load the app before the user logs in.
3. WebSocket handshake review: How does the Go gateway currently authenticate `/api/secure/ws`? Does it accept query parameter `?token=...` or Authorization header, or an auth message frame? Check `services/gateway/ws/` and `auth/middleware.go`.
4. CORS and headers: Are there any CORS or MIME-type issues when served from Go or separate server?

## Output Requirements
Produce a comprehensive report in `/root/kiwi/.agents/teamwork_preview_explorer_m3_2/report.md` with exact code snippets, routing changes, and verification recommendations for the worker.
Do NOT write or modify application source code.
Send a completion message back to orchestrator when finished.

## 2026-09-21T00:28:19Z
You are Explorer 2 (Gateway Static Serving Explorer).
Your working directory is /root/kiwi/.agents/teamwork_preview_explorer_m3_2.
Read /root/kiwi/.agents/ORIGINAL_REQUEST.md and /root/kiwi/.agents/teamwork_preview_explorer_m3_2/DISPATCH.md before starting work.
Also read /root/kiwi/PROJECT.md and /root/kiwi/services/gateway/.
Investigate gateway static routing, auth middleware bypass, and WebSocket handshake compatibility.
Write your comprehensive report to /root/kiwi/.agents/teamwork_preview_explorer_m3_2/report.md.
When finished, send a message back to the orchestrator summarizing your key findings.

