# Reviewer & Adversarial Critic Report: Milestone 1 (Go ↔ Python Bridge)

**Reviewer Agent**: `teamwork_preview_reviewer` (Reviewer 1)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_reviewer_m1_1`  
**Date**: 2026-09-21  
**Verdict**: **APPROVE** (Quality Score: 95/100, 0 Critical, 0 Major, 4 Minor non-blocking findings)

---

## 1. Observation

### 1.1 Toolchain & Process Supervision
- Running `pm2 status` shows both `kiwi-brain` and `kiwi-gateway` online and supervised under PM2:
  ```
  ┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
  │ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
  ├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
  │ 5  │ kiwi-brain         │ fork     │ 1    │ online    │ 0%       │ 101.1mb  │
  │ 4  │ kiwi-gateway       │ fork     │ 0    │ online    │ 0%       │ 15.4mb   │
  └────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
  ```
- Running `ss -tulpn | grep -E '8080|9100'` confirmed network isolation:
  ```
  tcp   LISTEN 0      2048                         127.0.0.1:9100       0.0.0.0:*    users:(("uvicorn",pid=765772,fd=7))
  tcp   LISTEN 0      4096                                 *:8080             *:*    users:(("kiwi-gateway",pid=764192,fd=4))
  ```
  The Python brain is bound exclusively to `127.0.0.1:9100` and is not reachable from external interfaces.

### 1.2 Automated Unit & Integration Tests
- Running Go tests (`cd /root/kiwi && go test -count=1 -v ./...`):
  ```
  === RUN   TestChat_Success
  --- PASS: TestChat_Success (0.01s)
  === RUN   TestChat_Unreachable
  --- PASS: TestChat_Unreachable (0.00s)
  === RUN   TestChat_ErrorStatus
  --- PASS: TestChat_ErrorStatus (0.00s)
  === RUN   TestHealth_Success
  --- PASS: TestHealth_Success (0.00s)
  === RUN   TestHealth_Failure
  --- PASS: TestHealth_Failure (0.00s)
  PASS
  ok  	kiwi/services/gateway/brain	0.024s
  ```
- Running Python Brain internal API tests (`cd /root/kiwi/services/orchestrator && .venv/bin/pytest tests/test_internal_api.py -v`):
  ```
  tests/test_internal_api.py::test_health_check PASSED                     [ 20%]
  tests/test_internal_api.py::test_internal_chat_empty_message_400 PASSED  [ 40%]
  tests/test_internal_api.py::test_internal_chat_returns_ai_response PASSED [ 60%]
  tests/test_internal_api.py::test_internal_chat_preserves_conversation_id PASSED [ 80%]
  tests/test_internal_api.py::test_kiwi_persona_structure PASSED           [100%]
  ========================= 5 passed, 1 warning in 2.00s =========================
  ```

### 1.3 Acceptance Endpoint Verification
- Executed acceptance command:
  ```bash
  curl -i -X POST http://127.0.0.1:8080/api/secure/chat \
    -H "Authorization: Bearer kiwi_secret_token_dev" \
    -H "Content-Type: application/json" \
    -d '{"message": "review test"}'
  ```
- Verbatim response (HTTP 200 OK):
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json
  Date: Sun, 20 Sep 2026 21:18:35 GMT
  Content-Length: 151

  {"conversation_id":"conv-20260921024835","response":"yo! kiwi here — received: 'review test'. all systems operational and ready to ship code! 🥝"}
  ```
- Executed health and ping probes:
  - `curl -s http://127.0.0.1:8080/health`: `{"status":"ok","message":"Kiwi API Gateway is running","version":"0.1.0","database":"disconnected","brain":"connected"}`
  - `curl -s -H "Authorization: Bearer kiwi_secret_token_dev" http://127.0.0.1:8080/api/secure/ping`: `{"message":"pong - authenticated successfully!"}`
  - `curl -s http://127.0.0.1:9100/health`: `{"status":"ok","service":"kiwi-brain","version":"0.1.0"}`

### 1.4 Code Implementation Inspection
- `services/gateway/brain/client.go`: Implements clean HTTP client with `Chat()`, `ChatWithContext()`, `Health()`, `HealthWithContext()`, 120s timeout, and JSON payload marshaling.
- `services/gateway/main.go`: Removed "Iteration 1 Dumb Echo Orchestrator". Uses `brain.ChatWithContext(ctx, brainReq)`. Dynamic fallback `convID` if client does not provide one. Health check queries `brain.HealthWithContext(r.Context())`.
- `services/gateway/db/chat.go`: `CreateConversation`, `InsertMessage`, and `GetMessages` check `if Pool == nil { return ..., ErrDatabaseNotConnected }`. In `InsertMessage`, background goroutine also checks `if Pool == nil { return }`.
- `services/gateway/db/db.go`: `InitDB()` checks `if dsn == ""` and safely logs a warning and returns `nil`.
- `services/orchestrator/persona/kiwi.py`: Implements `KIWI_SYSTEM_PROMPT`, `KIWI_PERSONA`, and `build_chat_prompt()`. Adheres to lowercase tone, technical metaphors, and dev puns.
- `services/orchestrator/api/server.py`: Implements `POST /internal/chat`, validates empty message (HTTP 400), validates kernel/router status (HTTP 503), connects to `MemoryEngine` for conversation history, executes `generate_with_fallback`, and returns conforming `InternalChatResponse`.
- `services/orchestrator/memory/memory_engine.py`: Supports `DATABASE_URL` with try/except fallback to in-memory dictionaries (`_in_memory_chats`, `_in_memory_knowledge`) and `degraded = True`. Multi-turn chat session history works seamlessly.
- `infra/supabase/migrations/002_synapse_tables.sql`: Migrations defined for `knowledge_graph`, `tasks`, `chat_sessions`, and `audit_log` with pgvector extension.
- `ecosystem.config.js`: Configures `kiwi-gateway` and `kiwi-brain` using `path.resolve` absolute paths and environment variable bindings.

---

## 2. Adversarial Stress-Testing & Integrity Check

### 2.1 Concurrency Stress Test
- Tested 10 and 25 simultaneous concurrent requests to `POST http://127.0.0.1:8080/api/secure/chat`:
  - 10 concurrent requests: 10/10 returned HTTP 200 OK (100% success rate).
  - 25 concurrent requests: 25/25 returned HTTP 200 OK (100% success rate).
  - Average latency under load: ~0.08s per request.

### 2.2 Auth Boundary Stress Test
- Missing `Authorization` header: returns `HTTP 401 Unauthorized` (`"Unauthorized - Missing token"`).
- Invalid token (`Authorization: Bearer wrong_token`): returns `HTTP 401 Unauthorized` (`"Unauthorized - Invalid token"`).
- Malformed header (`Authorization: InvalidHeader`): returns `HTTP 401 Unauthorized` (`"Unauthorized - Invalid token format"`).

### 2.3 Malformed Payload & Injection Stress Test
- Malformed JSON payload (`{"message": `): returns `HTTP 400 Bad Request` (`"Invalid request body"`).
- Non-string payload (`{"message": 12345}`): returns `HTTP 400 Bad Request` (`"Invalid request body"`).
- Special characters, unicode emojis, SQL injection strings, and HTML markup (`DROP TABLE users; -- \u0000 🥝 <script>`): safely processed and returned in persona response without server error or DB failure.
- Multi-turn conversation persistence: Sent sequential messages in session `test-memory-session-1`; confirmed `MemoryEngine` recorded user and assistant turns. Standalone unit test confirmed 100% fidelity.

### 2.4 Integrity Violation Assessment
- **Hardcoded test outputs**: Checked whether specific test messages were hardcoded in `server.py` or `client.go`. The development simulation fallback in `server.py` dynamically embeds `req.message.strip().lower()`. Arbitrary user inputs produce matching dynamic responses.
- **Dummy/facade implementations**: Both Go and Python communicate over actual HTTP sockets. Memory and DB failovers execute genuine local in-memory algorithms.
- **Task shortcuts / external delegation**: No external bypasses. All core Sprint 1 deliverables built in-repo.
- **Verification integrity**: All outputs and test logs independently generated and verified.
- **Integrity Verdict**: **PASS — NO INTEGRITY VIOLATIONS DETECTED.**

---

## 3. Findings

### [Minor] Finding 1: Gateway Semantic Mismatch on Empty Message (503 vs 400)
- **Where**: `services/gateway/main.go:71-75` and `services/gateway/brain/client.go:77-79`
- **What**: When a client sends an empty message `{"message": ""}`, the Go Gateway forwards it to the brain without validation. The Python brain returns HTTP 400 (`"Message cannot be empty"`), which `brain.Client` treats as an error (`"brain returned status 400"`). `main.go:chatHandler` then returns `HTTP 503 Service Unavailable` with `{"error": "Brain temporarily unavailable: brain returned status 400"}`.
- **Why**: Returning 503 implies the service is broken, whereas the client committed an input validation error.
- **Suggestion**: In `services/gateway/main.go`, check `if strings.TrimSpace(req.Message) == ""` and return `http.Error(w, "Message cannot be empty", http.StatusBadRequest)`.

### [Minor] Finding 2: Second-Level Resolution on Fallback Conversation ID
- **Where**: `services/gateway/main.go:89-91`
- **What**: If the database is disconnected and the client does not pass `conversation_id`, the fallback is `convID = "conv-" + time.Now().Format("20060102150405")`.
- **Why**: Two concurrent requests arriving within the exact same second will receive identical conversation IDs.
- **Suggestion**: Use nanosecond formatting or random suffix (e.g., `time.Now().Format("20060102150405.000000")` or UUID).

### [Minor] Finding 3: HTTP Client Allocation in Brain Health Check
- **Where**: `services/gateway/brain/client.go:102`
- **What**: `HealthWithContext()` creates `checkClient := &http.Client{Timeout: 3 * time.Second}` inside the function on every invocation.
- **Why**: Allocates a new client and transport on each health check probe rather than utilizing connection pooling.
- **Suggestion**: Define a package-level `healthHTTPClient` alongside `HTTPClient` in `Init()`.

### [Minor] Finding 4: ModelRouter Keyword Heuristic Bias
- **Where**: `services/orchestrator/models/model_router.py:80` & `services/orchestrator/persona/kiwi.py:8`
- **What**: `ModelRouter.decide_model` searches for `"code"` in the prompt to select Tier 2 (OpenRouter). Because `KIWI_SYSTEM_PROMPT` contains "you use code metaphors naturally", all prompts generated via `build_chat_prompt` match `"code"` and are routed to Tier 2 (OpenRouter) rather than Tier 1 (Gemini Flash).
- **Why**: In development simulation mode this is harmless, but in production with live API keys, basic chat prompts will route to OpenRouter instead of Gemini Flash.
- **Suggestion**: In `services/orchestrator/api/server.py`, pass `preferred_adapter="gemini"` or evaluate heuristics on `req.message` alone.

---

## 4. Logic Chain

1. **Requirement R1 Fulfillment**:
   - `services/gateway/brain/client.go` was created and implements the bridge to Synapse OS.
   - `services/gateway/main.go` was updated to replace Dumb Echo with `brain.ChatWithContext`.
   - `services/orchestrator/api/server.py` implemented `POST /internal/chat` and `/health`.
   - `services/orchestrator/persona/kiwi.py` implemented Kiwi persona system prompt and formatting.
   - Verified via `curl -X POST http://127.0.0.1:8080/api/secure/chat` which returned a valid, persona-formatted response.

2. **Fault Tolerance & DB Resilience**:
   - Go DB methods now check `if Pool == nil` to avoid nil pointer dereference panics.
   - Python `MemoryEngine` gracefully falls back to in-memory dictionaries when `DATABASE_URL` is empty.
   - Verified by starting the services without `DATABASE_URL`; health check reports `"database": "disconnected"` while chat and memory remain operational.

3. **Process Supervision**:
   - `ecosystem.config.js` properly specifies both `kiwi-gateway` and `kiwi-brain` using absolute paths.
   - Both processes are `online` in PM2 with 0 unexpected crashes under normal operation.
   - Network bindings verified: brain listens only on `127.0.0.1:9100`.

4. **Testing & Stress Compliance**:
   - Unit tests pass: 5/5 in Go `brain`, 5/5 in Python `test_internal_api.py`.
   - Adversarial tests pass: auth gating (401), invalid payloads (400), 25 concurrent requests (100% 200 OK).

---

## 5. Caveats

- `GEMINI_API_KEY`: External Gemini API key is currently unset in `/root/kiwi/.env`. System operates using Synapse OS's built-in simulation fallback engine. When a live key is added, live calls against Google's API will automatically activate.
- Supabase connection: `DATABASE_URL` is unset; services operate in graceful in-memory degraded mode. Once a live Supabase connection is added, pgx and psycopg2 connections will automatically initialize.
- Findings 1-4 are non-blocking and recommended for polish in Sprint 2.

---

## 6. Conclusion

Milestone 1 (Sprint 1: Go ↔ Python Bridge) meets all architectural, functional, and security requirements outlined in `PROJECT.md` and `PLAN.md`. There are zero integrity violations, zero regressions, and both unit and acceptance tests pass cleanly.

**Final Verdict**: **APPROVE**

---

## 7. Verification Method

To independently reproduce this verification:

1. **Verify Go Tests**:
   ```bash
   cd /root/kiwi && go test -count=1 -v ./...
   ```
   *Expected*: All 5 tests pass in `services/gateway/brain`.

2. **Verify Python Tests**:
   ```bash
   cd /root/kiwi/services/orchestrator && .venv/bin/pytest tests/test_internal_api.py -v
   ```
   *Expected*: All 5 tests pass in `test_internal_api.py`.

3. **Verify PM2 Process Status**:
   ```bash
   pm2 status
   ```
   *Expected*: `kiwi-gateway` and `kiwi-brain` are both `online`.

4. **Verify Gateway Acceptance Endpoint**:
   ```bash
   curl -i -X POST http://127.0.0.1:8080/api/secure/chat \
     -H "Authorization: Bearer kiwi_secret_token_dev" \
     -H "Content-Type: application/json" \
     -d '{"message": "review test"}'
   ```
   *Expected*: HTTP 200 OK with JSON containing `"response": "yo! kiwi here — received: 'review test'. all systems operational and ready to ship code! 🥝"`.

5. **Verify Security & Port Binding**:
   ```bash
   ss -tulpn | grep 9100
   ```
   *Expected*: Listen address is strictly `127.0.0.1:9100`.
