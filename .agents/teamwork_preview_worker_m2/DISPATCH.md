## 2026-09-20T21:22:12Z

You are teamwork_preview_worker (Milestone 2 Worker - Streaming & WebSockets).
Your working directory is: /root/kiwi/.agents/teamwork_preview_worker_m2
Parent Orchestrator Conv ID: 61906bc7-6cc0-4500-84df-f0a2171b46ad

MANDATORY FIRST STEP: Read the original user request at /root/kiwi/.agents/ORIGINAL_REQUEST.md, the project specifications at /root/kiwi/PROJECT.md, and the master plan at /root/kiwi/PLAN.md.
Also read the Milestone 1 Worker's handoff report at /root/kiwi/.agents/teamwork_preview_worker_m1/handoff.md and Spec Miner report at /root/kiwi/.agents/teamwork_preview_spec_miner_survey_3/handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You exclusively own and may edit:
- /root/kiwi/services/gateway/ws/
- /root/kiwi/services/gateway/brain/client.go
- /root/kiwi/services/gateway/brain/client_test.go
- /root/kiwi/services/gateway/main.go
- /root/kiwi/services/orchestrator/api/server.py
- /root/kiwi/services/orchestrator/models/model_router.py
- /root/kiwi/services/orchestrator/models/adapters/
- /root/kiwi/services/orchestrator/tests/
- /root/kiwi/services/gateway/kiwi-gateway (compiled binary)

Your Tasks for Milestone 2 (Sprint 2: Streaming & WebSockets):
1. Python Brain SSE Streaming:
   - In services/orchestrator/models/model_router.py and adapters: add async def stream_generate(prompt: str, system: Optional[str] = None) generator yielding token chunks. In simulation mode (or when API key is unset), split the response into words/tokens and yield sequentially with small delay (e.g., 20-30ms).
   - In services/orchestrator/api/server.py: implement POST /internal/chat/stream returning StreamingResponse(media_type="text/event-stream").
     Protocol:
     data: {"token": "chunk"}\n\n
     ...
     data: {"done": true}\n\n
   - Write unit tests in services/orchestrator/tests/test_streaming.py.
2. Go Gateway WebSocket Hub & Authentication:
   - Implement services/gateway/ws/hub.go using gorilla/websocket (add to go.mod / go.sum).
   - Implement Hub, Client, readPump, writePump, and connection manager.
   - Message schema WSMessage:
     Type: "auth" | "chat.message" | "chat.stream" | "chat.complete" | "status.thinking" | "status.tool_call"
     ConversationID: string
     Content: string
     Metadata: any
   - Support authentication during upgrade: Bearer header OR ?token=<API_TOKEN> query param OR initial auth frame {"type": "auth", "content": "<API_TOKEN>"} within 5 seconds.
   - Register route at /api/secure/ws in services/gateway/main.go.
3. Go Gateway SSE Consumer & WebSocket Relay:
   - In services/gateway/brain/client.go: add ChatStream(ctx, req, chunkCallback) which connects to /internal/chat/stream, reads SSE lines, and invokes the callback for each token.
   - When a WebSocket client sends chat.message:
     - Gateway emits status.thinking frame to client.
     - Gateway calls brain.ChatStream and sends chat.stream frames for each received token in real time.
     - Upon completion, gateway sends chat.complete frame with the full concatenated response, and saves the conversation turn in DB/memory.
     - Handle client disconnect gracefully: cancel context to abort upstream Python SSE stream.
4. Also address M1 Reviewer recommendations:
   - In main.go / chatHandler, return HTTP 400 Bad Request if strings.TrimSpace(req.Message) == "".
   - Use nanosecond or UUID formatting for fallback conversation IDs to prevent collisions.
5. Build & Process Management:
   - Compile Go gateway: go build -o services/gateway/kiwi-gateway ./services/gateway
   - Restart PM2: pm2 restart all
   - Verify both processes are online.
6. Verification & Automated Tests:
   - Run go test -v ./...
   - Run pytest tests/test_streaming.py -v
   - Write a python or shell test script to connect to ws://127.0.0.1:8080/api/secure/ws, send a chat.message, and verify receiving status.thinking, individual chat.stream token frames, and chat.complete.
   - Document all verification steps, outputs, and status in your report.

Output Requirements:
Write your complete report to /root/kiwi/.agents/teamwork_preview_worker_m2/handoff.md following the Handoff Protocol.
When complete, send a message back to the orchestrator.
