# Scope: Kiwi AI System (Generation 2 Orchestration)

## Architecture
```
Client Layer (PWA / Mobile / Web)
       │ (HTTPS / WSS)
       ▼
Go API Gateway (Port 8080)
├── Auth Middleware & Handshake (Bearer token / Query param / In-band frame)
├── HTTP Router: /health, /api/health, /api/secure/ping, /api/secure/chat
├── Static File Handler: / (serving apps/mobile/public with SPA fallback, PWA headers, and CORS)
├── WebSocket Hub: /api/secure/ws
└── Brain Client: HTTP/SSE bridge to Brain
       │ (Internal Localhost HTTP/SSE)
       ▼
Synapse OS Python Brain (Port 9100, 127.0.0.1 only)
├── FastAPI Internal API: POST /internal/chat, POST /internal/chat/stream
├── Kiwi Persona Module: persona/kiwi.py (system prompt, lowercase style, dev puns)
├── Kernel & Event Bus
├── Model Router: Gemini Flash (with simulation fallback)
└── Memory Engine: Supabase PostgreSQL pgvector with graceful degraded mode
```

## Feature Inventory & Status
| # | Feature | Scope | Status | Notes |
|---|---------|-------|--------|-------|
| 1-9 | Go ↔ Python Bridge (Sprint 1) | M1 | **DONE (GATE PASSED)** | Toolchain, /internal/chat, kiwi.py, client.go, PM2, DB resilience |
| 10-14 | Streaming & WebSockets (Sprint 2) | M2 | **DONE (GATE PASSED)** | WebSocket Hub, /internal/chat/stream, SSE-to-WS relay, error frames |
| 15 | PWA Manifest & Service Worker | M3 | **DONE (GATE PASSED)** | manifest.json, sw.js shell precache, no-cache headers |
| 16 | Token Authentication UI | M3 | **DONE (GATE PASSED)** | Auth modal, localStorage, /api/secure/ping testing |
| 17 | Streaming Chat Interface | M3 | **DONE (GATE PASSED)** | Typewriter stream effect, typing cursor, DOM security |
| 18 | Kiwi Brand Theme & Style | M3 | **DONE (GATE PASSED)** | #4CAF50, #0D1117, #161B22, avatar states, CSS animations |
| 19 | WebSocket Reconnection Handler | M3 | **DONE (GATE PASSED)** | Exponential backoff (1s to 30s ceiling), clean reconnect |
| 20 | Static File Serving in Gateway | M3 | **DONE (GATE PASSED)** | Go 1.22 mux precedence, CORS preflight, SPA fallback |
| 21 | End-to-End Acceptance Suite | M_E2E | **DONE (VERIFIED)** | 10/10 checks passing across Bridge, PM2, Streaming, and PWA |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Go ↔ Python Bridge (Sprint 1) | Bridge, PM2, Synapse | none | **DONE** |
| 2 | M2: Streaming & WebSockets (Sprint 2) | WS Hub, SSE relay | M1 | **DONE** |
| 3 | M3: Mobile App MVP (Sprint 3) | PWA in apps/mobile/, Gateway static mount | M2 | **DONE (GATE PASSED: Unanimous APPROVE)** |
| 4 | M_E2E: Verification & Acceptance | Master acceptance across Bridge, PM2, WS, PWA | M1, M2, M3 | **DONE (10/10 checks passing)** |
