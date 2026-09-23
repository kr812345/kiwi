# Handoff Report — Milestone 2 Worker (Iteration 2: Stream Error Resilience)

**Agent**: `teamwork_preview_worker` (Milestone 2 Worker - Iteration 2)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_worker_m2_gen2`  
**Date**: 2026-09-21  
**Status**: **COMPLETE (Hard Handoff)**  

---

## 1. Observation

### 1.1 Root Cause & Defect Observations
1. **Defect 1: False Completion on Premature Stream EOF (`services/gateway/brain/client.go:118-153`)**:
   - In `brain.ChatStream()`, the SSE scanner loop did not record whether `payload.Done` (`data: {"done": true}`) had been received.
   - When upstream brain closed the connection before emitting `done: true` (e.g. server-side abnormal termination or network cutoff), `scanner.Scan()` returned `false` on EOF and `scanner.Err()` was `nil`, resulting in `ChatStream` returning `nil`.
   - Consequently, `hub.go:handleChatMessage` treated the prematurely closed stream as a normal completion, emitted `chat.complete` containing truncated tokens, and attempted to persist incomplete assistant turns to Supabase.
   - Verbatim error reproduced before fix:
     ```
     hub_leak_test.go:224: BUG OBSERVED: Gateway emitted chat.complete with truncated content: 'partial unfinished sentence' despite missing 'done: true'!
     ```

2. **Defect 2: Missing `error` Frame on Upstream Brain Streaming Failure (`services/gateway/ws/hub.go:346-354`)**:
   - When `brain.ChatStream` returned an error (e.g. HTTP 503, 500, network error, or SSE error payload `data: {"error": "..."}`), `hub.go` logged `Brain streaming failed: %v` and immediately exited without sending any frame to the client over WebSocket.
   - Because the client had already received `status.thinking` ("kiwi is thinking..."), the absence of either an `error` frame or a `chat.complete` frame left the client hanging indefinitely in the thinking state.
   - Verbatim test failures reproduced before fix:
     ```
     === RUN   TestServeWS_BrainFailure_ErrorFrame
     2026/09/21 03:06:16 Brain streaming failed: brain returned status 503: Brain kernel crashed
         hub_empirical_challenge_test.go:83: BUG CONFIRMED: Gateway does not emit an error frame when upstream brain streaming fails! Received err=read tcp 127.0.0.1:50004->127.0.0.1:46829: i/o timeout, frame={Type: ConversationID: Content: Token: Metadata:<nil>}
     --- FAIL: TestServeWS_BrainFailure_ErrorFrame (1.00s)

     === RUN   TestServeWS_BrainMidStreamError_ErrorFrame
     2026/09/21 03:06:17 Brain streaming failed: brain stream error: LLM provider quota exceeded
         hub_empirical_challenge_test.go:169: BUG CONFIRMED: Gateway does not emit an error frame on midstream brain failure! Received err=read tcp 127.0.0.1:35846->127.0.0.1:36255: i/o timeout, frame={Type: ConversationID: Content: Token: Metadata:<nil>}
     --- FAIL: TestServeWS_BrainMidStreamError_ErrorFrame (1.00s)
     ```

---

## 2. Logic Chain

### 2.1 Remediation in `services/gateway/brain/client.go`
- **Logic**:
  1. Added `errors` import to `client.go`.
  2. In `ChatStream(ctx context.Context, req ChatRequest, chunkCallback func(token string) error) error`:
     - Initialized `var doneReceived bool`.
     - When `payload.Done` is encountered, set `doneReceived = true` and return `nil`.
     - After scanner loop terminates, checked:
       ```go
       if !doneReceived {
           if ctx.Err() != nil {
               return ctx.Err()
           }
           return errors.New("stream closed prematurely before completion")
       }
       ```
- **Deduction**: If the stream terminates prematurely without `done: true` and the client did not cancel the context, `ChatStream` returns `errors.New("stream closed prematurely before completion")`.

### 2.2 Remediation in `services/gateway/ws/hub.go`
- **Logic**:
  1. In `handleChatMessage`:
     ```go
     if err != nil {
         if streamCtx.Err() != nil {
             log.Printf("Brain SSE stream aborted due to client disconnect: %v", streamCtx.Err())
             return
         }
         log.Printf("Brain streaming failed: %v", err)
         errorMsg := WSMessage{
             Type:           "error",
             ConversationID: convID,
             Content:        "Brain streaming failed: " + err.Error(),
         }
         c.sendMessage(errorMsg)
         return
     }
     ```
  2. Because the goroutine returns immediately after sending the error frame:
     - `completeMsg` (`Type: "chat.complete"`) is never sent.
     - Database persistence (`db.InsertMessage(..., "assistant", ...)`) is bypassed, guaranteeing truncated text is never persisted.
- **Deduction**: The WebSocket client receives an explicit protocol frame notifying it of the upstream failure, allowing UIs (such as the PWA/mobile app in Milestone 3) to render error alerts rather than hanging in `status.thinking`.

---

## 3. Caveats

1. **Client Send Buffer Full**: If a client connection is unresponsive or its send buffer is full, `c.sendMessage(errorMsg)` drops the message safely without blocking other goroutines, consistent with Gorilla WebSocket best practices.
2. **Context Cancellation on Disconnect**: When a client initiates disconnect mid-stream, `streamCtx.Err() != nil` takes precedence so the gateway does not send an error frame over a closed socket.

---

## 4. Conclusion

Both defects identified during empirical challenge have been resolved cleanly and verified against all unit, integration, and stress test suites:
- `TestServeWS_BrainFailure_ErrorFrame`: **PASS** (0.00s)
- `TestServeWS_BrainMidStreamError_ErrorFrame`: **PASS** (0.00s)
- `TestServeWS_BrainPrematureEOF_FalseComplete`: **PASS** (0.00s)
- `python3 scripts/test_ws_streaming.py`: **5/5 PASS**
- `python3 scripts/challenger_m2_suite.py`: **All 3 Tasks PASS** (Mid-stream disconnects, brain crash recovery, unauthenticated timeout)
- `python3 scripts/test_brain_crash_scenarios.py`: **PASS** (SIGKILL mid-stream and PM2 restart mid-stream both cleanly receive error frames)

---

## 5. Verification Method

To independently verify these fixes:

1. **Run Go Test Suite**:
   ```bash
   cd /root/kiwi
   go test -count=1 -v ./services/gateway/brain ./services/gateway/ws
   ```
   *Expected Output*:
   - `TestServeWS_BrainFailure_ErrorFrame`: `PASS`
   - `TestServeWS_BrainMidStreamError_ErrorFrame`: `PASS`
   - `TestServeWS_BrainPrematureEOF_FalseComplete`: `PASS`
   - All tests pass (`ok kiwi/services/gateway/brain`, `ok kiwi/services/gateway/ws`).

2. **Verify Gateway Binary Compilation**:
   ```bash
   go build -o services/gateway/kiwi-gateway ./services/gateway
   ```

3. **Verify PM2 Process Restart**:
   ```bash
   pm2 restart kiwi-gateway
   pm2 status
   ```

4. **Verify WebSocket Streaming Integration**:
   ```bash
   python3 /root/kiwi/scripts/test_ws_streaming.py
   ```
   *Expected Output*: `ALL WEBSOCKET STREAMING TESTS PASSED (5/5)!`

5. **Verify Challenger Stress & Crash Suites**:
   ```bash
   python3 /root/kiwi/scripts/test_brain_crash_scenarios.py
   python3 /root/kiwi/scripts/challenger_m2_suite.py
   ```
   *Expected Output*: Task 1 PASS, Task 2 PASS (`Gateway sent error frame: True`), Task 3 PASS.

### Detailed Code Diffs

#### Diff: `services/gateway/brain/client.go`
```diff
@@ -5,6 +5,7 @@ import (
 	"bytes"
 	"context"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"io"
 	"net/http"
@@ -118,6 +119,7 @@ func ChatStream(ctx context.Context, req ChatRequest, chunkCallback func(token s
 		return fmt.Errorf("brain returned status %d: %s", resp.StatusCode, string(respBody))
 	}
 
+	var doneReceived bool
 	scanner := bufio.NewScanner(resp.Body)
 	for scanner.Scan() {
 		line := strings.TrimSpace(scanner.Text())
@@ -137,6 +139,7 @@ func ChatStream(ctx context.Context, req ChatRequest, chunkCallback func(token s
 				return fmt.Errorf("brain stream error: %s", payload.Error)
 			}
 			if payload.Done {
+				doneReceived = true
 				return nil
 			}
 			if payload.Token != "" {
@@ -150,6 +153,13 @@ func ChatStream(ctx context.Context, req ChatRequest, chunkCallback func(token s
 		return fmt.Errorf("error reading stream: %w", err)
 	}
 
+	if !doneReceived {
+		if ctx.Err() != nil {
+			return ctx.Err()
+		}
+		return errors.New("stream closed prematurely before completion")
+	}
+
 	return nil
 }
```

#### Diff: `services/gateway/ws/hub.go`
```diff
@@ -349,6 +349,12 @@ func (c *Client) handleChatMessage(msg WSMessage) {
 				return
 			}
 			log.Printf("Brain streaming failed: %v", err)
+			errorMsg := WSMessage{
+				Type:           "error",
+				ConversationID: convID,
+				Content:        "Brain streaming failed: " + err.Error(),
+			}
+			c.sendMessage(errorMsg)
 			return
 		}
```
