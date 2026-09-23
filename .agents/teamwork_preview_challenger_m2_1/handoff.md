# Handoff Report — Milestone 2 Empirical Challenge (Streaming & WebSockets)

**Agent**: `teamwork_preview_challenger` (Challenger 1 for Milestone 2)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_challenger_m2_1`  
**Date**: 2026-09-21  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

1. **Baseline Verification & Test Suite Execution**:
   - Running `go test -count=1 -v ./...` against worker commit verified all 14 baseline tests passing across `kiwi/services/gateway`, `kiwi/services/gateway/brain`, and `kiwi/services/gateway/ws`.
   - Running `.venv/bin/pytest tests/test_streaming.py tests/test_internal_api.py -v` in `services/orchestrator` verified all 8 Python unit tests passing.
   - PM2 process status (`pm2 status`): `kiwi-gateway` (online, port 8080) and `kiwi-brain` (online, port 9100).

2. **Concurrency & Stream Isolation Benchmark (`scripts/m2_ws_stress_harness.py`)**:
   - **10 Concurrent WebSocket Clients**:
     - Completed 10/10 (100.0%) in 0.534s wall time.
     - Zero dropped connections, zero handshake timeouts.
     - Tokens received: 180 total across 10 streams (337.26 tokens/sec aggregate throughput).
     - **Token Isolation**: 0 token mixing events detected (`token_mixing_detected: false`). Each client received distinct streaming tokens containing its own unique UUID with zero cross-talk across connections.
     - **Stream Integrity**: `"".join(tokens) == complete_content` held true across 100% of connections.
   - **20 Concurrent WebSocket Clients**:
     - Completed 20/20 (100.0%) in 0.627s wall time.
     - Zero dropped connections, zero handshake failures.
     - Tokens received: 360 total across 20 streams (573.97 tokens/sec aggregate throughput).
     - **Token Isolation**: 0 token mixing events detected (`token_mixing_detected: false`).
     - **Stream Integrity**: `"".join(tokens) == complete_content` held true across 100% of connections.

3. **Latency & Cadence Metrics**:
   - **10 Concurrent Clients**:
     - Connect Latency: min=12.18ms, avg=15.31ms, median=13.54ms, p95=31.39ms, max=31.39ms, stddev=5.43ms.
     - Time-to-First-Token (TTFT): min=6.46ms, avg=19.69ms, median=19.96ms, p95=27.71ms, max=27.71ms, stddev=6.65ms.
     - Inter-Token Cadence: min=19.48ms, avg=25.94ms, median=25.86ms, p95=27.21ms, max=31.11ms, stddev=1.00ms.
     - Stream Duration: min=471.76ms, avg=488.09ms, median=488.86ms, p95=495.22ms, max=495.22ms.
   - **20 Concurrent Clients**:
     - Connect Latency: min=6.76ms, avg=10.32ms, median=10.50ms, p95=14.07ms, max=14.07ms, stddev=1.53ms.
     - Time-to-First-Token (TTFT): min=26.35ms, avg=67.40ms, median=67.50ms, p95=106.28ms, max=106.28ms, stddev=23.86ms.
     - Inter-Token Cadence: min=4.77ms, avg=27.87ms, median=27.12ms, p95=34.42ms, max=56.64ms, stddev=5.21ms.
     - Stream Duration: min=517.96ms, avg=574.27ms, median=577.82ms, p95=603.00ms, max=603.00ms.

4. **Message Type Routing & Protocol Validation**:
   - `status.thinking`: Verified. Received on 100% of valid chat requests, always preceding token streams (`thinking_before_stream: true`).
   - `chat.stream`: Verified. Delivered token-by-token with correct JSON envelope and matching `conversation_id`.
   - `chat.complete`: Verified. Emitted upon stream completion containing full concatenated message text.
   - Unauthenticated Chat Frame: Connection terminated with WebSocket close code 4401 (`reason: "Unauthorized - Please authenticate first"`).
   - Unauthenticated 5s Timeout: Connection closed at 5.01s with code 4401 (`reason: "Authentication timeout"`).
   - Oversized Frame (>512KB): Rejected and closed with WebSocket code 1009.
   - Stream Preemption: Sending a second `chat.message` while stream 1 was active cleanly aborted stream 1 via `c.cancelStreamLocked()` and completed stream 2.

5. **CRITICAL DEFICIENCY — Missing `error` Frames on Brain Failure**:
   - In `services/gateway/ws/hub.go`, lines 346–354:
     ```go
     err := brain.ChatStream(streamCtx, brainReq, func(token string) error {
         fullResponse.WriteString(token)
         streamMsg := WSMessage{
             Type:           "chat.stream",
             ConversationID: convID,
             Content:        token,
         }
         return c.sendMessage(streamMsg)
     })

     if err != nil {
         if streamCtx.Err() != nil {
             log.Printf("Brain SSE stream aborted due to client disconnect: %v", streamCtx.Err())
             return
         }
         log.Printf("Brain streaming failed: %v", err)
         return
     }
     ```
   - **Empirical Live Brain Outage Reproduction**:
     - Stopped `kiwi-brain` (`pm2 stop kiwi-brain`).
     - Sent `{"type": "chat.message", "content": "hello while brain is down"}` to `ws://127.0.0.1:8080/api/secure/ws`.
     - Observed: Server emitted `status.thinking`, logged `Brain streaming failed: brain unreachable: ...`, and **exited without sending any frame**.
     - Result: The WebSocket client received zero error frames, zero complete frames, and hung indefinitely in the "kiwi is thinking..." state until connection timeout.
   - **Empirical Test Suite Failure (`services/gateway/ws/hub_empirical_challenge_test.go`)**:
     ```
     === RUN   TestServeWS_BrainFailure_ErrorFrame
     2026/09/21 03:03:09 Brain streaming failed: brain returned status 503: Brain kernel crashed
     hub_empirical_challenge_test.go:83: BUG CONFIRMED: Gateway does not emit an error frame when upstream brain streaming fails!
     --- FAIL: TestServeWS_BrainFailure_ErrorFrame (1.00s)

     === RUN   TestServeWS_BrainMidStreamError_ErrorFrame
     2026/09/21 03:03:10 Brain streaming failed: brain stream error: LLM provider quota exceeded
     hub_empirical_challenge_test.go:169: BUG CONFIRMED: Gateway does not emit an error frame on midstream brain failure!
     --- FAIL: TestServeWS_BrainMidStreamError_ErrorFrame (1.00s)
     ```

6. **Architectural Finding — Python Gemini Adapter Streaming Buffering**:
   - In `services/orchestrator/models/adapters/gemini.py`, lines 223–244:
     `sync_fetch_chunks()` runs `urllib.request.urlopen` in a worker thread and appends all incoming lines into `chunks = []` until EOF, before returning the list to `fetched = await asyncio.to_thread(sync_fetch_chunks)`.
   - When a live `GEMINI_API_KEY` is configured, this buffers the entire LLM response into memory before emitting chunks, eliminating real-time token streaming benefits over the live Google API.

---

## 2. Logic Chain

1. **Concurrency and Stream Isolation are Robust**:
   - *Observation*: 10 and 20 simultaneous WebSocket connections achieved 100% success with 0 token mixing, TTFT under 107ms (p95), and steady ~26-28ms token cadence.
   - *Reasoning*: Each `*Client` in `hub.go` maintains its own dedicated `send` channel (buffer 256), distinct `WSMessage` dispatch goroutine, and nanosecond/UUID conversation IDs.
   - *Deduction*: The Gateway's concurrent connection management and client multiplexing are sound under 10–20 concurrent users.

2. **Absence of Error Frame Breaks Client Lifecycle (Why REQUEST_CHANGES)**:
   - *Observation*: When `brain.ChatStream` fails (due to upstream 503, 500, network disconnect, or SSE `data: {"error": "..."}`), `hub.go` logs `Brain streaming failed: %v` and immediately executes `return` without calling `c.sendMessage(...)`.
   - *Reasoning*: The client has already received `status.thinking` (`"kiwi is thinking..."`). Because no `error` frame or `chat.complete` frame is ever dispatched, the client has no protocol signal that the stream terminated abnormally.
   - *Deduction*: Any client (specifically the Milestone 3 PWA / Mobile app) will remain permanently locked in a pending "thinking" UI state. This directly violates `PLAN.md §2.3d` ("Edge: brain crashes mid-stream → graceful error") and the task mandate to verify `error` frames.

3. **Remediation is Scoped and Clear**:
   - *Observation*: `WSMessage` already defines `Type string`, `Content string`, and `ConversationID string`.
   - *Reasoning*: When `err != nil` (and `streamCtx.Err() == nil`), dispatching:
     ```go
     c.sendMessage(WSMessage{
         Type:           "error",
         ConversationID: convID,
         Content:        fmt.Sprintf("Brain streaming failed: %v", err),
     })
     ```
     notifies the client immediately and satisfies both `TestServeWS_BrainFailure_ErrorFrame` and `TestServeWS_BrainMidStreamError_ErrorFrame`.
   - *Deduction*: A 5-line change in `services/gateway/ws/hub.go` completely resolves this bug without architectural redesign.

---

## 3. Caveats

1. **Simulation vs Live Google Gemini API**: All tests were run using the simulation adapter mode because `GEMINI_API_KEY` is unset. The simulation yields 20–30ms tokens accurately mimicking flash models.
2. **Database Persistence**: Supabase `DATABASE_URL` was unset during tests, verifying graceful degraded mode in `db.InsertMessage`.
3. **Empty Message Handling**: An empty message (`content: "   "`) is currently silently dropped by `hub.go:286`. While safe against panics, returning an `error` frame (`"Message cannot be empty"`) would improve symmetry with the HTTP endpoint.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

While Milestone 2 succeeds across concurrency (100% on 10 and 20 clients), token isolation (0 mixing), TTFT (19–67ms), token cadence (26–28ms), and handshake authentication, it **fails on message type routing and error resilience**:
- **Defect**: Upstream brain failures (503, 500, network failure, or SSE error payload) leave the WebSocket client hanging indefinitely in the `status.thinking` state because the Gateway logs the error but emits no `error` frame over the socket.
- **Required Changes**:
  1. In `services/gateway/ws/hub.go` (around line 352), emit a `WSMessage{Type: "error", ConversationID: convID, Content: ...}` when `brain.ChatStream` returns an error (and `streamCtx.Err() == nil`).
  2. (Recommended) If `userContent == ""` in `handleChatMessage`, emit an `error` frame (`"Message cannot be empty"`) instead of silently ignoring.
  3. Verify that `go test -v -run "TestServeWS_Brain.*ErrorFrame" ./services/gateway/ws` passes.

---

## 5. Verification Method

To reproduce the bug and verify the fix:

1. **Reproduce via Go Unit Test**:
   ```bash
   cd /root/kiwi
   go test -v -run "TestServeWS_Brain.*ErrorFrame" ./services/gateway/ws
   ```
   - *Current Result*: `FAIL: TestServeWS_BrainFailure_ErrorFrame` and `FAIL: TestServeWS_BrainMidStreamError_ErrorFrame` (read timeout waiting for error frame).
   - *Expected Result After Fix*: Both tests PASS.

2. **Reproduce via Live Stress Harness**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/m2_ws_stress_harness.py
   ```
   - Inspect output and `/root/kiwi/scripts/m2_stress_results.json` to verify 10 & 20 client concurrency metrics.

3. **Reproduce Live Brain Outage**:
   ```bash
   pm2 stop kiwi-brain
   /root/kiwi/services/orchestrator/.venv/bin/python -c '
   import asyncio, json, websockets
   async def test():
       async with websockets.connect("ws://127.0.0.1:8080/api/secure/ws?token=kiwi_secret_token_dev") as ws:
           await ws.send(json.dumps({"type": "chat.message", "content": "test outage"}))
           print("First frame:", await ws.recv())
           try:
               print("Second frame:", await asyncio.wait_for(ws.recv(), timeout=3.0))
           except asyncio.TimeoutError:
               print("HANG CONFIRMED: No error frame received!")
   asyncio.run(test())
   '
   pm2 restart kiwi-brain
   ```
   - *Current Result*: Prints `HANG CONFIRMED: No error frame received!`.
   - *Expected Result After Fix*: Receives frame with `"type": "error"`.
