# Go API Gateway Exploration & Architectural Handoff Report

**Agent**: `teamwork_preview_explorer` (Codebase Explorer - Go Gateway)  
**Target Path**: `/root/kiwi/services/gateway` & project root `/root/kiwi`  
**Parent Orchestrator**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  
**Date**: 2026-09-21  

---

## 1. Observation

### 1.1 Repository Structure & Go Module
- **Module Definition** (`/root/kiwi/go.mod`):
  ```go
  module kiwi

  go 1.22

  require (
      github.com/jackc/pgpassfile v1.0.0 // indirect
      github.com/jackc/pgservicefile v0.0.0-20221227161230-091c0ba34f0a // indirect
      github.com/jackc/pgx/v5 v5.5.0
      github.com/jackc/puddle/v2 v2.2.1 // indirect
      golang.org/x/crypto v0.17.0 // indirect
      golang.org/x/sync v0.1.0 // indirect
      golang.org/x/text v0.14.0 // indirect
  )
  ```
- **Checksums**: No `go.sum` file exists in the repository.
- **Test Files**: Zero `*_test.go` files exist in `/root/kiwi` or `/root/kiwi/services/gateway`.
- **Pre-compiled Binary**: No compiled `kiwi-gateway` binary exists in `/root/kiwi/services/gateway/`.

### 1.2 Host System Environment & Missing Tooling
- **Go Compiler**: Running `go version` produces:
  ```
  bash: line 1: go: command not found
  ```
  Apt package inspection via `apt-cache policy golang-go` confirms Ubuntu Noble (24.04) has `golang-go 2:1.22~2build1` available, but status is `Installed: (none)`.
- **Python Virtualenv**: `/root/kiwi/services/orchestrator/.venv` has only 19 packages installed (`pytest`, `pydantic`, `psycopg2-binary`). Running `/root/kiwi/services/orchestrator/.venv/bin/python -c "import uvicorn; import fastapi"` fails with:
  ```
  ModuleNotFoundError: No module named 'uvicorn'
  ```
  `services/orchestrator/requirements.txt` contains `uvicorn==0.52.3` and `fastapi==0.141.1`, but they have not yet been installed into `.venv`.
- **Network / Proxy**: `proxy.golang.org` was tested via HTTP request and is accessible (returns `HTTP/2 200`).
- **Active Ports & PM2**:
  - `pm2 status` shows 3 existing services (`anonchat-bot`, `anonchat-dashboard`, `upcheck-backend`). Neither `kiwi-gateway` nor `kiwi-brain` is running.
  - `ss -tulpn` confirms Port 8080 and Port 9100 are completely free.
  - Caddy is listening on Port 80 and 443.
  - No `.env` file exists at `/root/kiwi/.env`.

### 1.3 Entry Point & Route Registration (`services/gateway/main.go`)
- **Route Multiplexing** (`main.go:117-139`):
  ```go
  mux := http.NewServeMux()
  apiMux := http.NewServeMux()
  apiMux.HandleFunc("/health", healthCheckHandler)

  protectedMux := http.NewServeMux()
  protectedMux.HandleFunc("/ping", pingHandler)
  protectedMux.HandleFunc("/chat", chatHandler)

  apiMux.Handle("/secure/", http.StripPrefix("/secure", auth.AuthMiddleware(protectedMux)))
  mux.Handle("/api/", http.StripPrefix("/api", apiMux))
  mux.HandleFunc("/health", healthCheckHandler)
  ```
  - `/health` and `/api/health` are public.
  - `/api/secure/ping` and `/api/secure/chat` pass through `auth.AuthMiddleware`.
- **Server Lifecycle** (`main.go:140-171`):
  - Reads `PORT` env var (default: `8080`).
  - Listens on `":8080"`.
  - Captures `SIGINT` and `SIGTERM` for graceful shutdown with a 5-second timeout.

### 1.4 Chat Handler Current Implementation (`services/gateway/main.go:56-108`)
- **Current Flow**:
  1. Validates HTTP POST.
  2. Parses JSON body into `ChatRequest{ConversationID, Message}`.
  3. If `convID == ""`, calls `db.CreateConversation(ctx, "New Chat")`.
  4. Stores user message: `db.InsertMessage(ctx, convID, "user", req.Message)`.
  5. **Echo response generation**:
     ```go
     echoResponse := "Echo: I heard you say '" + req.Message + "'"
     ```
  6. Stores assistant message: `db.InsertMessage(ctx, convID, "assistant", echoResponse)`.
  7. Returns JSON `ChatResponse{ConversationID: convID, Response: echoResponse}`.

### 1.5 Authentication Middleware (`services/gateway/auth/middleware.go`)
- Reads `API_TOKEN` from environment.
- If `API_TOKEN == ""`, immediately returns `500 Server auth is not configured`.
- Inspects `Authorization` header:
  - Must equal `Bearer <API_TOKEN>`.
  - Missing or malformed returns `401 Unauthorized`.
- **Critical WebSocket Observation**: Standard WebSocket clients (e.g. browser `new WebSocket(...)`, React Native) cannot set arbitrary HTTP request headers like `Authorization` during the HTTP Upgrade handshake.

### 1.6 Database Integration & Defect Surface (`services/gateway/db/`)
- **Connection** (`db/db.go:16-46`):
  - Connects to Supabase PostgreSQL using `DATABASE_URL`.
  - If `DATABASE_URL` is empty:
    ```go
    if dsn == "" {
        log.Println("Warning: DATABASE_URL is not set. Skipping Supabase DB connection.")
        return nil
    }
    ```
    `Pool` remains `nil`.
- **Panic Defect** (`db/chat.go:27-46`):
  - `CreateConversation`: executes `Pool.QueryRow(...)` directly.
  - `InsertMessage`: executes `Pool.QueryRow(...)` and background `Pool.Exec(...)`.
  - If `Pool == nil`, any invocation panics with runtime error: `invalid memory address or nil pointer dereference`, taking down the server.
- **Schema Alignment** (`infra/supabase/migrations/001_initial_schema.sql`):
  - Tables: `conversations` (id UUID PK, title TEXT, created_at, updated_at) and `messages` (id UUID PK, conversation_id UUID FK, role role_type ENUM, content TEXT, metadata JSONB, created_at).
  - Role enum supports `'user'`, `'assistant'`, `'system'`, `'tool'`.

### 1.7 Process Management & Deployment (`ecosystem.config.js` & `.github/workflows/deploy.yml`)
- `ecosystem.config.js`:
  ```javascript
  module.exports = {
    apps: [{
      name: "kiwi-gateway",
      script: "./services/gateway/kiwi-gateway",
      instances: 1,
      exec_mode: "fork",
      env: { PORT: 8080, NODE_ENV: "development" },
      env_production: { PORT: 8080, NODE_ENV: "production" }
    }]
  }
  ```
- `.github/workflows/deploy.yml`:
  ```bash
  cd services/gateway
  go build -o kiwi-gateway main.go
  cd ../../
  pm2 reload ecosystem.config.js --env production
  ```
  Note: `deploy.yml` compiles inside `services/gateway` targeting `main.go`. In a root-level module `module kiwi`, compiling `main.go` works because Go traverses upwards to find `go.mod`, but compiling `./...` or running from repo root is more reliable.

---

## 2. Logic Chain

1. **Missing Toolchain Blockers**:
   - Because `go` is not installed on the system, executing `go build` or `go test` fails with code 127.
   - Because `uvicorn` and `fastapi` are not installed in `services/orchestrator/.venv`, starting the Python brain fails with `ModuleNotFoundError`.
   - *Inference*: Prerequisites must be satisfied before any live testing or PM2 process startup can succeed.

2. **Go ↔ Python FastAPI Bridge (Sprint 1)**:
   - In `main.go:91-100`, the echo response must be replaced by calling the Python brain.
   - The Python brain will run on `127.0.0.1:9100` (internal only, not exposed via Caddy or public IP).
   - In Go, a new package `services/gateway/brain` (`client.go`) is needed:
     - Defines `type ChatRequest struct { Message, ConversationID, SessionID string }`
     - Defines `type ChatResponse struct { Response, ConversationID, ModelUsed string; CostUSD float64 }`
     - Uses standard `http.Client` with configurable timeout (e.g., 90s-120s) and base URL `BRAIN_URL` (default `http://127.0.0.1:9100`).
   - If the Python brain is unreachable or returns a non-200 status, Go Gateway must catch the error and return `503 Service Unavailable` with a structured JSON error instead of crashing.

3. **WebSocket Hub & Streaming (Sprint 2)**:
   - To stream LLM tokens to the mobile app, Go needs a WebSocket server (`services/gateway/ws/hub.go`), requiring `github.com/gorilla/websocket`.
   - Because client-side WebSocket APIs cannot easily set the `Authorization: Bearer <TOKEN>` header, authentication cannot rely solely on the existing `auth.AuthMiddleware`.
   - *Inference*: The gateway must support WebSocket authentication either by checking `r.URL.Query().Get("token")` during handshake, or by accepting an initial `{ "type": "auth", "token": "..." }` message within 5 seconds of connection before allowing chat traffic.
   - For streaming tokens, Python FastAPI will expose `POST /internal/chat/stream` returning `text/event-stream`. The Go Gateway will consume this SSE stream using a `bufio.Scanner` and relay chunks as WebSocket frames (`chat.stream`) to the connected client.

4. **Database Resilience & Fallback**:
   - Because `Pool` can be `nil` when `DATABASE_URL` is omitted, and network issues with external Supabase can occur, functions in `db/chat.go` must perform nil-checks on `Pool`.
   - If `Pool == nil`, operations should return a specific error (`ErrDatabaseNotConnected`) allowing the gateway to run in degraded in-memory mode or return a clean HTTP 503 instead of panicking.

5. **PM2 & Networking Orchestration**:
   - `ecosystem.config.js` currently only manages `kiwi-gateway` and expects the binary at `./services/gateway/kiwi-gateway`.
   - PM2 must be updated to manage both `kiwi-gateway` and `kiwi-brain` (`.venv/bin/uvicorn api.server:app --host 127.0.0.1 --port 9100`).
   - Caddy is already correctly configured to proxy `:80` to `127.0.0.1:8080`.

---

## 3. Caveats & Risks

1. **Uninstalled Go Environment**:
   The Go compiler is not present on this machine. Running `go test` or `go build` cannot be performed directly until `golang-go` or Go 1.22+ is installed via `apt-get` or official tarball.
2. **Python Virtual Environment State**:
   The existing virtual environment in `/root/kiwi/services/orchestrator/.venv` has only testing packages installed. Running `uvicorn` will fail until `pip install -r requirements.txt` is run.
3. **Absence of Go Tests**:
   There are currently zero unit or integration tests in `services/gateway`. Any changes to `main.go`, `auth`, or `db` risk regressions unless automated tests are introduced.
4. **WebSocket Authentication Mismatch**:
   If `/api/secure/ws` is placed under `apiMux.Handle("/secure/", auth.AuthMiddleware(...))`, mobile and browser WebSocket handshakes will fail with `401 Unauthorized` because WebSocket clients cannot attach Bearer headers during the HTTP upgrade.
5. **Missing `.env`**:
   No `.env` file exists in `/root/kiwi/`. Without `API_TOKEN`, the gateway rejects all secure requests with 500. Without `DATABASE_URL`, the gateway runs with `db.Pool == nil` and panics on chat requests.

---

## 4. Conclusion & Recommendations

### Implementation Blueprint for Sprint 1 & 2:

1. **Host Environment Setup**:
   - Install Go 1.22:
     `apt-get update && apt-get install -y golang-go`
   - Complete Python brain setup:
     `cd /root/kiwi/services/orchestrator && .venv/bin/pip install -r requirements.txt`
   - Create `/root/kiwi/.env` with required variables:
     ```env
     PORT=8080
     API_TOKEN="<generated_token>"
     DATABASE_URL="<supabase_connection_string>"
     BRAIN_URL="http://127.0.0.1:9100"
     ```

2. **Go Gateway Bridge Implementation (`services/gateway/brain/client.go`)**:
   - Create package `brain`:
     - Global `httpClient = &http.Client{Timeout: 120 * time.Second}`
     - Function `Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error)`
     - Connects to `BRAIN_URL + "/internal/chat"`
   - Modify `main.go`:
     - In `chatHandler`: replace the hardcoded `"Echo: ..."` with `brain.Chat(...)`.
     - Update `/health` endpoint to also check Python brain connectivity (`BRAIN_URL + "/health"` or ping) alongside database status.

3. **Database Fix in `services/gateway/db/chat.go`**:
   - Add nil checks:
     ```go
     if Pool == nil {
         return "", errors.New("database connection not initialized")
     }
     ```
   - Prevent server panics when `DATABASE_URL` is missing.

4. **WebSocket Hub Implementation (`services/gateway/ws/`)**:
   - Add `github.com/gorilla/websocket` dependency (`go get github.com/gorilla/websocket`).
   - Implement `Hub` with client registration, unregistration, and thread-safe broadcast channels.
   - Implement `Auth` during connection upgrade: inspect query param `?token=` or read first JSON frame `{ "type": "auth", "token": "..." }`.
   - Register route at `/api/ws` or `/api/secure/ws`.

5. **PM2 Configuration Update (`ecosystem.config.js`)**:
   - Update `ecosystem.config.js` to define both `kiwi-gateway` and `kiwi-brain`.
   - Ensure gateway binary compilation is part of the build step before `pm2 start`.

---

## 5. Verification Method

Once Go and Python dependencies are installed by the implementer, verify the Go Gateway with these commands:

### 5.1 Compilation & Tests
```bash
# 1. Verify Go toolchain
go version

# 2. Build Go Gateway from root
cd /root/kiwi
go build -o services/gateway/kiwi-gateway ./services/gateway

# 3. Run all tests
go test -v ./...
```

### 5.2 Local Execution & Endpoint Testing
```bash
# Start gateway locally with test token
cd /root/kiwi
PORT=8080 API_TOKEN="test_secret_123" ./services/gateway/kiwi-gateway &
GATEWAY_PID=$!

# Test Public Health Check
curl -s http://127.0.0.1:8080/health | grep '"status":"ok"'

# Test Auth Protection (Unauthenticated -> 401)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/secure/ping | grep '401'

# Test Auth Protection (Authenticated -> 200)
curl -s -H "Authorization: Bearer test_secret_123" http://127.0.0.1:8080/api/secure/ping | grep 'pong'

# Kill test gateway
kill $GATEWAY_PID
```

### 5.3 Invalidation Conditions
This report is invalidated if:
- The architectural choice shifts from HTTP/SSE bridge to gRPC or shared IPC.
- Port allocations (8080 for Gateway, 9100 for Brain) conflict with VPS deployments.
- The project switches from Supabase to purely self-hosted local PostgreSQL without pgvector.
