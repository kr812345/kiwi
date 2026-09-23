# Handoff Report — Milestone 2 Empirical Challenge (Challenger 2: Edge Cases, Disconnects & Recovery)

**Agent**: `teamwork_preview_challenger` (Challenger 2 for Milestone 2: Streaming & WebSockets)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_challenger_m2_2`  
**Date**: 2026-09-21  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Task 1: Mid-Stream Disconnects (1st, 5th, 10th Chunks) & Leak Verification
- **Test Executed**: `/root/kiwi/scripts/challenger_m2_suite.py` and Go leak harness in `services/gateway/ws/hub_leak_test.go`.
- **Observations Across Cutoff Thresholds**:
  - Disconnect after chunk 1: 3/3 cycles disconnected cleanly after exactly 1 token frame.
  - Disconnect after chunk 5: 3/3 cycles disconnected cleanly after exactly 5 token frames.
  - Disconnect after chunk 10: 3/3 cycles disconnected cleanly after exactly 10 token frames.
  - Rapid Stress Loop: 15 consecutive rapid mid-stream disconnects (5 of each cutoff: 1, 5, 10) executed without errors.
- **Upstream SSE Cancellation Verification**:
  - Upon client socket closure, `readPump()` in `services/gateway/ws/hub.go:167-172` executes:
    ```go
    defer func() {
        c.hub.unregister <- c
        c.cancelStream()
        c.conn.Close()
    }()
    ```
  - Gateway PM2 logs confirmed context cancellation propagation:
    ```
    4|kiwi-gat | 2026/09/21 03:01:30 Brain SSE stream aborted due to client disconnect: context canceled
    ```
- **Memory & Goroutine Leak Metrics**:
  - Gateway Process RSS before stress test: `10816 KB` (Threads: 8).
  - Gateway Process RSS after 24 disconnect cycles: `10792 KB` (Threads: 8). Net memory delta: `-24 KB`.
  - Go In-Process Unit Test (`TestServeWS_MidStreamDisconnect_NoGoroutineLeak`):
    ```
    hub_leak_test.go:112: Goroutine count: initial=7, final=7, delta=0
    --- PASS: TestServeWS_MidStreamDisconnect_NoGoroutineLeak (1.99s)
    ```
  - Net goroutine leak = **0 goroutines**.
- **Task 1 Result**: **PASS**. Upstream SSE request is immediately canceled and no goroutines or memory leak.

---

### 1.2 Task 2: Brain Crash Mid-Stream & Failure Recovery
- **Requirement**: *"Kill or restart python brain (pm2 stop/restart kiwi-brain) while tokens are streaming; verify Gateway closes or sends error frame to client without crashing."*
- **Test Executed**: `/root/kiwi/scripts/test_brain_crash_scenarios.py` against live PM2 Gateway (`http://127.0.0.1:8080`) and Brain (`http://127.0.0.1:9100`).
- **Verbatim Test Results**:
  1. **Scenario 2A (SIGKILL Mid-Stream)**:
     - Client connected, received `status.thinking`, received token 1 (`"yo! "`), received token 2 (`"kiwi "`).
     - Python brain process terminated instantly via `os.kill(brain_pid, signal.SIGKILL)`.
     - Gateway PM2 log recorded:
       ```
       4|kiwi-gat | 2026/09/21 03:02:06 Brain streaming failed: error reading stream: unexpected EOF
       ```
     - **Gateway process status**: Survived (`online`, pid 4), did not crash.
     - **Client outcome**: Client waited for next frame; **timed out after 5.0 seconds receiving nothing**.
     - `closed_by_server = False`, `received_error_frame = False`.
  2. **Scenario 2B (PM2 Restart Mid-Stream)**:
     - Client connected, received `status.thinking`.
     - Brain restarted via `pm2 restart kiwi-brain`.
     - Client outcome: **timed out after 5.0 seconds receiving nothing**.
     - `closed_by_server = False`, `received_error_frame = False`.
  3. **Scenario 2C (Brain Down Before Message Sent)**:
     - Brain stopped (`pm2 stop kiwi-brain`).
     - Client connected and sent `chat.message`.
     - Gateway emitted `status.thinking`.
     - Gateway logged `Brain streaming failed: brain unreachable: dial tcp 127.0.0.1:9100: connect: connection refused`.
     - Client outcome: **timed out receiving nothing**. Client hung in the "thinking" state.
- **Code Root Cause (`services/gateway/ws/hub.go`, lines 346–353)**:
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
      return // <-- BUG: Returns without notifying client or closing socket!
  }
  ```
- **Secondary Bug Discovered: False Completion on Premature EOF (`services/gateway/brain/client.go`, lines 118–152)**:
  - In `services/gateway/brain/client.go`:
    ```go
    scanner := bufio.NewScanner(resp.Body)
    for scanner.Scan() {
        ...
        if payload.Done {
            return nil
        }
        ...
    }
    if err := scanner.Err(); err != nil {
        return fmt.Errorf("error reading stream: %w", err)
    }
    return nil // <-- If stream closes cleanly on EOF without done: true, returns nil!
    ```
  - When the Python Brain closes the stream prematurely (clean TCP FIN) without emitting `data: {"done": true}`, `scanner.Scan()` finishes and `ChatStream` returns `nil`.
  - In `hub.go:358-363`, Gateway treats this as a successful completion and sends `chat.complete` containing only the truncated tokens, and persists the truncated message to Supabase!
  - Confirmed empirically in Go test `TestServeWS_BrainPrematureEOF_FalseComplete`:
    ```
    hub_leak_test.go:224: BUG OBSERVED: Gateway emitted chat.complete with truncated content: 'partial unfinished sentence' despite missing 'done: true'!
    ```
- **Task 2 Result**: **FAILED**. Gateway does not crash, but fails to close the connection or send an error frame, leaving the client hanging indefinitely.

---

### 1.3 Task 3: Unauthenticated Connections (5-Second Deadline & Close Code 4401)
- **Test Executed**: Subtests 3.1–3.4 in `scripts/challenger_m2_suite.py` and `services/gateway/ws/hub_leak_test.go`.
- **Verbatim Test Results**:
  1. **Subtest 3.1 (Timeout Expiration)**:
     - Connected to `ws://127.0.0.1:8080/api/secure/ws` without Authorization header or query parameter.
     - Succeeded in WebSocket handshake upgrade.
     - Exactly at `5.00s` (elapsed: 5.002s), connection was terminated by Gateway.
     - WebSocket Close Code: **`4401`**.
     - WebSocket Close Reason: **`"Authentication timeout"`**.
  2. **Subtest 3.2 (Non-Auth Frame While Unauthenticated)**:
     - Connected unauthenticated, immediately sent `{"type": "chat.message", "content": "test"}`.
     - Gateway immediately closed connection with Close Code: **`4401`**, Reason: **`"Unauthorized - Please authenticate first"`**.
  3. **Subtest 3.3 (Invalid Token in Auth Frame)**:
     - Connected unauthenticated, sent `{"type": "auth", "content": "wrong_token_xyz"}`.
     - Gateway immediately closed connection with Close Code: **`4401`**, Reason: **`"Unauthorized - Invalid token"`**.
  4. **Subtest 3.4 (Late Valid Auth Frame Before Deadline)**:
     - Connected unauthenticated, waited 3.5s (before the 5.0s deadline), sent `{"type": "auth", "content": "kiwi_secret_token_dev"}`.
     - Timer cancelled; connection remained open at 6.0s.
     - Successfully sent chat message and received `status.thinking`.
- **Task 3 Result**: **PASS**. 100% compliant with protocol specification and clean closure with close code 4401.

---

## 2. Logic Chain

1. **Disconnects and Goroutine Lifecycle are Resilient**:
   - *Observation*: Mid-stream disconnects after 1st, 5th, and 10th tokens triggered context cancellation in Go (`streamCtx.Err() == context.Canceled`), cleanly terminating the upstream HTTP request to Python.
   - *Observation*: Gateway memory RSS remained flat (`10816 KB` -> `10792 KB`), threads remained steady at 8, and in-process goroutine count returned to baseline with delta 0 (`initial=7, final=7`).
   - *Deduction*: Goroutine management and context cancellation in `readPump()` and `handleChatMessage()` are leak-free under repeated client disconnects.

2. **Brain Crash Mid-Stream Leaves Client Hanging (Why REQUEST_CHANGES)**:
   - *Observation*: When `kiwi-brain` crashes or restarts mid-stream, `brain.ChatStream` returns an error (`unexpected EOF` or `connection refused`).
   - *Observation*: `services/gateway/ws/hub.go:346-353` intercepts this error, logs `Brain streaming failed: %v`, and exits the goroutine with `return`.
   - *Observation*: The client has already received `status.thinking` (and optionally 1 or more `chat.stream` tokens). No subsequent `error` frame or `chat.complete` frame is ever sent, and the WebSocket connection is never closed.
   - *Deduction*: The client interface (e.g. the Milestone 3 PWA or mobile app) is left hanging permanently with an active spinner or typewriter cursor. This violates the explicit Milestone 2 acceptance requirement: *"verify Gateway closes or sends error frame to client without crashing"*.

3. **Incomplete Stream Truncation Corrupts Data**:
   - *Observation*: In `brain/client.go:137-152`, `scanner.Scan()` does not verify whether `payload.Done` was received before EOF.
   - *Observation*: When EOF occurs prematurely, `ChatStream` returns `nil`, causing `handleChatMessage` to send `chat.complete` with truncated text and save incomplete messages to the database.
   - *Deduction*: The stream consumer must track `receivedDone := false` and return an error if EOF occurs prior to receiving `done: true`.

---

## 3. Caveats

- **External Gemini API Key**: `GEMINI_API_KEY` is unset in `.env`, so tests utilized the built-in deterministic simulation streaming mode (20–30ms per token). This provided identical token streaming dynamics as a live LLM without consuming API quota.
- **Supabase Database Connection**: `DATABASE_URL` is unset, so chat persistence ran in graceful degraded mode.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

### Summary of Results:
| Task | Description | Result | Details |
|---|---|---|---|
| **1** | Disconnect Mid-Stream (1, 5, 10 chunks) | **PASS** | Upstream SSE canceled, net goroutine leak = 0, memory stable (-24 KB) |
| **2** | Brain Crash Mid-Stream Failure Recovery | **FAIL** | Gateway does not crash, but sends NO error frame and does NOT close WS. Client hangs indefinitely |
| **3** | Unauthenticated Connections (5s timeout) | **PASS** | Clean closure at 5.00s with WebSocket code 4401 and reason "Authentication timeout" |

### Required Actionable Changes for Worker:

1. **Emit Error Frame on Brain Failure (`services/gateway/ws/hub.go`)**:
   In `handleChatMessage`, when `brain.ChatStream` returns an error (`err != nil` and `streamCtx.Err() == nil`), send an error frame to the client:
   ```go
   if err != nil {
       if streamCtx.Err() != nil {
           log.Printf("Brain SSE stream aborted due to client disconnect: %v", streamCtx.Err())
           return
       }
       log.Printf("Brain streaming failed: %v", err)
       errMsg := WSMessage{
           Type:           "error",
           ConversationID: convID,
           Content:        fmt.Sprintf("Kiwi brain error: %v", err),
       }
       c.sendMessage(errMsg)
       return
   }
   ```

2. **Validate Stream Completion (`services/gateway/brain/client.go`)**:
   In `ChatStream`, ensure `doneReceived := false` is tracked. If the loop exits on EOF without `doneReceived == true`, return an error:
   ```go
   if !doneReceived {
       return fmt.Errorf("brain stream terminated prematurely without done signal")
   }
   ```

---

## 5. Verification Method

To independently verify these findings:

1. **Run Comprehensive Challenger Test Suite**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/challenger_m2_suite.py
   ```
   - Confirms Task 1 (Mid-stream disconnects & leak check: PASS)
   - Confirms Task 2 (Brain crash error frame / closure: FAILED)
   - Confirms Task 3 (Unauthenticated 5s timeout code 4401: PASS)

2. **Run Brain Crash Scenarios Test**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/test_brain_crash_scenarios.py
   ```
   - Verifies that killing or restarting `kiwi-brain` mid-stream results in client timeout (hanging) rather than an error frame or closure.

3. **Run In-Process Go Goroutine Leak and Protocol Tests**:
   ```bash
   cd /root/kiwi
   go test -v -run "TestServeWS_MidStreamDisconnect_NoGoroutineLeak|TestServeWS_UnauthenticatedTimeout_CloseCode4401|TestServeWS_BrainPrematureEOF_FalseComplete" ./services/gateway/ws
   ```
   - Shows `delta=0` goroutines on disconnects.
   - Shows close code `4401` on 5s timeout.
   - Confirms `BUG OBSERVED: Gateway emitted chat.complete with truncated content` on premature EOF.

4. **Invalidation Conditions**:
   - If `challenger_m2_suite.py` Task 2 reports `Requirement Met: True` with client receiving an `error` frame or server closure upon brain restart/crash, the bug is resolved.
