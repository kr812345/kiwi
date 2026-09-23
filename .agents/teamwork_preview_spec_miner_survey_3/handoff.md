# Specification Handoff Report: Kiwi AI System (Bridge, Streaming, PWA, Infra)

**Author:** `teamwork_preview_spec_miner` (Spec Miner - Bridge, Streaming, PWA, Infra)  
**Workspace:** `/root/kiwi/.agents/teamwork_preview_spec_miner_survey_3`  
**Date:** 2026-09-21  
**Target Milestone:** Sprints 1, 2, 3 & Infrastructure Verification

---

## 1. Observation

Direct codebase and document observations:
1. **Master Plan & Request Alignment**:
   - `/root/kiwi/.agents/ORIGINAL_REQUEST.md`: Directs implementation of R1 (Go ↔ Python Bridge, Sprint 1), R2 (Streaming & WebSockets, Sprint 2), and R3 (Mobile App MVP PWA, Sprint 3).
   - `/root/kiwi/PLAN.md` (Lines 1–1116): Provides architectural breakdown. Go Gateway runs on port `8080`, Synapse OS Python Brain runs on `127.0.0.1:9100`. Go ↔ Python communication is local HTTP/SSE (`/internal/chat` and `/internal/chat/stream`).
2. **Current Gateway State**:
   - `/root/kiwi/services/gateway/main.go` (Lines 56–108): Implements an "Iteration 1 Dumb Echo Orchestrator" where `chatHandler` echoes `"Echo: I heard you say '..."`. It inserts records into `conversations` and `messages` in Supabase PostgreSQL via `pgx/v5` (`db/chat.go`).
   - `/root/kiwi/services/gateway/auth/middleware.go` (Lines 10–40): Protects `/api/secure/*` endpoints via static Bearer token matching `API_TOKEN`.
   - `/root/kiwi/services/gateway/brain/client.go`: Does NOT exist yet.
   - `/root/kiwi/services/gateway/ws/hub.go`: Does NOT exist yet.
3. **Current Brain / Synapse OS State**:
   - `/root/kiwi/services/orchestrator/api/server.py` (Lines 1–102): FastApi application with lifespan booting OS (`kernel, registry, scheduler = await boot_os()`), WebSocket bridge at `/ws` for dashboard broadcasts, and `/api/task`. `/internal/chat` and `/internal/chat/stream` do NOT exist.
   - `/root/kiwi/services/orchestrator/persona/kiwi.py`: Does NOT exist yet.
   - `/root/kiwi/services/orchestrator/memory/memory_engine.py` (Line 13): Connects to `dbname=synapse user=root` via `psycopg2.connect`. It does NOT read `DATABASE_URL` nor support Supabase pgvector configuration or boot degradation.
   - `/root/kiwi/services/orchestrator/models/model_router.py` (Lines 113–146): Implements `generate_with_fallback(...)`, but has NO `stream_generate(...)` generator.
   - `/root/kiwi/services/orchestrator/boot.py` (Line 25): Hardcodes `MemoryEngine(db_url="dbname=synapse user=root")`.
4. **Current Infrastructure & Process State**:
   - `/root/kiwi/ecosystem.config.js` (Lines 1–16): Only defines `kiwi-gateway`. Does NOT define `kiwi-brain`.
   - `/root/kiwi/infra/supabase/migrations/001_initial_schema.sql`: Contains `conversations` and `messages` tables. `002_synapse_tables.sql` does NOT exist yet.
   - System runtime verification: Python 3.12.3 with virtual environment `.venv` exists; `.venv/bin/pytest tests/test_echo.py` passed 7 tests. Node v22.23.2, PM2 7.0.3, Caddy v2.11.4 are installed. `go` command is not currently in system `$PATH` (needs installation or Go toolchain configuration).

---

## 2. Logic Chain

1. **Sprint 1 (Bridge Execution Flow)**:
   - *Observation*: Gateway currently echoes messages locally and writes directly to Supabase (`main.go:92`). Brain server (`api/server.py`) has no internal endpoints for Go.
   - *Deduction*: When Go receives `POST /api/secure/chat`, it must delegate LLM generation to `http://127.0.0.1:9100/internal/chat`.
   - *Persona Injection*: The Python brain must apply `KIWI_SYSTEM_PROMPT` from `persona/kiwi.py` before executing model routing, ensuring lowercase concise styling with bird/dev puns.
   - *Database Convergence*: `MemoryEngine` in Python must accept `DATABASE_URL` pointing to Supabase pooler. If connection fails, it must enter degraded mode (memory-only/no-op) without crashing kernel boot.
   - *Process Orchestration*: PM2 `ecosystem.config.js` must launch both Go gateway (`PORT=8080`) and Python Uvicorn (`127.0.0.1:9100`) with environment variables.

2. **Sprint 2 (Streaming & Real-Time Flow)**:
   - *Observation*: `PLAN.md` §2.1 and §2.2 prescribe `/api/secure/ws` in Go and `/internal/chat/stream` in Python using Server-Sent Events (SSE).
   - *Deduction*: A WebSocket Hub (`ws/hub.go`) must maintain persistent client sessions and authenticate incoming connections.
   - *SSE Relay*: When client sends `chat.message`, Go forwards the request to Python `POST /internal/chat/stream`. Python yields chunks as `data: {"token": "..."}\n\n`. Go reads these lines, converts them to `WSMessage{Type: "chat.stream", Content: "..."}`, and streams them to the client. Upon `data: {"done": true}`, Go sends `chat.complete` and persists the completed message to Supabase.

3. **Sprint 3 (Mobile App MVP / PWA)**:
   - *Observation*: `ORIGINAL_REQUEST.md` specifies a Progressive Web App (PWA) using Next.js or plain HTML/JS/CSS connecting to the WebSocket endpoint.
   - *Deduction*: The frontend needs a web manifest (`manifest.json`), service worker (`sw.js`), responsive mobile viewport, token authentication modal/screen, connection retry with exponential backoff, and live token typing animation styled with Kiwi's theme (`#4CAF50`, `#0D1117`).

---

## 3. Caveats

1. **Go Environment**: The system shell currently does not have `go` in `$PATH`. To build and run `kiwi-gateway`, the Go toolchain (1.22+) must be installed or mapped into the PATH before starting `kiwi-gateway` via PM2.
2. **Supabase Connectivity**: In development or offline environments where `DATABASE_URL` is unreachable or invalid, both the Go gateway (`db.InitDB()`) and the Python brain (`MemoryEngine`) must fail gracefully into a degraded memory mode rather than fatal panic.
3. **PWA Architecture Choice**: While `PLAN.md` discusses React Native in §3, `ORIGINAL_REQUEST.md` specifically mandates a Progressive Web App (PWA) using Next.js or plain HTML/JS/CSS. A lightweight web PWA (or Next.js PWA) fulfills this requirement directly and runs in any mobile browser as an installable home screen app without native build toolchains.

---

## 4. Conclusion

All specifications for Sprints 1, 2, 3 and Infrastructure have been extracted, modeled, and formalized. The interface schemas, database structures, event protocols, and exact file paths are established below for implementation.

---

## 5. Verification Method

- **Sprint 1 (Bridge)**:
  ```bash
  curl -X POST http://127.0.0.1:8080/api/secure/chat \
    -H "Authorization: Bearer <API_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"message": "hello kiwi"}'
  ```
  Expected: JSON response with `response` generated by Python brain in Kiwi persona (lowercase, tech-focused), not "Echo: ...".
- **Sprint 2 (Streaming & WebSockets)**:
  ```bash
  wscat -c "ws://127.0.0.1:8080/api/secure/ws" -H "Authorization: Bearer <API_TOKEN>"
  # or sending auth message: {"type": "chat.message", "content": "tell me a dev joke"}
  ```
  Expected: `status.thinking` message, followed by sequential `chat.stream` token chunks, finalized with `chat.complete`.
- **Sprint 3 (PWA MVP)**:
  Open PWA on mobile browser / desktop, enter Server URL and Token, click "Test Connection" (`/api/secure/ping` returns 200), send chat message, verify streaming text bubbles and Kiwi avatar.
- **Process Management**:
  ```bash
  pm2 status
  # kiwi-gateway: online (port 8080)
  # kiwi-brain: online (port 9100)
  ```

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Bridge (R1) | `POST /internal/chat` | Python internal chat endpoint connecting Go Gateway to Synapse OS | `InternalChatRequest` JSON (message, conversation_id, session_id) | `InternalChatResponse` JSON (response, conversation_id, model_used, tokens, cost_usd, persona) | 400 for empty message, 503 if Kernel not ready, 500 if ModelRouter fails | `PLAN.md` lines 160–199 |
| 2 | Bridge (R1) | Kiwi Persona Prompt | System prompt defining Kiwi's tone (lowercase, concise, dev metaphors, bird puns) | `user_message`, `history`, `context` | Formatted prompt string injected into LLM context | Fallback to default persona if context corrupted | `PLAN.md` lines 200–248 |
| 3 | Bridge (R1) | Go Brain Client | Go HTTP client encapsulating requests to Python brain | `brain.ChatRequest` struct | `*brain.ChatResponse` struct, `error` | Returns error on non-200 or connection failure, 120s timeout | `PLAN.md` lines 290–355 |
| 4 | Bridge (R1) | PM2 Dual Process Config | PM2 configuration launching both Go Gateway and Python Brain | `ecosystem.config.js` | 2 supervised processes: `kiwi-gateway` and `kiwi-brain` | Auto-restart on crash, logging to PM2 logs | `PLAN.md` lines 360–398 |
| 5 | Bridge (R1) | Supabase Synapse Migration | SQL schema for Synapse tables: `knowledge_graph`, `tasks`, `chat_sessions`, `audit_log` | SQL execution against Supabase PostgreSQL | Tables, pgvector extension, indices created | Idempotent (`CREATE TABLE IF NOT EXISTS`) | `PLAN.md` lines 407–468 |
| 6 | Bridge (R1) | Supabase Memory Engine | Synapse `MemoryEngine` connecting to Supabase via `DATABASE_URL` | `DATABASE_URL` env string | DB connection pool, pgvector queries | Degraded mode (in-memory / warning) if DB unreachable | `PLAN.md` lines 401–406 |
| 7 | Streaming (R2) | WebSocket Hub (`/api/secure/ws`) | Real-time WebSocket hub in Go Gateway managing client connections | WebSocket upgrade request with Bearer token | WS text frames (`WSMessage`) | 401 Unauthorized if token invalid; auto-close on error | `PLAN.md` lines 496–545 |
| 8 | Streaming (R2) | `POST /internal/chat/stream` | Python SSE streaming endpoint returning token chunks | `InternalChatRequest` JSON | `text/event-stream` chunks (`data: {"token": "..."}\n\n`) | SSE error event or 500 on model failure | `PLAN.md` lines 548–567 |
| 9 | Streaming (R2) | Go SSE to WS Bridge | Consumer in Go reading Python SSE and forwarding as WS messages | HTTP SSE stream | `chat.stream` and `chat.complete` WS messages | Terminates upstream SSE if client disconnects | `PLAN.md` lines 548–567 |
| 10 | Streaming (R2) | Kiwi Status Events | Live progress notifications (`status.thinking`, `status.tool_call`) | Event Bus internal task status | `WSMessage` with type `status.thinking` or `status.tool_call` | Dropped if client disconnected | `PLAN.md` lines 569–584 |
| 11 | PWA MVP (R3) | PWA Manifest & Shell | Installable Web App manifest and responsive mobile UI shell | `manifest.json`, viewport meta tags | Installable PWA on Android/iOS/Web | Falls back to standard web page if unsupported | `ORIGINAL_REQUEST.md` line 25, `PLAN.md` §3 |
| 12 | PWA MVP (R3) | Token Authentication & Ping | Client auth setup with token storage and verification | Server URL + Bearer token | Stores credentials, calls `/api/secure/ping` | Red status badge and error banner on failure | `PLAN.md` lines 655–665 |
| 13 | PWA MVP (R3) | Streaming Chat Interface | Chat UI rendering token-by-token text animations and bubbles | Incoming `WSMessage` stream | Live typewriter rendering in Kiwi message bubble | Smooth buffer flush, no UI freeze | `PLAN.md` lines 647–654 |
| 14 | PWA MVP (R3) | Kiwi Theme & Avatar | Visual branding: Kiwi green palette and pixel/ASCII avatar | CSS Theme definitions | Avatar states (`[ ^ _ ^ ]`, `[ > _ < ]`, `[ ★ ᴗ ★ ]`, `[ @ _ @ ]`) | Default idle state if unknown status | `PLAN.md` lines 710–733 |
| 15 | PWA MVP (R3) | Connection Retry Handler | Auto-reconnect with exponential backoff on WS disconnect | WS `onclose`/`onerror` events | Retries connection at 1s, 2s, 4s, 8s, up to 30s | Displays "Reconnecting to Kiwi..." banner | `PLAN.md` line 749 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `POST /internal/chat` | Empty message `{"message": ""}` | Returns HTTP 400 Bad Request with `{"detail": "Message cannot be empty"}` |
| 2 | `POST /internal/chat` | Brain OS kernel not booted | Returns HTTP 503 Service Unavailable with `{"detail": "Brain kernel not initialized"}` |
| 3 | `POST /internal/chat` | Missing `conversation_id` | Auto-generates a new UUID4 string and returns it in `conversation_id` response field |
| 4 | `POST /internal/chat` | Model provider down / rate limited | ModelRouter cascades through fallback chain (Gemini Flash → OpenRouter → Antigravity/Simulation); returns 500 only if all fail |
| 5 | Go Gateway Chat Handler | Python Brain service down (port 9100 unreachable) | Go Gateway logs error, returns HTTP 503 Service Unavailable `{"error": "Brain temporarily unavailable"}` |
| 6 | MemoryEngine Boot | Supabase `DATABASE_URL` unreachable / network failure | Traps `psycopg2.OperationalError`, logs warning, starts in degraded mode without crashing server |
| 7 | WebSocket Hub | Client connects without auth token | Rejects connection during HTTP upgrade (401) or disconnects if auth message not received within 5s |
| 8 | Streaming Bridge | Client disconnects while Python is streaming SSE | Go detects WS context cancellation, closes SSE HTTP request, terminates LLM generation |
| 9 | Streaming Bridge | Python Brain crashes mid-stream | Go detects EOF on SSE stream without `done: true`, sends WS error message to client, closes gracefully |
| 10 | PWA WebSocket | Phone switches networks or sleeps | WS connection closes; PWA detects `onclose`, displays reconnecting banner, resumes conversation upon reconnection |
| 11 | Supabase Migrations | Migration 002 executed when tables already exist | `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` prevent schema conflicts |

---

## Detailed Specifications

### Requirement 1: Go ↔ Python Bridge (Sprint 1)

#### 1.1 Python Brain Endpoint: `POST /internal/chat`
- **File**: `services/orchestrator/api/server.py`
- **Port / Host**: `127.0.0.1:9100` (Internal only, not exposed externally)
- **Request Schema**:
  ```python
  class InternalChatRequest(BaseModel):
      message: str
      conversation_id: Optional[str] = None
      session_id: Optional[str] = None
  ```
- **Response Schema**:
  ```python
  class InternalChatResponse(BaseModel):
      response: str
      conversation_id: str
      model_used: str
      tokens: Dict[str, int]  # {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int}
      cost_usd: float
      persona: Dict[str, Any] # {"name": "Kiwi", "avatar": "[ ^ _ ^ ]", "tone": "lowercase_technical"}
  ```
- **Execution Pipeline**:
  1. Validate `req.message` (reject empty with HTTP 400).
  2. Verify `kernel = os_state.get('kernel')` (return HTTP 503 if missing).
  3. Ensure `conversation_id = req.conversation_id or str(uuid.uuid4())`.
  4. Fetch conversation history from memory engine if available.
  5. Format prompt using `build_chat_prompt(req.message, history, context)` from `persona/kiwi.py`.
  6. Execute `model_router.generate_with_fallback(prompt=full_prompt)`.
  7. Store assistant turn in memory engine.
  8. Return `InternalChatResponse`.

#### 1.2 Kiwi Persona Module: `services/orchestrator/persona/kiwi.py`
- **Constants**:
  ```python
  KIWI_SYSTEM_PROMPT = """you are kiwi — a personal AI assistant and senior full-stack engineer.

  personality:
  - you talk in lowercase unless excited
  - you're concise, warm, and direct
  - you use code metaphors naturally
  - you're technically brilliant but approachable
  - you never bluff — if you don't know, you say so
  - you sign off with occasional bird/dev puns

  capabilities:
  - full-stack development (Go, Python, React, databases)
  - AI/ML orchestration and tool calling
  - system administration and DevOps
  - research, analysis, and report writing
  - task planning and project management

  rules:
  - never execute destructive actions without explicit approval
  - always explain what you're doing before doing it
  - be honest about confidence levels
  - keep responses concise unless detail is requested
  """
  ```
- **Prompt Builder**:
  ```python
  def build_chat_prompt(user_message: str, history: Optional[list] = None, context: Optional[dict] = None) -> str:
      formatted_history = ""
      if history:
          for turn in history[-10:]:
              formatted_history += f"{turn.get('role', 'user')}: {turn.get('content', '')}\n"
      
      prompt = f"{KIWI_SYSTEM_PROMPT}\n\n"
      if formatted_history:
          prompt += f"recent conversation history:\n{formatted_history}\n\n"
      prompt += f"user: {user_message}\nkiwi:"
      return prompt
  ```

#### 1.3 Go Brain Client: `services/gateway/brain/client.go`
- **Package**: `brain`
- **Data Models**:
  ```go
  type ChatRequest struct {
      Message        string `json:"message"`
      ConversationID string `json:"conversation_id,omitempty"`
      SessionID      string `json:"session_id,omitempty"`
  }

  type ChatResponse struct {
      Response       string         `json:"response"`
      ConversationID string         `json:"conversation_id"`
      ModelUsed      string         `json:"model_used"`
      Tokens         map[string]int `json:"tokens"`
      CostUSD        float64        `json:"cost_usd"`
      Persona        map[string]any `json:"persona"`
  }
  ```
- **Functions**:
  - `Init()`: Initializes HTTP client with 120s timeout and resolves `BRAIN_URL` (default `"http://127.0.0.1:9100"`).
  - `Chat(req ChatRequest) (*ChatResponse, error)`: Performs POST to `/internal/chat`. Returns parsed response or error.
  - `Health() bool`: Probes brain server reachability.

#### 1.4 Go Gateway Integration: `services/gateway/main.go`
- In `chatHandler`:
  - Replace dumb echo with call to `brain.Chat(brainReq)`.
  - Save user message to Supabase via `db.InsertMessage(ctx, convID, "user", req.Message)`.
  - Save assistant response to Supabase via `db.InsertMessage(ctx, convID, "assistant", brainResp.Response)`.
  - Return JSON response to client:
    ```json
    {
      "conversation_id": "<convID>",
      "response": "<brainResp.Response>"
    }
    ```
- In `healthCheckHandler`:
  - Probe brain status via `brain.Health()` and report in health payload:
    ```json
    {
      "status": "ok",
      "message": "Kiwi API Gateway is running",
      "version": "0.1.0",
      "database": "connected",
      "brain": "connected"
    }
    ```

#### 1.5 Database Consolidation & Migrations
- **File**: `infra/supabase/migrations/002_synapse_tables.sql`
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS knowledge_graph (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      observation TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence FLOAT DEFAULT 1.0,
      category TEXT DEFAULT 'general',
      importance INT DEFAULT 5,
      embedding vector(768),
      expiration TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      description TEXT NOT NULL,
      requester TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      assigned_agent TEXT,
      result JSONB,
      dag_id UUID,
      dependencies TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      tool_name TEXT,
      arguments JSONB,
      result JSONB,
      approval_status TEXT DEFAULT 'auto_approved',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_graph(category);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_chat_sessions_session ON chat_sessions(session_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  ```
- **File**: `services/orchestrator/memory/memory_engine.py`
  - Update `__init__`:
    ```python
    db_url = os.environ.get("DATABASE_URL", db_url)
    try:
        self.conn = psycopg2.connect(db_url)
        self.conn.autocommit = True
        self._init_db()
        self.degraded = False
    except Exception as e:
        logger.warning(f"Failed to connect to Supabase: {e}. Starting in degraded mode.")
        self.conn = None
        self.degraded = True
    ```

#### 1.6 Process Management: `ecosystem.config.js`
```javascript
module.exports = {
  apps: [
    {
      name: "kiwi-gateway",
      script: "./services/gateway/kiwi-gateway",
      instances: 1,
      exec_mode: "fork",
      env: {
        PORT: 8080,
        NODE_ENV: "development",
        BRAIN_URL: "http://127.0.0.1:9100"
      },
      env_production: {
        PORT: 8080,
        NODE_ENV: "production",
        BRAIN_URL: "http://127.0.0.1:9100"
      }
    },
    {
      name: "kiwi-brain",
      script: ".venv/bin/uvicorn",
      args: "api.server:app --host 127.0.0.1 --port 9100",
      cwd: "./services/orchestrator",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        DATABASE_URL: process.env.DATABASE_URL || ""
      }
    }
  ]
};
```

---

### Requirement 2: Streaming & WebSockets (Sprint 2)

#### 2.1 WebSocket Protocol & Gateway Hub
- **Endpoint**: `GET /api/secure/ws` (HTTP Upgrade)
- **File**: `services/gateway/ws/hub.go`
- **Message Schema (`WSMessage`)**:
  ```go
  type WSMessage struct {
      Type           string `json:"type"`
      ConversationID string `json:"conversation_id,omitempty"`
      Content        string `json:"content,omitempty"`
      Metadata       any    `json:"metadata,omitempty"`
  }
  ```
- **Message Types Specification**:
  | Type | Origin | Direction | Payload Example | Purpose |
  |------|--------|-----------|-----------------|---------|
  | `auth` | Client | Client → Gateway | `{"type": "auth", "content": "<API_TOKEN>"}` | Authenticate WS session if not in header |
  | `chat.message` | Client | Client → Gateway | `{"type": "chat.message", "conversation_id": "...", "content": "hi"}` | User initiates a chat turn |
  | `status.thinking` | Server | Gateway → Client | `{"type": "status.thinking", "content": "kiwi is thinking..."}` | Indicates inference start |
  | `status.tool_call` | Server | Gateway → Client | `{"type": "status.tool_call", "content": "using tool: X", "metadata": {"tool": "X"}}` | Tool execution notice |
  | `chat.stream` | Server | Gateway → Client | `{"type": "chat.stream", "conversation_id": "...", "content": "token"}` | Individual token chunk |
  | `chat.complete` | Server | Gateway → Client | `{"type": "chat.complete", "conversation_id": "...", "content": "full text"}` | Completed message signal |
  | `event.agent` | Server | Gateway → Client | `{"type": "event.agent", "metadata": {...}}` | Background agent status |
  | `approval.request` | Server | Gateway → Client | `{"type": "approval.request", "metadata": {"action": "write_file", ...}}` | Human-in-the-loop gate |
  | `approval.response`| Client | Client → Gateway | `{"type": "approval.response", "metadata": {"approved": true}}` | User gate approval |

#### 2.2 Python SSE Endpoint: `POST /internal/chat/stream`
- **File**: `services/orchestrator/api/server.py`
- **Response Media Type**: `text/event-stream`
- **SSE Chunk Protocol**:
  - Incremental chunk:
    ```
    data: {"token": "hello"}\n\n
    ```
  - Completion chunk:
    ```
    data: {"done": true}\n\n
    ```
  - Error chunk:
    ```
    data: {"error": "Model execution failed"}\n\n
    ```
- **Model Adapter Streaming**:
  - `ModelRouter` adds `async def stream_generate(prompt: str, system: Optional[str] = None)`
  - Calls Gemini API with `:streamGenerateContent?alt=sse` or yields simulated tokens sequentially in development mode.

#### 2.3 Streaming Bridge Pipeline
1. Client sends `chat.message` over WebSocket.
2. Gateway stores user message in Supabase.
3. Gateway emits `status.thinking` to client.
4. Gateway initiates HTTP POST to `http://127.0.0.1:9100/internal/chat/stream`.
5. Gateway streams incoming SSE tokens as `chat.stream` frames over the WebSocket.
6. When SSE sends `{"done": true}`, Gateway:
   - Emits `chat.complete` containing the full concatenated string.
   - Stores the complete assistant message into Supabase.

---

### Requirement 3: Mobile App MVP / PWA (Sprint 3)

#### 3.1 PWA Architecture & Manifest
- **Path**: `apps/mobile/` or web PWA directory
- **Web App Manifest (`public/manifest.json`)**:
  ```json
  {
    "name": "Kiwi AI Assistant",
    "short_name": "Kiwi",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0D1117",
    "theme_color": "#0D1117",
    "icons": [
      {
        "src": "/icons/icon-192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icons/icon-512.png",
        "sizes": "512x512",
        "type": "image/png"
      }
    ]
  }
  ```
- **Service Worker (`public/sw.js`)**:
  - Intercepts network requests to cache offline shell assets.
  - Serves static assets cache-first; allows WebSocket/API requests to pass through network-only.
- **Viewport Meta Tags**:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="theme-color" content="#0D1117" />
  ```

#### 3.2 Kiwi Brand Theme & Style Guide
- **Colors**:
  - `primary`: `#4CAF50` (Kiwi Leaf Green)
  - `primaryDark`: `#2E7D32` (Deep Kiwi Forest)
  - `background`: `#0D1117` (Dark Background / Terminal Base)
  - `surface`: `#161B22` (Card and Message Bubble Base)
  - `text`: `#E6EDF3` (Crisp High-Contrast Text)
  - `textSecondary`: `#8B949E` (Subdued Meta Text)
  - `accent`: `#7EE787` (Bright Lime Glow / Focus State)
  - `error`: `#F85149` (Alert Red)
  - `warning`: `#D29922` (Caution Amber)
- **Typography**:
  - Monospace: `JetBrains Mono, Menlo, monospace` (For Kiwi messages, code blocks, terminal status)
  - Sans-serif: `Inter, system-ui, sans-serif` (For UI chrome, buttons, headers)
- **Kiwi Avatar Character**:
  - Pixel-art / ANSI face states:
    - Idle: `[ ^ _ ^ ]`
    - Thinking: `[ > _ < ]`
    - Solved / Complete: `[ ★ ᴗ ★ ]`
    - Error / Confused: `[ @ _ @ ]`

#### 3.3 Core Screens & Components
1. **Login & Configuration Screen**:
   - Gateway Base URL input (e.g. `http://127.0.0.1:8080`)
   - API Token input
   - "Test Connection" button testing `GET /api/secure/ping`
   - Connection status pill (green: connected, red: disconnected)
2. **Streaming Chat Screen**:
   - Header with Kiwi Avatar and real-time status pill
   - Auto-scrolling message timeline
   - Right-aligned user bubbles (dark emerald / slate `#1E293B`)
   - Left-aligned Kiwi bubbles (dark surface `#161B22` with lime accent border)
   - Live typewriter token stream with blinking cursor (`▍`)
   - Sticky bottom input with auto-resize textarea and send button (`#4CAF50`)
3. **Resilience & Auto-Reconnect Hook (`useWebSocket`)**:
   - Exponential backoff reconnect: 1s → 2s → 4s → 8s → max 30s.
   - Preserves conversation state and pending text in `localStorage`.
   - Re-authenticates automatically upon reconnect.

---

### Exact File Paths to Create or Modify

| Sprint | Action | Exact File Path | Description |
|---|---|---|---|
| Sprint 1 | CREATE | `services/orchestrator/persona/__init__.py` | Package marker for persona module |
| Sprint 1 | CREATE | `services/orchestrator/persona/kiwi.py` | Kiwi persona system prompt and prompt builder |
| Sprint 1 | MODIFY | `services/orchestrator/api/server.py` | Add `POST /internal/chat` endpoint |
| Sprint 1 | CREATE | `services/gateway/brain/client.go` | Go HTTP client calling Python brain |
| Sprint 1 | MODIFY | `services/gateway/main.go` | Replace Dumb Echo with `brain.Chat`, update health check |
| Sprint 1 | CREATE | `infra/supabase/migrations/002_synapse_tables.sql` | Supabase schema for Synapse tables & pgvector |
| Sprint 1 | MODIFY | `services/orchestrator/memory/memory_engine.py` | Connect to `DATABASE_URL` and support degraded mode |
| Sprint 1 | MODIFY | `services/orchestrator/boot.py` | Pass `DATABASE_URL` to `MemoryEngine` |
| Sprint 1 | MODIFY | `ecosystem.config.js` | Add `kiwi-brain` application entry |
| Sprint 1 | CREATE | `services/orchestrator/tests/test_internal_api.py` | Pytest suite for internal chat endpoint |
| Sprint 1 | CREATE | `services/gateway/brain/client_test.go` | Go unit tests for brain HTTP client |
| Sprint 2 | CREATE | `services/gateway/ws/hub.go` | WebSocket hub, client manager, and message router |
| Sprint 2 | MODIFY | `services/gateway/main.go` | Mount `/api/secure/ws` WebSocket route |
| Sprint 2 | MODIFY | `services/orchestrator/api/server.py` | Add `POST /internal/chat/stream` SSE endpoint |
| Sprint 2 | MODIFY | `services/orchestrator/models/model_router.py` | Add `stream_generate` generator |
| Sprint 2 | MODIFY | `services/orchestrator/models/adapters/base.py` | Add streaming interface to `ModelAdapter` |
| Sprint 2 | MODIFY | `services/orchestrator/models/adapters/gemini.py` | Implement token chunk streaming |
| Sprint 2 | MODIFY | `services/gateway/brain/client.go` | Add SSE consumer method for Go |
| Sprint 2 | CREATE | `services/orchestrator/tests/test_streaming.py` | Pytest suite for SSE streaming |
| Sprint 3 | CREATE | `apps/mobile/public/manifest.json` | PWA web app manifest |
| Sprint 3 | CREATE | `apps/mobile/public/sw.js` | PWA offline service worker |
| Sprint 3 | CREATE | `apps/mobile/src/theme/kiwi.ts` | Kiwi color theme palette |
| Sprint 3 | CREATE | `apps/mobile/src/components/KiwiAvatar.tsx` | Character avatar with state transitions |
| Sprint 3 | CREATE | `apps/mobile/src/components/StreamingText.tsx` | Typewriter token streaming component |
| Sprint 3 | CREATE | `apps/mobile/src/hooks/useWebSocket.ts` | WebSocket client hook with exponential backoff |
| Sprint 3 | CREATE | `apps/mobile/src/screens/ChatScreen.tsx` | Main chat interface screen |
| Sprint 3 | CREATE | `apps/mobile/src/screens/LoginScreen.tsx` | Auth token and server URL setup screen |
| Infra | CREATE | `scripts/test_integration.sh` | End-to-end integration test runner |

---

## Verification & Acceptance Criteria Checklist

### Sprint 1: Bridge Acceptance Checklist
- [ ] **Python Internal Chat Endpoint Test**:
  ```bash
  curl -s -X POST http://127.0.0.1:9100/internal/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "ping"}'
  ```
  Returns HTTP 200 with JSON payload containing `response`, `model_used`, and `persona`.
- [ ] **Gateway Secure Chat Bridge Test**:
  ```bash
  curl -s -X POST http://127.0.0.1:8080/api/secure/chat \
    -H "Authorization: Bearer <API_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"message": "hello kiwi"}'
  ```
  Returns an AI response from Python brain formatted in Kiwi voice, storing the message in Supabase.
- [ ] **PM2 Dual Process Supervision**:
  ```bash
  pm2 list
  ```
  Shows both `kiwi-gateway` and `kiwi-brain` in `online` status.
- [ ] **Supabase Synapse Migration**:
  `002_synapse_tables.sql` applied successfully; `knowledge_graph`, `tasks`, `chat_sessions`, and `audit_log` tables exist.

### Sprint 2: Streaming Acceptance Checklist
- [ ] **Python SSE Endpoint Test**:
  ```bash
  curl -N -s -X POST http://127.0.0.1:9100/internal/chat/stream \
    -H "Content-Type: application/json" \
    -d '{"message": "write a haiku"}'
  ```
  Outputs lines formatted as `data: {"token": "..."}\n\n` followed by `data: {"done": true}\n\n`.
- [ ] **WebSocket Live Streaming Test**:
  ```bash
  wscat -c "ws://127.0.0.1:8080/api/secure/ws" -H "Authorization: Bearer <API_TOKEN>"
  ```
  Sending `{"type": "chat.message", "content": "hello"}` receives:
  1. `{"type": "status.thinking", ...}`
  2. Sequential `{"type": "chat.stream", "content": "..."}` chunks
  3. `{"type": "chat.complete", ...}`
- [ ] **Disconnect Resilience Test**:
  Closing WebSocket connection mid-stream terminates upstream SSE connection without orphan leaks.

### Sprint 3: PWA MVP Acceptance Checklist
- [ ] **PWA Manifest & Installation**:
  Browser evaluates manifest at `/manifest.json` as valid PWA with icons and standalone display mode.
- [ ] **Authentication Flow**:
  User can enter server URL and token, test connection successfully, and authenticate WebSocket connection.
- [ ] **Streaming Chat UI**:
  Tokens render progressively in message bubble with typewriter animation without page jitter.
- [ ] **Network Loss Recovery**:
  Disconnecting network displays reconnecting banner; re-enabling network auto-reconnects and restores active conversation.
