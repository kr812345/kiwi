# Project: Kiwi AI System

## Architecture
The Kiwi AI System merges the Kiwi Go API Gateway with the Synapse OS Python Brain into a unified, high-performance personal AI system accessible from mobile and web interfaces.

```
Client Layer (PWA / Mobile / Web)
       │ (HTTPS / WSS)
       ▼
Go API Gateway (Port 8080)
├── Auth Middleware & Handshake (Bearer token / Query param)
├── HTTP Router: /health, /api/health, /api/secure/ping, /api/secure/chat
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

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Host Toolchain Setup | Install Go compiler (1.22+) and configure Python `.venv` packages | M1 | Survey |
| 2 | Python Internal Chat Endpoint | `POST /internal/chat` returning synchronous `InternalChatResponse` | M1 | PLAN.md §1.1 |
| 3 | Kiwi Persona Module | `services/orchestrator/persona/kiwi.py` defining system prompt and style | M1 | PLAN.md §1.1 |
| 4 | Go Brain HTTP Client | `services/gateway/brain/client.go` to communicate with Python brain | M1 | PLAN.md §1.2 |
| 5 | Gateway Chat Integration | Replace Dumb Echo in `chatHandler` with `brain.Chat` and DB persistence | M1 | PLAN.md §1.2 |
| 6 | Database Panic Fix | Add nil pool checks in `services/gateway/db/chat.go` for DB resilience | M1 | Survey |
| 7 | Supabase Synapse Migration | `infra/supabase/migrations/002_synapse_tables.sql` for Synapse tables | M1 | PLAN.md §1.4 |
| 8 | MemoryEngine Consolidation | `MemoryEngine` connecting to `DATABASE_URL` with degraded mode | M1 | PLAN.md §1.4 |
| 9 | PM2 Dual Process Supervision | `ecosystem.config.js` managing both `kiwi-gateway` and `kiwi-brain` | M1 | PLAN.md §1.3 |
| 10 | Go Gateway WebSocket Hub | `services/gateway/ws/hub.go` managing client sessions at `/api/secure/ws` | M2 | PLAN.md §2.1 |
| 11 | Python SSE Streaming Endpoint | `POST /internal/chat/stream` yielding token chunks | M2 | PLAN.md §2.2 |
| 12 | ModelRouter Streaming | `stream_generate` generator in `ModelRouter` and adapters | M2 | PLAN.md §2.2 |
| 13 | Go SSE-to-WebSocket Relay | Relay SSE tokens as `chat.stream` WS messages to clients | M2 | PLAN.md §2.2 |
| 14 | Kiwi Status Events | Emit `status.thinking` and lifecycle events over WebSocket | M2 | PLAN.md §2.3 |
| 15 | PWA Manifest & Service Worker | Installable PWA shell with `manifest.json` and `sw.js` | M3 | ORIGINAL_REQUEST.md |
| 16 | Token Authentication UI | PWA Auth screen testing `GET /api/secure/ping` and saving token | M3 | PLAN.md §3.2 |
| 17 | Streaming Chat Interface | Real-time typewriter chat UI with Kiwi avatar states | M3 | PLAN.md §3.2 |
| 18 | Kiwi Brand Theme & Style | Kiwi green `#4CAF50` palette, dark background `#0D1117` | M3 | PLAN.md §3.4 |
| 19 | WebSocket Reconnection Handler | Exponential backoff retry logic (1s to 30s) on disconnect | M3 | PLAN.md §3.3 |
| 20 | E2E Integration Suite | Automated end-to-end verification across Bridge, Streaming, and PWA | M_E2E | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Go ↔ Python Bridge (Sprint 1) | Toolchain setup, Python `/internal/chat`, Kiwi persona, Go `brain/client.go`, `main.go` bridge, DB nil checks, Supabase migration 002, `MemoryEngine` consolidation, PM2 dual process config | none | DONE (Verified: curl 200, go test 5/5, pytest 5/5, PM2 online) |
| 2 | M2: Streaming & WebSockets (Sprint 2) | Go WebSocket Hub (`ws/hub.go`), `/api/secure/ws`, Python `POST /internal/chat/stream`, ModelRouter `stream_generate`, Go SSE consumer & WS relay | M1 | DONE (Verified: live WS streaming 5/5, 14 Go tests, 8 Python tests, error resilience verified) |
| 3 | M3: Mobile App MVP (Sprint 3) | PWA with manifest, service worker, token auth, WebSocket streaming chat UI, Kiwi avatar & theme, reconnection handling | M2 | IN_PROGRESS |
| 4 | M_E2E: Verification & Acceptance | Comprehensive E2E testing of Bridge curl, WebSocket streaming, and PWA frontend | M1, M2, M3 | PLANNED |

## Interface Contracts

### 1. Gateway ↔ Brain Bridge (HTTP)
- **Endpoint**: `POST http://127.0.0.1:9100/internal/chat`
- **Request Body**:
  ```json
  {
    "message": "hello kiwi",
    "conversation_id": "optional-uuid",
    "session_id": "optional-uuid"
  }
  ```
- **Response Body (200 OK)**:
  ```json
  {
    "response": "hey! kiwi here...",
    "conversation_id": "uuid",
    "model_used": "gemini-2.5-flash",
    "tokens": {"prompt_tokens": 12, "completion_tokens": 20, "total_tokens": 32},
    "cost_usd": 0.00001,
    "persona": {"name": "Kiwi", "avatar": "[ ^ _ ^ ]"}
  }
  ```
- **Error Codes**: 400 (empty message), 503 (kernel not ready), 500 (model router error).

### 2. Gateway ↔ Brain Streaming (SSE)
- **Endpoint**: `POST http://127.0.0.1:9100/internal/chat/stream`
- **Request Body**: Same as `POST /internal/chat`
- **Response Format**: `text/event-stream`
  - Token chunk: `data: {"token": "hello"}\n\n`
  - Done chunk: `data: {"done": true}\n\n`
  - Error chunk: `data: {"error": "..."}\n\n`

### 3. Client ↔ Gateway WebSocket Protocol
- **Endpoint**: `GET /api/secure/ws` (HTTP Upgrade with Bearer token header or `?token=...` query param, or initial auth message)
- **Message Schema**:
  ```json
  {
    "type": "chat.message | chat.stream | chat.complete | status.thinking | status.tool_call | auth",
    "conversation_id": "optional-uuid",
    "content": "string",
    "metadata": {}
  }
  ```

## Code Layout
```
/root/kiwi/
├── ecosystem.config.js                 # PM2 process config for gateway & brain
├── go.mod / go.sum                     # Go module definitions
├── services/
│   ├── gateway/
│   │   ├── main.go                     # Go Gateway entry point, routes, shutdown
│   │   ├── auth/middleware.go          # Bearer auth middleware
│   │   ├── brain/client.go             # HTTP/SSE client to Synapse Python brain
│   │   ├── db/
│   │   │   ├── db.go                   # Supabase pgx pool
│   │   │   └── chat.go                 # Conversation & message storage with nil checks
│   │   └── ws/
│   │       └── hub.go                  # WebSocket Hub and connection manager
│   └── orchestrator/
│       ├── api/server.py               # FastAPI server (/internal/chat, /internal/chat/stream)
│       ├── boot.py                     # OS boot sequence
│       ├── persona/
│       │   ├── __init__.py
│       │   └── kiwi.py                 # Kiwi persona prompt & builder
│       ├── models/
│       │   ├── model_router.py         # Model routing and fallback
│       │   └── adapters/gemini.py      # Gemini adapter with stream_generate
│       └── memory/
│           └── memory_engine.py        # Memory engine with DATABASE_URL & degraded mode
├── apps/
│   └── mobile/                         # Mobile App MVP (PWA)
│       ├── public/
│       │   ├── index.html              # PWA entry page
│       │   ├── manifest.json           # Web App Manifest
│       │   └── sw.js                   # Service worker
│       ├── src/
│       │   ├── app.js                  # PWA chat application logic
│       │   └── styles.css              # Kiwi theme styling
├── infra/
│   └── supabase/migrations/
│       ├── 001_initial_schema.sql
│       └── 002_synapse_tables.sql      # Synapse OS tables & pgvector
└── scripts/
    └── e2e_verify.sh                   # Comprehensive verification test script
```
