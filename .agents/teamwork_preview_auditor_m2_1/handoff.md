# Forensic Integrity Audit Report — Milestone 2: Streaming & WebSockets

**Auditor**: `teamwork_preview_auditor` (Forensic Auditor)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_auditor_m2_1`  
**Date**: 2026-09-21  
**Integrity Mode**: `development` (per `/root/kiwi/.agents/ORIGINAL_REQUEST.md:14`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### A. Python SSE Streaming Implementation (`services/orchestrator`)
1. **Endpoint Implementation (`api/server.py:209-270`)**:
   - `POST /internal/chat/stream` returns a FastAPI `StreamingResponse` with `media_type="text/event-stream"`.
   - The generator `event_generator()` iterates over `model_router.stream_generate(...)` and yields each chunk sequentially formatted as `data: {"token": token}\n\n` followed by `data: {"done": true}\n\n`.
   - Verbatim response headers include:
     ```python
     headers={
         "Cache-Control": "no-cache",
         "Connection": "keep-alive",
         "X-Accel-Buffering": "no",
     }
     ```
2. **Adapter & Generation Logic (`models/adapters/gemini.py:203-263` and `base.py:81-99`)**:
   - In live mode (when `api_key` is supplied), it requests `streamGenerateContent?alt=sse`.
   - In local simulation mode (active when `GEMINI_API_KEY` is not set), it formats the Kiwi response and yields words individually with an asynchronous sleep of `0.025`s (`await asyncio.sleep(0.025)`).
3. **Empirical Timing on Python SSE Stream**:
   - An independent audit script (`verify_timing.py`) streamed directly from `http://127.0.0.1:9100/internal/chat/stream`:
     ```
     Total tokens received from SSE: 18
     Total time: 0.4535s
     Average inter-token delay: 25.19ms
     First 5 inter-token delays (ms): [17.24, 24.35, 26.89, 25.6, 25.46]
     Average interval between consecutive tokens (excluding TTFT): 25.66ms
     ```
   - Conclusion: Token generation in Python is authentically incremental and progressive, not batch buffered.

### B. Go Gateway SSE Consumer & WebSocket Hub (`services/gateway`)
1. **SSE Line Consumption (`services/gateway/brain/client.go:93-153`)**:
   - `ChatStream(ctx context.Context, req ChatRequest, chunkCallback func(token string) error)` opens an HTTP POST to `/internal/chat/stream` with `Accept: text/event-stream`.
   - Reads the response body line-by-line via `scanner := bufio.NewScanner(resp.Body)`.
   - On matching `data:`, parses the payload and invokes `chunkCallback(payload.Token)` immediately for each chunk.
   - If `payload.Done` is received, returns `nil`.
   - If `chunkCallback` returns an error (e.g. downstream abort), terminates scanner loop immediately.
2. **WebSocket Hub & Relay (`services/gateway/ws/hub.go`)**:
   - `ServeWS(hub, w, r)` supports tri-modal authentication:
     - Method 1: `Authorization: Bearer <token>` in HTTP upgrade header.
     - Method 2: `?token=<token>` URL query parameter.
     - Method 3: Unauthenticated connections are accepted and granted a 5-second deadline (`authTimeout = 5 * time.Second`) to send an initial `auth` frame (`{"type": "auth", "content": "<token>"}`). Invalid or timed-out connections are closed with WebSocket close code 4401.
   - `handleChatMessage(msg WSMessage)`:
     1. Emits initial `status.thinking` frame (`{"type": "status.thinking", ...}`).
     2. Initiates `brain.ChatStream` with a client-bound cancellable context (`streamCtx, cancel := context.WithCancel(...)`).
     3. For every token received in `chunkCallback`, wraps it in `WSMessage{Type: "chat.stream", Content: token}` and pushes it into `c.send` channel without buffering.
     4. `c.writePump()` reads `<-c.send` and immediately sends `websocket.TextMessage` frames across the socket.
     5. Emits `chat.complete` with the full message upon stream completion.
     6. If client disconnects mid-stream, `readPump()` invokes `c.cancelStream()`, cancelling `streamCtx` and causing `brain.ChatStream` to abort upstream SSE.
3. **Sleep / Fake Simulation Check**:
   - Grep search for `Sleep` across `services/gateway`:
     ```
     services/gateway/main_test.go:78:  time.Sleep(1 * time.Millisecond)
     services/gateway/ws/hub_test.go:188: time.Sleep(50 * time.Millisecond)
     ```
   - Zero occurrences of `time.Sleep` in gateway production code. No artificial delays or mock timers exist on the gateway side.
4. **Empirical Timing on Gateway WebSocket Hub**:
   - An independent audit script (`verify_timing.py`) connected to `ws://127.0.0.1:8080/api/secure/ws`:
     ```
     Received thinking at +0.63ms
     Total WS tokens received: 18
     First 5 WS inter-token delays (ms): [7.43, 23.96, 25.41, 27.43, 24.09]
     Average WS interval between consecutive tokens (excluding TTFT): 25.70ms
     ```
   - The inter-token latency on WebSocket (25.70ms) matches the upstream Python SSE emission rate (25.66ms) within 0.04ms. This confirms direct, unbuffered token piping.

### C. Runtime Validation & Process Supervision
1. **Network Sockets (`ss -tulpn`)**:
   - `127.0.0.1:9100`: python/uvicorn (`kiwi-brain`) listening strictly on localhost loopback.
   - `*:8080`: `kiwi-gateway` listening on port 8080.
2. **PM2 Process Status (`pm2 status`)**:
   - `kiwi-gateway` (id 4): `online`
   - `kiwi-brain` (id 5): `online`
3. **Execution Logs**:
   - `kiwi-gateway` PM2 log verifies graceful client disconnect handling:
     `Brain SSE stream aborted due to client disconnect: context canceled`
   - `kiwi-brain` PM2 log verifies continuous HTTP 200 responses to `/internal/chat/stream`.

### D. Automated Integration & Test Execution
1. **Worker Live Integration Suite (`scripts/test_ws_streaming.py`)**:
   - Ran successfully with 5/5 tests passing:
     - Test 1: Bearer Header Auth & Live Token Streaming (18 tokens) -> PASS
     - Test 2: Query Param Auth & Streaming (17 tokens) -> PASS
     - Test 3: Initial Auth Frame Auth (17 tokens) -> PASS
     - Test 4: Invalid Auth Rejection (401 status) -> PASS
     - Test 5: Client Disconnect Mid-Stream Resilience -> PASS
2. **Go Unit Test Suite (`services/gateway/ws/hub_test.go`, `services/gateway/brain`, `services/gateway`)**:
   - 14/14 original tests PASS.
   - Note on `hub_empirical_challenge_test.go`: An adversarial challenge test file added by peer challenger flagged that when the brain returns 503 or midstream error, the gateway logs the failure but omits an explicit `error` WS frame to the client. This is a functional robustness edge case, not an integrity violation or facade.
3. **Python Test Suite (`.venv/bin/pytest tests/test_streaming.py tests/test_internal_api.py -v`)**:
   - 8/8 tests PASS.

---

## 2. Logic Chain

1. **Integrity Rule Compliance (Development Mode)**:
   - *Observation*: Development mode prohibits hardcoded test results, facade implementations returning constants, and fabricated verification logs.
   - *Reasoning*: Source code inspection reveals genuine algorithms: gorilla/websocket upgrade with authentication check, full channel-based hub concurrency, `bufio.Scanner` event stream parsing, and dynamic persona response generation.
   - *Deduction*: No prohibited patterns (hardcoding, facades, or fabrication) are present.

2. **Genuine Streaming vs Batch Emulation**:
   - *Observation*: In `verify_timing.py`, Python SSE emits chunks at ~25.66ms intervals, and the Go Gateway relays them over WebSocket at ~25.70ms intervals.
   - *Reasoning*: If the gateway or brain were buffering the response and emitting it in a burst, consecutive token arrival deltas would collapse to near-zero (<1ms). If fake sleep simulation were used on the gateway, `time.Sleep` calls would exist in `services/gateway`.
   - *Deduction*: The streaming pipeline is genuine end-to-end. Tokens are yielded progressively by Python, parsed line-by-line in Go, and piped immediately to the client socket.

3. **Lifecycle & Resource Safety**:
   - *Observation*: When a client disconnects mid-stream, `Client.cancelStream()` invokes the Go `context.CancelFunc`, aborting `brain.ChatStream`.
   - *Reasoning*: This frees the HTTP connection to Python and stops upstream generation, preventing goroutine and socket leakage.
   - *Deduction*: The streaming bridge cleanly handles client lifecycle and network interruptions.

---

## 3. Caveats

1. **Upstream Brain Failure Frame Omission**:
   - In `services/gateway/ws/hub.go:346-353`, when `brain.ChatStream` returns an error (e.g. upstream brain crash or 503), the gateway logs `Brain streaming failed: <err>` and exits the goroutine without emitting an `error` frame or closing the WebSocket. While this is not an integrity violation, adding an error frame notification is recommended for frontend error reporting in Milestone 3.
2. **Gemini API Key**:
   - External `GEMINI_API_KEY` is unset in `.env`. Generation is verified using the authentic deterministic simulation fallback in `models/adapters/gemini.py`, which correctly chunks text and paces tokens at 25ms.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 2 (Streaming & WebSockets) satisfies all integrity requirements:
1. Genuine, token-by-token streaming is implemented and empirically verified across Python SSE and Go WebSocket layers.
2. No facade implementations, hardcoded test results, fabricated artifacts, or gateway sleep hacks exist.
3. Network sockets and PM2 dual-process supervision are verified in healthy operating state.

---

## 5. Verification Method

To independently reproduce the forensic checks:

1. **Verify Token Inter-Arrival Timing Empirically**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/.agents/teamwork_preview_auditor_m2_1/verify_timing.py
   ```
   *Expected Output*: Both SSE and WebSocket token intervals average ~25-26ms with all empirical timing checks passing.

2. **Run Live WebSocket 5-Scenario Integration Suite**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/test_ws_streaming.py
   ```
   *Expected Output*: `ALL WEBSOCKET STREAMING TESTS PASSED (5/5)!`

3. **Verify Gateway Sleep Absence**:
   ```bash
   grep -rn "time.Sleep" /root/kiwi/services/gateway/
   ```
   *Expected Output*: Only occurs in test files, zero occurrences in production code.

4. **Verify Process & Socket Status**:
   ```bash
   pm2 status
   ss -tulpn | grep -E ':(8080|9100)'
   ```
   *Expected Output*: Both `kiwi-gateway` and `kiwi-brain` online; 9100 listening on 127.0.0.1, 8080 on all interfaces.
