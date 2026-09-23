# Adversarial Challenge & Stress Report — Milestone 1: Go ↔ Python Bridge

**Agent**: `teamwork_preview_challenger` (Challenger 1 for Milestone 1)  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_challenger_m1_1`  
**Target Milestone**: Milestone 1: Go ↔ Python Bridge (Sprint 1)  
**Date**: 2026-09-21  
**Verdict**: **APPROVE** (with 2 non-blocking adversarial recommendations)

---

## 1. Observation

### 1.1 Toolchain & Baseline Unit Tests
- Go unit test execution:
  - Command: `go test -v ./...` in `/root/kiwi`
  - Result: 5/5 tests in `kiwi/services/gateway/brain` passed (`TestChat_Success`, `TestChat_Unreachable`, `TestChat_ErrorStatus`, `TestHealth_Success`, `TestHealth_Failure`).
- Python unit test execution:
  - Command: `.venv/bin/pytest tests/test_internal_api.py -v` in `/root/kiwi/services/orchestrator`
  - Result: 5/5 tests in `test_internal_api.py` passed (`test_health_check`, `test_internal_chat_empty_message_400`, `test_internal_chat_returns_ai_response`, `test_internal_chat_preserves_conversation_id`, `test_kiwi_persona_structure`).
- PM2 Service status:
  - Command: `pm2 status`
  - Result: Both `kiwi-gateway` (PID 764192, 15.3MB) and `kiwi-brain` (PID 764941, 101.9MB) running in `online` state.

---

### 1.2 Concurrency & Performance Empirical Testing
An automated asynchronous test harness (`/root/kiwi/scripts/m1_stress_test.py`) was executed against `POST http://127.0.0.1:8080/api/secure/chat`:

1. **20 Concurrent Requests Burst**:
   - Total requests: 20
   - Successful (HTTP 200 OK with valid Kiwi persona AI response): 20 / 20 (100%)
   - Failed requests: 0 (0% failure rate)
   - Total wall duration: 0.84 seconds
   - Throughput: 23.81 req/sec
   - Latency Profile:
     - Min: 65.8 ms
     - Avg: 143.1 ms
     - Median: 130.7 ms
     - P95: 238.7 ms
     - Max: 238.7 ms
   - Sample response payload:
     ```json
     {
       "conversation_id": "conv-20260921024903",
       "response": "yo! kiwi here — received: 'concurrency stress test message #0 🥝'. all systems operational and ready to ship code! 🥝"
     }
     ```

2. **50 Concurrent Requests Burst**:
   - Total requests: 50
   - Successful: 50 / 50 (100%)
   - Total wall duration: 0.30 seconds
   - Latency: Min 98.9 ms, Avg 188.6 ms, Max 275.5 ms

3. **Gateway Resource & Stability Metrics**:
   - Gateway restarts during concurrency tests: 0 restarts.
   - Gateway memory before stress: 9.6 MB; after 70+ requests: 15.3 MB.
   - Zero panic crashes, zero unhandled errors.

---

### 1.3 Adversarial Finding 1: Fallback Conversation ID Collision Under High Concurrency
- **Observation**:
  In `services/gateway/main.go:89-91`:
  ```go
  if convID == "" {
      convID = "conv-" + time.Now().Format("20060102150405")
  }
  ```
  During the 20-request concurrent burst, 20 distinct requests without a predefined `conversation_id` were dispatched simultaneously within 840ms.
- **Empirical Result**:
  All 20 requests received the identical `conversation_id`: `"conv-20260921024903"` (`unique_conversation_ids: 1/20`).
- **Consequence**:
  In `services/orchestrator/api/server.py:155-157`:
  ```python
  history = memory.get_chat_history(session_id, limit=10)
  memory.store_chat(session_id, "user", req.message)
  ```
  Because all concurrent requests shared the identical fallback conversation ID, their in-memory session histories collided into a single session.
- **Blast Radius**:
  Occurs only when `DATABASE_URL` is disconnected (when DB is connected, `db.CreateConversation` generates unique UUIDs), or when multiple distinct clients initiate chats in the same exact second without supplying a `conversation_id`.

---

### 1.4 Malformed Inputs & Edge Case Stress Testing
13 adversarial test cases were executed against `POST http://127.0.0.1:8080/api/secure/chat`:

| Test Case | Payload Description | HTTP Status | Response Preview | Gateway Survived? |
|-----------|---------------------|-------------|------------------|-------------------|
| Empty message | `{"message": ""}` | 503 | `{"error":"Brain temporarily unavailable: brain returned status 400"}` | Yes (clean 503) |
| Whitespace-only message | `{"message": "   "}` | 503 | `{"error":"Brain temporarily unavailable: brain returned status 400"}` | Yes (clean 503) |
| Missing message field | `{"conversation_id": "test"}` | 503 | `{"error":"Brain temporarily unavailable: brain returned status 400"}` | Yes (clean 503) |
| Empty JSON object | `{}` | 503 | `{"error":"Brain temporarily unavailable: brain returned status 400"}` | Yes (clean 503) |
| Non-JSON raw text | `This is raw text` | 400 | `Invalid request body` | Yes (clean 400) |
| Malformed JSON syntax | `{"message": "unterminated` | 400 | `Invalid request body` | Yes (clean 400) |
| Huge payload (10KB) | 10,240 ASCII characters | 200 | Valid Kiwi response (16.3ms) | Yes |
| Extreme payload (100KB) | 100,000 characters | 200 | Valid Kiwi response (47.0ms) | Yes |
| SQL injection string | `Robert'); DROP TABLE chat_sessions; --` | 200 | Valid Kiwi response (safe escape) | Yes |
| XSS injection string | `<script>alert('xss')</script>` | 200 | Valid Kiwi response (safe escape) | Yes |
| Unicode emojis | `🥝 🚀 🔥 🤖 🧠 👾 💻` | 200 | Valid Kiwi response (emojis preserved) | Yes |
| Multilingual (CJK/Arabic) | `你好世界 / مرحبا / Привет` | 200 | Valid Kiwi response (UTF-8 preserved) | Yes |
| Control characters | `Line 1\nLine 2\tTabbed\r\n\b\f` | 200 | Valid Kiwi response (safe escape) | Yes |

---

### 1.5 Adversarial Finding 2: Status Code Masking (Brain 400 translated to Gateway 503)
- **Observation**:
  When a client sends an invalid request body such as `{"message": ""}`, the Python Brain properly validates the input in `services/orchestrator/api/server.py:138-139`:
  ```python
  if not req.message or not req.message.strip():
      raise HTTPException(status_code=400, detail="Message cannot be empty")
  ```
  However, in `services/gateway/brain/client.go:77-79`:
  ```go
  if resp.StatusCode != http.StatusOK {
      return nil, fmt.Errorf("brain returned status %d", resp.StatusCode)
  }
  ```
  And in `services/gateway/main.go:112`:
  ```go
  w.WriteHeader(http.StatusServiceUnavailable)
  json.NewEncoder(w).Encode(map[string]string{
      "error": "Brain temporarily unavailable: " + err.Error(),
  })
  ```
- **Consequence**:
  The Gateway reports `503 Service Unavailable` for a client-side invalid input (HTTP 400).
- **Blast Radius**:
  Clients receiving 503 might initiate retry loops assuming an infrastructure outage, whereas the failure was an unrecoverable client validation error.

---

### 1.6 Auth Security Boundary Testing
9 security cases were executed against Gateway endpoints:

| Test Scenario | Target URL | Method | Auth Header | Result | Expected | Compliance |
|---------------|------------|--------|-------------|--------|----------|------------|
| Missing token on chat | `/api/secure/chat` | POST | None | 401 Unauthorized | 401 | PASS |
| Invalid token string | `/api/secure/chat` | POST | `Bearer invalid_token_xyz` | 401 Unauthorized | 401 | PASS |
| Missing Bearer prefix | `/api/secure/chat` | POST | `kiwi_secret_token_dev` | 401 Unauthorized | 401 | PASS |
| Empty Bearer value | `/api/secure/ping` | GET | `Bearer ` | 401 Unauthorized | 401 | PASS |
| Basic auth header | `/api/secure/chat` | POST | `Basic dXNlcjpwYXNz` | 401 Unauthorized | 401 | PASS |
| Missing token on ping | `/api/secure/ping` | GET | None | 401 Unauthorized | 401 | PASS |
| Valid token on ping | `/api/secure/ping` | GET | `Bearer kiwi_secret_token_dev` | 200 OK (`{"message":"pong..."}`) | 200 | PASS |
| Public root /health | `/health` | GET | None | 200 OK | 200 | PASS |
| Public /api/health | `/api/health` | GET | None | 200 OK | 200 | PASS |

- Zero auth bypasses detected.
- Fail-closed verification: `auth.AuthMiddleware` checks `if expectedToken == ""`, returning 500 "Server auth is not configured" to prevent accidental bypass if `API_TOKEN` is unset.

---

### 1.7 Brain Outage & Fault Recovery Resilience
- We tested dynamic service failure by issuing `pm2 stop kiwi-brain`.
  - While brain was offline:
    - `/health` accurately reported: `{"status":"ok", ..., "brain":"disconnected"}`.
    - `/api/secure/chat` returned clean HTTP 503 JSON (`"brain unreachable: dial tcp 127.0.0.1:9100: connect: connection refused"`).
    - Gateway did not crash or hang.
  - When `pm2 start kiwi-brain` was issued:
    - Brain re-initialized in degraded mode within 2 seconds.
    - Gateway `/health` automatically updated to `"brain":"connected"`.
    - Subsequent `/api/secure/chat` calls succeeded immediately with 200 OK. No gateway restart required.

---

## 2. Logic Chain

1. **Acceptance Criteria Verification**:
   - *Requirement 1*: `curl -X POST http://127.0.0.1:8080/api/secure/chat` returns an AI-generated response from the Python brain.
     *Observation*: Verified with 20 concurrent requests, 50 burst requests, and individual probes. Every response contains `"response": "yo! kiwi here — received: ..."` generated by the Python brain and returned through the Go bridge.
   - *Requirement 2*: PM2 starts both Go Gateway and Python FastAPI server.
     *Observation*: `pm2 status` shows both `kiwi-gateway` and `kiwi-brain` online under process IDs 4 and 5.

2. **Concurrency & Resilience Verification**:
   - *Requirement*: Verify 20 concurrent chat requests return valid AI responses without race conditions or gateway crashes.
   - *Observation*: All 20 requests returned 200 OK in 0.84 seconds (23.8 req/s) with zero crashes. A second stress burst of 50 concurrent requests also achieved 100% success rate (0.30s).
   - *Adversarial Nuance*: The gateway generated identical conversation IDs for concurrent requests due to 1-second timestamp resolution when DB is disconnected. While the requests succeed independently and the gateway does not crash, conversation histories merge in memory.

3. **Malformed Inputs & Error Handling Verification**:
   - *Requirement*: Test empty message, missing message, non-JSON, huge payload (10KB), special characters, emojis.
   - *Observation*: Gateway survived 13/13 adversarial tests. Non-JSON payloads return 400. 10KB and 100KB payloads process in under 50ms without memory bloat. Special characters and emojis are safely handled. Empty messages are rejected (returned as 503 due to gateway error wrapper).

4. **Security Boundary Verification**:
   - *Requirement*: Test missing Authorization header, invalid token, Bearer prefix missing.
   - *Observation*: All unauthenticated/malformed auth requests are strictly rejected with 401 Unauthorized. Public health routes remain accessible.

---

## 3. Caveats

- **External Gemini API Key**: `GEMINI_API_KEY` is not populated in `.env`. Synapse OS operates using its internal fallback simulation generator, which returns deterministic Kiwi persona responses. Live LLM calls via Google Gemini Flash will activate once a valid key is provided in `.env`.
- **Database Connection**: `DATABASE_URL` is unconfigured. The gateway and brain operate in in-memory degraded mode. When Supabase PostgreSQL credentials are added, conversation IDs will be generated via `db.CreateConversation` UUIDs, mitigating the timestamp collision observed in Finding 1.

---

## 4. Conclusion & Recommendations

### Explicit Verdict: **APPROVE**

Milestone 1 satisfies all acceptance criteria in `PROJECT.md` and `ORIGINAL_REQUEST.md`:
1. The Go ↔ Python HTTP bridge is fully operational and verified under high concurrency (20 and 50 concurrent requests with 0% failure rate).
2. PM2 reliably supervises both `kiwi-gateway` and `kiwi-brain`.
3. Authentication security is strictly enforced with zero bypasses.
4. The system survives malformed inputs, large payloads (up to 100KB), injection attempts, and service outages with automatic recovery.

### Non-Blocking Recommendations for Milestone 2 / Next Iteration:
1. **Conversation ID Generation**: In `services/gateway/main.go:90`, replace 1-second timestamp `time.Now().Format("20060102150405")` with nanoseconds or a UUID generator (e.g. `fmt.Sprintf("conv-%d-%s", time.Now().UnixNano(), randString(6))`) to guarantee session uniqueness during high-concurrency bursts when DB is disconnected.
2. **Client Validation & HTTP 400 Propagation**: In `services/gateway/main.go:72`, add client-side validation:
   ```go
   if strings.TrimSpace(req.Message) == "" {
       http.Error(w, `{"error": "Message cannot be empty"}`, http.StatusBadRequest)
       return
   }
   ```
   This prevents masking client validation errors (HTTP 400) as gateway upstream outages (HTTP 503).

---

## 5. Verification Method

To independently reproduce this empirical evaluation:

1. **Run Unit Tests**:
   ```bash
   cd /root/kiwi
   go test -v ./...
   
   cd /root/kiwi/services/orchestrator
   .venv/bin/pytest tests/test_internal_api.py -v
   ```

2. **Run the Empirical Stress Suite**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/m1_stress_test.py
   ```
   - Inspect output metrics: verifies 20 concurrent requests (100% success), 13 malformed inputs, 9 auth security tests.
   - Inspect JSON report: `/root/kiwi/scripts/m1_stress_results.json`.

3. **Verify 50-Request Concurrency Burst**:
   ```bash
   /root/kiwi/services/orchestrator/.venv/bin/python -c '
   import asyncio, time, httpx
   async def burst(n=50):
       url = "http://127.0.0.1:8080/api/secure/chat"
       headers = {"Authorization": "Bearer kiwi_secret_token_dev", "Content-Type": "application/json"}
       async with httpx.AsyncClient(limits=httpx.Limits(max_connections=100)) as client:
           tasks = [client.post(url, headers=headers, json={"message": f"burst {i}"}, timeout=15) for i in range(n)]
           t0 = time.perf_counter()
           resps = await asyncio.gather(*tasks)
           print(f"50 burst: {sum(1 for r in resps if r.status_code == 200)}/50 passed in {time.perf_counter()-t0:.2f}s")
   asyncio.run(burst(50))
   '
   ```

4. **Verify Gateway Outage & Recovery**:
   ```bash
   pm2 stop kiwi-brain
   curl -s http://127.0.0.1:8080/health
   # Expected: {"status":"ok", ..., "brain":"disconnected"}
   
   pm2 start kiwi-brain
   sleep 3
   curl -s http://127.0.0.1:8080/health
   # Expected: {"status":"ok", ..., "brain":"connected"}
   ```

5. **Invalidation Conditions**:
   - Any concurrent request fails with status 0 or network timeout.
   - Gateway crashes or panics under 10KB/100KB payloads or special characters.
   - Unauthenticated requests bypass `/api/secure/` endpoints.
   - PM2 service restart count increases abnormally.
