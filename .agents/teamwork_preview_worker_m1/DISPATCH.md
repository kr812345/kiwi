## 2026-09-20T21:08:16Z
You are teamwork_preview_worker (Milestone 1 Worker - Go ↔ Python Bridge).
Your working directory is: /root/kiwi/.agents/teamwork_preview_worker_m1
Parent Orchestrator Conv ID: 61906bc7-6cc0-4500-84df-f0a2171b46ad

MANDATORY FIRST STEP: Read the original user request at /root/kiwi/.agents/ORIGINAL_REQUEST.md, the project specifications at /root/kiwi/PROJECT.md, and the master plan at /root/kiwi/PLAN.md.
Also read the survey handoff reports for complete blueprints and code details:
- /root/kiwi/.agents/teamwork_preview_explorer_survey_1/handoff.md (Gateway & Toolchain)
- /root/kiwi/.agents/teamwork_preview_explorer_survey_2/handoff.md (Synapse Brain & Memory Engine)
- /root/kiwi/.agents/teamwork_preview_spec_miner_survey_3/handoff.md (Exact Schemas & Migrations)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You exclusively own and may edit:
- /root/kiwi/services/orchestrator/persona/
- /root/kiwi/services/orchestrator/api/server.py
- /root/kiwi/services/orchestrator/memory/memory_engine.py
- /root/kiwi/services/orchestrator/boot.py
- /root/kiwi/services/orchestrator/.venv/pyvenv.cfg
- /root/kiwi/services/gateway/brain/
- /root/kiwi/services/gateway/main.go
- /root/kiwi/services/gateway/db/chat.go
- /root/kiwi/infra/supabase/migrations/002_synapse_tables.sql
- /root/kiwi/ecosystem.config.js
- /root/kiwi/services/gateway/kiwi-gateway (compiled binary)
- /root/kiwi/.env

Your Tasks for Milestone 1 (Sprint 1: Go ↔ Python Bridge):
1. Environment & Toolchain:
   - Install Go 1.22: apt-get update && apt-get install -y golang-go
   - Configure Python venv: set include-system-site-packages = true in /root/kiwi/services/orchestrator/.venv/pyvenv.cfg (or ensure uvicorn and fastapi import cleanly in .venv)
   - Create .env in /root/kiwi/ with PORT=8080, API_TOKEN, BRAIN_URL=http://127.0.0.1:9100.
2. Python Brain (Synapse OS):
   - Create services/orchestrator/persona/__init__.py and persona/kiwi.py with KIWI_SYSTEM_PROMPT and build_chat_prompt().
   - In services/orchestrator/api/server.py: add POST /internal/chat with InternalChatRequest and InternalChatResponse models, executing synchronous reasoning with Kiwi persona through ModelRouter and storing turns in MemoryEngine.
   - In services/orchestrator/memory/memory_engine.py and boot.py: read DATABASE_URL env var and wrap DB connection in try/except to gracefully enter in-memory degraded mode if connection fails.
   - Create infra/supabase/migrations/002_synapse_tables.sql for knowledge_graph, tasks, chat_sessions, audit_log.
3. Go API Gateway:
   - Create services/gateway/brain/client.go implementing Chat() and Health() calling http://127.0.0.1:9100/internal/chat with 120s timeout and error handling.
   - In services/gateway/main.go: replace dumb echo in chatHandler with brain.Chat(brainReq). Update healthCheckHandler to probe brain status.
   - In services/gateway/db/chat.go: add nil checks on Pool to avoid panics when DB is not connected.
4. Process Management:
   - Update ecosystem.config.js to define both kiwi-gateway and kiwi-brain.
   - Build Go gateway binary: cd /root/kiwi && go build -o services/gateway/kiwi-gateway ./services/gateway
   - Start or restart PM2: pm2 start ecosystem.config.js
5. Verification:
   - Run go test ./... and python tests if applicable.
   - Verify PM2 status: pm2 list shows both kiwi-gateway and kiwi-brain online.
   - Run acceptance test:
     curl -X POST http://127.0.0.1:8080/api/secure/chat -H "Authorization: Bearer <API_TOKEN>" -H "Content-Type: application/json" -d '{"message": "hello kiwi"}'
     Verify it returns an AI-generated response from the Python brain (Kiwi persona), not Dumb Echo.
   - Document all verification commands, outputs, and status.
