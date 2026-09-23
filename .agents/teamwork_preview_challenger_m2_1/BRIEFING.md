# BRIEFING — 2026-09-20T21:34:00Z

## Mission
Empirically stress-test WebSocket streaming under concurrent load for Milestone 2: Concurrency (10-20 clients), Latency/Token Rate (TTFT & cadence), and Message Type Routing (status.thinking, chat.stream, chat.complete, error frames). Issue verdict APPROVE or REQUEST_CHANGES.

## 🔒 My Identity
- Archetype: EMPIRICAL CHALLENGER
- Roles: critic, specialist
- Working directory: /root/kiwi/.agents/teamwork_preview_challenger_m2_1
- Original parent: 61906bc7-6cc0-4500-84df-f0a2171b46ad
- Milestone: Milestone 2: Streaming & WebSockets
- Instance: 1 of 2

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Run verification code directly — never trust claims or logs without empirical reproduction
- Do not place source code, tests, or data files in .agents/
- Produce 5-component handoff report with explicit verdict: APPROVE or REQUEST_CHANGES

## Current Parent
- Conversation ID: 61906bc7-6cc0-4500-84df-f0a2171b46ad
- Updated: 2026-09-20T21:34:00Z

## Review Scope
- **Files reviewed**: 
  - `services/gateway/ws/hub.go`
  - `services/gateway/brain/client.go`
  - `services/gateway/main.go`
  - `services/orchestrator/api/server.py`
  - `services/orchestrator/models/adapters/gemini.py`
  - `scripts/test_ws_streaming.py`
- **Interface contracts**: /root/kiwi/PROJECT.md, /root/kiwi/PLAN.md, /root/kiwi/.agents/ORIGINAL_REQUEST.md
- **Worker report**: /root/kiwi/.agents/teamwork_preview_worker_m2/handoff.md

## Attack Surface
- **Hypotheses tested**:
  1. Concurrency: 10 and 20 simultaneous WebSocket connections with simultaneous chat messages.
  2. Stream isolation: Tested if token mixing occurs across separate client connections.
  3. Latency & Cadence: Measured TTFT, inter-token cadence, and stream duration under load.
  4. Message type routing: Validated `status.thinking`, `chat.stream`, `chat.complete`.
  5. Error frames: Tested behavior when brain fails (HTTP 503, network outage, or mid-stream error event).
  6. Edge cases: Malformed JSON, unauthenticated chat message, 5s auth timeout, oversized frame, back-to-back preemption.
- **Vulnerabilities found**:
  1. **Missing Error Frame Emission (CRITICAL)**: In `services/gateway/ws/hub.go:346-353`, when `brain.ChatStream` errors (e.g. brain offline or mid-stream error), the gateway logs the error and silently exits the goroutine. The client receives `status.thinking` and is left hung indefinitely without an `error` frame or `chat.complete` frame.
  2. **Non-Streaming Live Gemini Adapter (ARCHITECTURAL CAVEAT)**: In `services/orchestrator/models/adapters/gemini.py:223-240`, `sync_fetch_chunks` buffers all SSE chunks into an in-memory list before yielding, breaking real-time token streaming when a live API key is supplied.
- **Untested angles**:
  - Live Google Gemini API with actual paid API key (operating in simulation mode).

## Key Decisions Made
- Verdict: **REQUEST_CHANGES** due to missing `error` frame emission on brain outage/mid-stream failure, causing client hangs.
- Auth, concurrency, isolation, TTFT, and cadence are robust and performant.

## Artifact Index
- `/root/kiwi/.agents/teamwork_preview_challenger_m2_1/DISPATCH.md` — Dispatch log
- `/root/kiwi/.agents/teamwork_preview_challenger_m2_1/progress.md` — Liveness heartbeat
- `/root/kiwi/.agents/teamwork_preview_challenger_m2_1/handoff.md` — 5-component handoff report
- `/root/kiwi/scripts/m2_ws_stress_harness.py` — Benchmark & stress test harness
- `/root/kiwi/scripts/m2_stress_results.json` — Detailed benchmark statistics
- `/root/kiwi/services/gateway/ws/hub_empirical_challenge_test.go` — Go unit test reproducing the missing error frame bug
