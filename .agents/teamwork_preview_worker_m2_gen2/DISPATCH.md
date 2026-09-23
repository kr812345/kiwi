## 2026-09-20T21:35:36Z
You are teamwork_preview_worker (Milestone 2 Worker - Iteration 2: Stream Error Resilience).
Your working directory is: /root/kiwi/.agents/teamwork_preview_worker_m2_gen2
Parent Orchestrator Conv ID: 61906bc7-6cc0-4500-84df-f0a2171b46ad

MANDATORY FIRST STEP: Read the original user request at /root/kiwi/.agents/ORIGINAL_REQUEST.md, the project specifications at /root/kiwi/PROJECT.md, and the master plan at /root/kiwi/PLAN.md.
Also read the Challenger handoff reports for exact defect traces:
- /root/kiwi/.agents/teamwork_preview_challenger_m2_1/handoff.md
- /root/kiwi/.agents/teamwork_preview_challenger_m2_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You exclusively own and may edit:
- /root/kiwi/services/gateway/brain/client.go
- /root/kiwi/services/gateway/ws/hub.go
- /root/kiwi/services/gateway/kiwi-gateway (compiled binary)

Context & Defect to Fix:
During empirical challenge of Milestone 2, Challengers identified two related defects:
1. In services/gateway/brain/client.go (ChatStream): If the upstream SSE stream terminates prematurely (EOF without data: {"done": true}), it currently returns nil instead of an error. It must track whether "done" was received. If EOF occurs and done was NOT received and ctx.Err() == nil, return errors.New("stream closed prematurely before completion").
2. In services/gateway/ws/hub.go (around lines 346-353): When brain.ChatStream returns an error (and it was NOT caused by client disconnect streamCtx.Err() != nil), the gateway logs the error and silently exits. The client is left hanging on status.thinking forever. The gateway MUST send an error frame:
   c.send <- WSMessage{
       Type: "error",
       ConversationID: convID,
       Content: "Brain streaming failed: " + err.Error(),
   }
   Furthermore, when an error occurs, do NOT emit chat.complete and do NOT save truncated assistant responses to the database.

Verification Requirements:
1. Run go test -v ./...
   Ensure Challenger 1's test in services/gateway/ws/hub_empirical_challenge_test.go passes:
   - TestServeWS_BrainFailure_ErrorFrame (PASS)
   - TestServeWS_BrainMidStreamError_ErrorFrame (PASS)
2. Compile gateway: go build -o services/gateway/kiwi-gateway ./services/gateway
3. Restart PM2: pm2 restart kiwi-gateway
4. Run python3 scripts/test_ws_streaming.py
5. Document all verification outputs and diffs in /root/kiwi/.agents/teamwork_preview_worker_m2_gen2/handoff.md.
When complete, send a message back to the orchestrator.
