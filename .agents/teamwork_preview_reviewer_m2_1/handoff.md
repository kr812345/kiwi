# Reviewer Handoff Report — Milestone 2: Streaming & WebSockets

**Agent**: `teamwork_preview_reviewer` (Reviewer 1 for Milestone 2)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_reviewer_m2_1`  
**Date**: 2026-09-21  

---

## Review Summary

**Verdict**: **APPROVE**  
Milestone 2 (Sprint 2: Streaming & WebSockets) meets all specification requirements (R2) and acceptance criteria defined in `PROJECT.md` and `PLAN.md`. All unit tests, integration tests, adversarial stress tests, and process checks pass with zero errors.

---

## 1. Observation

1. **Host Tooling & Automated Test Suites**:
   - **Go Test Suite (`cd /root/kiwi && go test -count=1 -v ./...`)**:
     Executed 14 tests across `kiwi/services/gateway`, `kiwi/services/gateway/brain`, and `kiwi/services/gateway/ws`. All passed cleanly in 0.13s:
     ```
     === RUN   TestChatHandler_EmptyMessage_Returns400
     --- PASS: TestChatHandler_EmptyMessage_Returns400 (0.00s)
     === RUN   TestChatHandler_FallbackConversationID_Nanosecond
     --- PASS: TestChatHandler_FallbackConversationID_Nanosecond (0.01s)
     PASS ok kiwi/services/gateway 0.031s
     === RUN   TestChat_Success ... PASS
     === RUN   TestChat_Unreachable ... PASS
     === RUN   TestChat_ErrorStatus ... PASS
     === RUN   TestHealth_Success ... PASS
     === RUN   TestHealth_Failure ... PASS
     === RUN   TestChatStream_Success ... PASS
     === RUN   TestChatStream_ErrorEvent ... PASS
     === RUN   TestChatStream_CallbackAbort ... PASS
     PASS ok kiwi/services/gateway/brain 0.031s
     === RUN   TestServeWS_BearerAuth_Success ... PASS
     === RUN   TestServeWS_QueryParamAuth_Success ... PASS
     === RUN   TestServeWS_InitialAuthFrame_Success ... PASS
     === RUN   TestServeWS_InvalidToken_Rejected ... PASS
     PASS ok kiwi/services/gateway/ws 0.068s
     ```
   - **Python Test Suite (`cd /root/kiwi/services/orchestrator && .venv/bin/pytest tests/test_streaming.py tests/test_internal_api.py -v`)**:
     Executed 8 tests covering empty message validation, SSE event streaming, ModelRouter streaming, health checks, and Kiwi persona structure. All passed in 7.06s:
     ```
     tests/test_streaming.py::test_stream_empty_message_400 PASSED            [ 12%]
     tests/test_streaming.py::test_stream_chat_success PASSED                 [ 25%]
     tests/test_streaming.py::test_model_router_stream_generate PASSED        [ 37%]
     tests/test_internal_api.py::test_health_check PASSED                     [ 50%]
     tests/test_internal_api.py::test_internal_chat_empty_message_400 PASSED  [ 62%]
     tests/test_internal_api.py::test_internal_chat_returns_ai_response PASSED [ 75%]
     tests/test_internal_api.py::test_internal_chat_preserves_conversation_id PASSED [ 87%]
     tests/test_internal_api.py::test_kiwi_persona_structure PASSED           [100%]
     ========================= 8 passed, 1 warning in 7.06s =========================
     ```

2. **Process Management (`pm2 status`)**:
   - Both processes supervised under PM2 are online and stable:
     - `kiwi-brain` (id 5): online, CPU 0%, Memory 26.5MB.
     - `kiwi-gateway` (id 4): online, CPU 0%, Memory 9.6MB.

3. **Live WebSocket Verification (`python /root/kiwi/scripts/test_ws_streaming.py`)**:
   - Tested 5 live end-to-end scenarios against `ws://127.0.0.1:8080/api/secure/ws`:
     - Test 1: Bearer Header Auth & Live Token Streaming (received `status.thinking`, 18 `chat.stream` chunks, and matched `chat.complete`).
     - Test 2: Query Param Auth (`?token=...`) & Streaming (17 chunks received).
     - Test 3: Initial Auth Frame within 5s deadline (17 chunks received).
     - Test 4: Invalid Auth Rejection (HTTP 401 handshake rejection).
     - Test 5: Client mid-stream disconnect resilience (clean abort without server panic).
     - Result: 5/5 PASSED.

4. **Independent Adversarial Stress Testing (`stress_test.py`)**:
   - Constructed and executed 6 adversarial scenarios in `/root/kiwi/.agents/teamwork_preview_reviewer_m2_1/stress_test.py`:
     - Scenario 1 (Unauthenticated 5s timeout): Connection terminated by gateway after 5.07s with WebSocket close code `4401` ("Authentication timeout").
     - Scenario 2 (Malformed JSON): Gateway logged `Invalid WebSocket JSON frame: invalid character 'N' looking for beginning of value`, did not crash, and promptly processed subsequent valid frames.
     - Scenario 3 (Whitespace-only content): Empty message ignored cleanly without spurious thinking or stream events.
     - Scenario 4 (5 Concurrent streams): 5 concurrent client sessions streamed simultaneously with complete message and token isolation.
     - Scenario 5 (Rapid stream interruption): Sending message 2 while message 1 was streaming cancelled stream 1 context cleanly and emitted response for message 2.
     - Scenario 6 (HTTP 400 rejection): `POST /api/secure/chat` with whitespace-only body returned HTTP `400 Bad Request` with `Message cannot be empty`.
     - Result: 6/6 PASSED.

5. **Code Inspection**:
   - `services/gateway/ws/hub.go`: Hub and Client structs implement concurrency-safe channel communication. `Client.sendBytes()` uses mutex-guarded non-blocking selects (`c.send <- msg` with `default`) to prevent slow clients from stalling hub loops. Upstream streaming context is tied to `c.activeCancel` and is cancelled when the client disconnects or issues a new message.
   - `services/gateway/brain/client.go`: `ChatStream` uses `bufio.Scanner` to parse `text/event-stream` lines sequentially, handles `token`, `done`, and `error` payloads, and propagates context cancellation.
   - `services/gateway/main.go`: Nanosecond-precision fallback conversation IDs (`fmt.Sprintf("conv-%d", time.Now().UnixNano())`) prevent collisions, and `strings.TrimSpace(req.Message) == ""` enforces input validation.
   - `services/orchestrator/api/server.py`: `POST /internal/chat/stream` properly streams SSE events with `media_type="text/event-stream"`, sets `X-Accel-Buffering: no` to avoid proxy buffering, and includes `data: {"done": true}` completion signal.
   - `services/orchestrator/models/model_router.py`: `stream_generate` supports fallback cascading across adapters.
   - `services/orchestrator/models/adapters/gemini.py`: Implements both live Google Gemini streaming (`streamGenerateContent?alt=sse`) and local simulation token chunking (25ms spacing).

---

## 2. Logic Chain

1. **Requirement Conformance (R2)**:
   - *Observation*: `ORIGINAL_REQUEST.md` and `PROJECT.md` specify R2: "A WebSocket client can connect to Go Gateway and receive token-by-token streaming messages from Python brain."
   - *Reasoning*: The Go gateway mounts `/api/secure/ws`, authenticates clients via Bearer header, `?token=` query param, or initial auth frame, and connects to Python brain's `/internal/chat/stream` via `ChatStream`.
   - *Deduction*: Live WebSocket verification script and independent stress tests confirm real-time token delivery ending with `chat.complete`. R2 is fully satisfied.

2. **Concurrency & Resource Management**:
   - *Observation*: Real-time systems risk memory leaks or thread exhaustion when clients abruptly disconnect or flood messages.
   - *Reasoning*: In `hub.go`, `c.activeCancel` cancels the upstream `streamCtx` as soon as `readPump` exits or a new message arrives. PM2 logs verify: `Brain SSE stream aborted due to client disconnect: context canceled`.
   - *Deduction*: Upstream Python SSE connections and Go goroutines do not leak or orphan upon client disconnect.

3. **Integrity Assessment**:
   - *Observation*: No test assertions rely on mocked bypasses in production code. Simulation fallback in `gemini.py` is explicitly planned in `PROJECT.md` ("Gemini Flash with simulation fallback") and implements live SSE parsing logic for real Gemini API keys.
   - *Reasoning*: Real sockets, HTTP servers, and PM2 processes were queried and validated live.
   - *Deduction*: No integrity violations, dummy facades, or shortcuts exist.

---

## 3. Findings

### [Minor] Finding 1: Gateway WebSocket Error Frame on Upstream Brain Outage
- **What**: In `services/gateway/ws/hub.go` (lines 346–353), if `brain.ChatStream` returns an error (e.g., Python brain is down or returns 500/503), the gateway logs `Brain streaming failed: <err>` and exits the goroutine without emitting an error WS message to the client.
- **Where**: `services/gateway/ws/hub.go:346-353`
- **Why**: The connected WebSocket client receives `status.thinking` but does not receive an error frame or `chat.complete`, leaving the frontend UI in a perpetual "thinking..." state until a timeout occurs.
- **Suggestion**: Emit an error frame back to the client, e.g., `c.sendMessage(WSMessage{Type: "error", Content: "Kiwi brain is temporarily unavailable", ConversationID: convID})`. (Recommended for Sprint 3 frontend integration / Sprint 4 robustness).

---

## 4. Caveats

- **External Gemini API Key**: `GEMINI_API_KEY` is not set in `.env`; streaming operates in local simulation mode (25ms token cadence) which mimics live LLM output. When an API key is configured, `gemini.py` will route to Google's live endpoint.
- **Supabase Database**: `DATABASE_URL` is unset in `.env`; chat persistence operates in graceful degraded mode (memory/in-flight only).

---

## 5. Conclusion

Milestone 2 implementation is complete, well-architected, resilient against adversarial conditions, and meets all acceptance criteria.
**Verdict**: **APPROVE**.

---

## 6. Verification Method

To independently reproduce all verification results:

1. **Run Go Tests**:
   ```bash
   cd /root/kiwi && go test -count=1 -v ./...
   ```
   *Expected*: 14 passed tests.

2. **Run Python Tests**:
   ```bash
   cd /root/kiwi/services/orchestrator && .venv/bin/pytest tests/test_streaming.py tests/test_internal_api.py -v
   ```
   *Expected*: 8 passed tests.

3. **Verify PM2 Processes**:
   ```bash
   pm2 status
   ```
   *Expected*: `kiwi-gateway` and `kiwi-brain` online.

4. **Run Live WebSocket Verification**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/test_ws_streaming.py
   ```
   *Expected*: 5/5 passed.

5. **Run Adversarial Stress Test Suite**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/.agents/teamwork_preview_reviewer_m2_1/stress_test.py
   ```
   *Expected*: 6/6 passed.
