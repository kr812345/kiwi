# Soft Handoff — Project Orchestrator (Generation 1 -> Generation 2)

**From**: `teamwork_preview_orchestrator` (Gen 1, conv ID: `61906bc7-6cc0-4500-84df-f0a2171b46ad`)  
**To**: `teamwork_preview_orchestrator` (Gen 2)  
**Parent (Sentinel)**: `e0dfa253-3df8-484f-b084-f72a133d5d71`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_orchestrator`  
**Project Root**: `/root/kiwi`  
**Date**: 2026-09-21  

---

## 1. Milestone State

| Milestone | Scope | Status | Notes |
|---|---|---|---|
| **Phase 0** | Survey & Codebase Exploration | **DONE** | 3 parallel survey agents mapped Gateway, Synapse Brain, and specs into `PROJECT.md`. |
| **Milestone 1** | Go ↔ Python Bridge (Sprint 1) | **DONE (GATE PASSED)** | Toolchain installed (Go 1.22, Python packages), `/internal/chat` implemented, Kiwi persona, Go `brain/client.go` HTTP bridge, DB nil-checks, PM2 dual process supervision. 100% test pass. Gate passed unanimously (2 Reviewers, 2 Challengers, Auditor CLEAN). |
| **Milestone 2** | Streaming & WebSockets (Sprint 2) | **DONE (GATE PASSED)** | Python SSE `/internal/chat/stream`, Go WebSocket hub (`/api/secure/ws`), context-aware streaming relay, error frames emitted on failure, premature SSE EOF detection. Gate passed after Iteration 2 error resilience fix. |
| **Milestone 3** | Mobile App MVP (Sprint 3) | **IN PROGRESS (READY TO DISPATCH)** | PWA frontend in `apps/mobile/` (or web PWA) with manifest, service worker, token authentication UI (`GET /api/secure/ping`), streaming chat UI, Kiwi avatar states, and exponential backoff retry. |
| **Milestone 4** | Final E2E Acceptance & Sentinel Report | **PLANNED** | End-to-end verification across Bridge, Streaming, and PWA, followed by final report back to Sentinel (`e0dfa253-3df8-484f-b084-f72a133d5d71`). |

---

## 2. Active Subagents
- None currently active. All 16 subagents from Generation 1 have completed their tasks and delivered handoff reports.

---

## 3. Pending Decisions & Context
1. **Model Selection**: The user explicitly instructed: *"Focus on token efficiency and use smaller models (flash) where appropriate."* Always set `Model: "flash"` when invoking subagents unless deep multi-step refactoring requires otherwise.
2. **Hard Constraints**:
   - As an orchestrator, you are **DISPATCH-ONLY**.
   - NEVER write, modify, or create source code files directly.
   - NEVER run build/test commands yourself — require workers to do so.
   - You may only use file editing tools for `.md` files under `.agents/`.
   - Forensic Auditor report of INTEGRITY VIOLATION is a strict, non-negotiable binary veto.
3. **PWA Architecture (Milestone 3)**:
   - `ORIGINAL_REQUEST.md` specifies: *"Build a Progressive Web App (PWA) using Next.js or plain HTML/JS/CSS that connects to the Go Gateway's WebSocket endpoint. It must support token authentication, display chat messages with streaming animations, and have a Kiwi-branded UI."*
   - A standalone, modern HTML5/JS/CSS PWA with service worker and manifest served either by the Go Gateway or a lightweight static file server in `apps/mobile/` perfectly satisfies this without requiring heavy native build toolchains.

---

## 4. Remaining Work (Concrete Next Steps for Successor)

1. **Start Heartbeat Cron**: Immediately start your own recurring heartbeat cron:
   `schedule(CronExpression="*/10 * * * *", Prompt="Heartbeat check on subagent progress and update progress.md")`
2. **Dispatch Milestone 3 Worker**:
   - Create working directory `/root/kiwi/.agents/teamwork_preview_worker_m3/` and `DISPATCH.md`.
   - Spawn `teamwork_preview_worker` (`Model="flash"`) to implement Milestone 3 (Mobile App MVP / PWA in `apps/mobile/`):
     - `manifest.json`, `sw.js`, mobile viewport meta tags.
     - Token authentication modal (`GET /api/secure/ping` connection check).
     - Streaming chat UI with typewriter animation and Kiwi avatar states (`[ ^ _ ^ ]`, `[ > _ < ]`, `[ ★ ᴗ ★ ]`, `[ @ _ @ ]`).
     - Kiwi theme palette (`#4CAF50`, `#0D1117`, `#161B22`).
     - Auto-reconnection with exponential backoff (1s to 30s).
     - Serving the PWA (either directly via Go Gateway static route or node/python static server).
3. **Milestone 3 Gate Committee**:
   - After Worker M3 finishes, dispatch Reviewers, Challengers, and Forensic Auditor for M3 gating.
4. **Final Acceptance & Completion Report**:
   - Run end-to-end verification covering all acceptance criteria from `ORIGINAL_REQUEST.md`:
     1. Bridge: `curl -X POST http://127.0.0.1:8080/api/secure/chat` returns AI response from Python brain.
     2. Streaming: WebSocket client connects to Go Gateway and receives token-by-token streaming from Python brain.
     3. Frontend: PWA connects to backend, authenticates, and displays streaming chat interface.
     4. Process Management: PM2 runs services online.
   - Send final completion message to Sentinel (`e0dfa253-3df8-484f-b084-f72a133d5d71`) using `send_message`.

---

## 5. Key Artifacts
- `/root/kiwi/.agents/ORIGINAL_REQUEST.md` — Original immutable user request
- `/root/kiwi/PLAN.md` — Master implementation plan
- `/root/kiwi/PROJECT.md` — Master project architecture, feature inventory, contracts, and code layout
- `/root/kiwi/.agents/teamwork_preview_orchestrator/GATE_STATUS.md` — Gate verdicts
- `/root/kiwi/.agents/teamwork_preview_orchestrator/BRIEFING.md` — Persistent working memory
- `/root/kiwi/.agents/teamwork_preview_orchestrator/progress.md` — Liveness & iteration checkpoint
- `/root/kiwi/ecosystem.config.js` — PM2 configuration supervising `kiwi-gateway` and `kiwi-brain`
- `/root/kiwi/scripts/test_ws_streaming.py` — Live WebSocket test script
