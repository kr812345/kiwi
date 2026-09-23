# Master Execution Plan: Kiwi AI System

## Objectives
Deliver the complete Kiwi AI System merging Go Gateway with Synapse OS Python Brain across Sprints 1, 2, and 3 as detailed in `PLAN.md` and `ORIGINAL_REQUEST.md`.

## Execution Plan

### Step 0: Survey Phase (Parallel Explorers / Spec Miners)
- Explorer 1: Map existing Go Gateway structure, auth middleware, routes, db models, and dependencies.
- Explorer 2: Map existing Synapse OS Python brain structure, FastAPI app, Kernel, ModelRouter, MemoryEngine, and dependencies.
- Explorer 3 / Spec Miner: Map PM2 setup (`ecosystem.config.js`), Supabase / database migrations, environment variables, and WebSocket / SSE design specs from `PLAN.md`.

### Step 1: Synthesize Survey into `PROJECT.md`
- Synthesize architecture, feature inventory, code layout, interface contracts, and milestone plan into `/root/kiwi/PROJECT.md`.

### Step 2: Milestone 1 — Go ↔ Python Bridge (Sprint 1)
- 1.1 Python Brain Internal API (`/internal/chat`) & Kiwi persona.
- 1.2 Go Gateway Brain Client (`services/gateway/brain/client.go`) & Chat Handler integration.
- 1.3 PM2 configuration (`ecosystem.config.js`) for both Gateway and Brain.
- 1.4 Supabase migration & MemoryEngine consolidation.
- Verification: `curl -X POST http://127.0.0.1:8080/api/secure/chat` succeeds, PM2 manages both processes.

### Step 3: Milestone 2 — Streaming & WebSockets (Sprint 2)
- 2.1 WebSocket Hub in Go Gateway (`services/gateway/ws/hub.go`) & `/api/secure/ws`.
- 2.2 Python SSE streaming (`/internal/chat/stream`) & Go SSE consumer relay.
- Verification: WebSocket client connects to Go Gateway and receives streaming tokens from Python Brain.

### Step 4: Milestone 3 — Mobile App MVP (Sprint 3)
- 3.1 PWA / Frontend interface with WebSocket connection, auth, streaming chat UI, and Kiwi theme.
- Verification: PWA connects to backend, authenticates, and displays streaming chat interface.

### Step 5: Acceptance & Final Verification
- Reviewer, Challenger, and Forensic Auditor verification.
- Final completion report to Sentinel.
