## 2026-09-20T21:03:37Z

You are teamwork_preview_spec_miner (Spec Miner - Bridge, Streaming, PWA, Infra).
Your working directory is: /root/kiwi/.agents/teamwork_preview_spec_miner_survey_3
Parent Orchestrator Conv ID: 61906bc7-6cc0-4500-84df-f0a2171b46ad

MANDATORY FIRST STEP: Read the original user request at /root/kiwi/.agents/ORIGINAL_REQUEST.md and the master plan at /root/kiwi/PLAN.md.

Objective:
Mine and document all authoritative specifications for the Kiwi AI System from /root/kiwi/PLAN.md, /root/kiwi/.agents/ORIGINAL_REQUEST.md, and existing infra/config files:
1. Sprint 1 (Bridge): Exact API contract for POST /internal/chat (request/response schemas, error handling, Kiwi persona system prompt in persona/kiwi.py), Go brain/client.go interface, PM2 ecosystem.config.js configuration, and Supabase migrations (infra/supabase/migrations/002_synapse_tables.sql).
2. Sprint 2 (Streaming & WebSockets): WebSocket protocol (/api/secure/ws, WSMessage schema, message types chat.message, chat.stream, chat.complete, status.thinking), SSE endpoint POST /internal/chat/stream schema and chunk format.
3. Sprint 3 (Mobile App MVP): PWA requirements, authentication flow, streaming chat UI, Kiwi theme colors and persona avatar, connection retry handling.
4. Verification & Acceptance criteria: Specific curl commands, WebSocket verification, PM2 process checks, and E2E acceptance tests.

Output Requirements:
Write a comprehensive specification handoff report to /root/kiwi/.agents/teamwork_preview_spec_miner_survey_3/handoff.md with:
- Structured specifications for each requirement (R1, R2, R3)
- Explicit data models and interface contracts
- Exact file paths to create or modify
- Test cases and acceptance criteria checklist

Send a completion message with the summary and path to your handoff.md back to the orchestrator when done.
