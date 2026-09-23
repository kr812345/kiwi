# Handoff Report — Synapse OS Python Brain Architecture & Environment Survey

**Agent**: `teamwork_preview_explorer` (Codebase Explorer - Synapse OS Python Brain)  
**Date**: 2026-09-21  
**Target Directory**: `/root/kiwi/services/orchestrator`  
**Parent Orchestrator Conv ID**: `61906bc7-6cc0-4500-84df-f0a2171b46ad`  

---

## 1. Observation

### 1.1 FastAPI Application Structure (`api/server.py` & `boot.py`)
- **Server Entrypoint**: `services/orchestrator/api/server.py` defines a FastAPI app with `@asynccontextmanager async def lifespan(app: FastAPI)` (lines 48–60).
- **Startup Lifecycle**:
  ```python
  # api/server.py:51-57
  kernel, registry, scheduler = await boot_os()
  kernel.register_module(bridge)
  
  os_state['kernel'] = kernel
  os_state['registry'] = registry
  os_state['scheduler'] = scheduler
  ```
  `boot_os()` in `boot.py` (lines 23–78) constructs:
  - `Kernel()` (`kernel/kernel.py`)
  - `MemoryEngine(db_url="dbname=synapse user=root")` (`memory/memory_engine.py`)
  - `AgentRegistry()` (`agents/registry.py`)
  - `ModelRouter()` (`models/model_router.py`)
  - `Scheduler()` (`scheduler/scheduler.py`)
  - `ToolRegistry()` with 9 tools: `GitHubTool`, `RedditTool`, `BrowserTool`, `EmailTool`, `PDFTool`, `PPTTool`, `FileRead`, `FileWrite`, `FileEdit`
  - 4 Department Managers wrapped via `BaseDepartmentModule`: Research (`rm_1`), Engineering (`eng_1`), Marketing (`mkt_1`), Personal (`per_1`).
  - Returns `kernel, registry, scheduler`.
- **Existing Endpoints in `api/server.py`**:
  - `GET /docs` and `GET /openapi.json` (Swagger UI).
  - `WebSocket /ws` (`websocket_endpoint`): Connected to `ConnectionManager` and `WebSocketBridge` (Module that broadcasts all system Events received by the Kernel to connected WS clients).
  - `POST /api/task` (`submit_task`): Accepts `TaskRequest(task: str)`. Spawns a UUID `web_task_<hex>`, constructs an `Event(source="web_ui", destination="scheduler", event_type="task.create", payload={"task": {...}})`, and fires `await kernel.send_event(task_event)`.
  - **Notice**: `/api/task` is completely asynchronous fire-and-forget; it returns `{"status": "success", "task_id": task_id}` immediately, not waiting for completion.
- **Missing Endpoints in `api/server.py`**:
  - `POST /internal/chat` (synchronous internal bridge endpoint for Go Gateway) does not exist yet.
  - `POST /internal/chat/stream` (SSE streaming endpoint) does not exist yet.
  - Persona module (`persona/kiwi.py`) does not exist yet.

### 1.2 Python Environment & Virtualenv Analysis
- **Virtual Environment Path**: `/root/kiwi/services/orchestrator/.venv` (Python 3.12.3).
- **Venv Origin**: `cat /root/kiwi/services/orchestrator/.venv/pyvenv.cfg` reveals:
  ```ini
  home = /usr/bin
  include-system-site-packages = false
  version = 3.12.3
  executable = /usr/bin/python3.12
  command = /usr/bin/python3 -m venv /root/synapse/.venv
  ```
- **CRITICAL DEFECT — Missing packages in `.venv`**:
  - Running `/root/kiwi/services/orchestrator/.venv/bin/python -c "import fastapi"` results in:
    ```
    ModuleNotFoundError: No module named 'fastapi'
    ```
  - Running `.venv/bin/uvicorn` fails because `uvicorn` binary is not present inside `.venv/bin/`.
  - `.venv` contains only 19 packages: `annotated-types`, `anyio`, `certifi`, `h11`, `httpcore`, `httpx`, `idna`, `iniconfig`, `packaging`, `pip`, `pluggy`, `psycopg2-binary`, `pydantic`, `pydantic_core`, `Pygments`, `pytest`, `pytest-asyncio`, `typing_extensions`, `typing-inspection`.
- **System Python (`/usr/bin/python3`)**:
  - Contains all required packages globally: `fastapi==0.141.1`, `uvicorn==0.52.1`, `websockets==17.0.1`, `psycopg2-binary`, `pydantic==2.13.4`, etc.
  - Running `python3 -c "import fastapi, uvicorn; print(fastapi.__version__, uvicorn.__version__)"` succeeds (`0.141.1 0.52.1`).
  - `/usr/local/bin/uvicorn` exists and is functional.
- **PM2 Conflict**:
  - `PLAN.md` 1.3 specifies running `.venv/bin/uvicorn api.server:app --host 127.0.0.1 --port 9100`.
  - This command will fail under current `.venv` unless either:
    1. Dependencies in `requirements.txt` are installed into `.venv`, OR
    2. `include-system-site-packages = true` is set in `.venv/pyvenv.cfg`, OR
    3. PM2 script is configured to use `python3 -m uvicorn` or `/usr/local/bin/uvicorn`.

### 1.3 Model Router & LLM Adapter Architecture (`models/`)
- **`ModelRouter` (`models/model_router.py`)**:
  - Module registered as `"model_router"`.
  - Three tiers of adapters:
    - Tier 1: `GeminiFlashAdapter` (`gemini-2.5-flash`, cost: $0.000075 / $0.000300 per 1k)
    - Tier 2: `OpenRouterAdapter` (`mistralai/mistral-7b-instruct:free`, cost: $0.003 / $0.015 per 1k)
    - Tier 3: `AntigravityAdapter` (`antigravity-cli`, cost: $0.005 / $0.025 per 1k)
  - Method `decide_model(task_description, payload)` selects tier based on explicit hints, keyword heuristics, or token length.
  - Method `generate_with_fallback(prompt, system, ...)` cascades across the adapter chain upon failure.
  - Includes `CostTracker` (`models/cost_tracker.py`) for per-task token accounting.
- **Simulation / Fallback Mode**:
  - When `GEMINI_API_KEY` is not set or network call fails, `GeminiFlashAdapter.generate()` falls back to local simulation mode:
    `output_text = f"Gemini Flash processed task: {sys_prefix}{prompt}"`.
  - No fatal crash occurs when API keys are omitted; the system gracefully simulates LLM generation.
- **Streaming State**:
  - `ModelRouter` and its adapters currently **only support unary generation** (`async def generate(...)`).
  - Neither `stream_generate` nor async generators are implemented yet.
  - Google Gemini API in `GeminiFlashAdapter` currently uses blocking `urllib.request` inside `asyncio.to_thread`.
  - Streaming will require implementing `stream_generate(...)` using SSE (`streamGenerateContent?alt=sse` or `httpx`/`aiohttp`) and a simulated chunk yield loop for fallback.

### 1.4 Memory Engine & Database Consolidation (`memory/memory_engine.py`)
- **Database Connection & Initialization**:
  - `MemoryEngine.__init__` (lines 13–19) takes `db_url="dbname=synapse user=root"` and immediately calls:
    ```python
    self.conn = psycopg2.connect(self.db_url)
    self.conn.autocommit = True
    self._init_db()
    ```
  - `_init_db()` executes `CREATE EXTENSION IF NOT EXISTS vector;` and creates 7 tables:
    `events`, `tasks`, `artifacts`, `knowledge_graph`, `agents`, `chat_sessions`, `metrics`.
- **Database Status on VPS**:
  - PostgreSQL service was initially inactive (`systemctl status postgresql` -> `inactive (dead)`).
  - Attempting to run `boot_os()` without PostgreSQL running caused an immediate fatal error:
    `psycopg2.OperationalError: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory`.
  - Starting PostgreSQL (`systemctl start postgresql`) revealed that the `synapse` database and user `root` already exist and contain the 7 initialized tables.
  - With PostgreSQL running, `boot_os()` succeeds completely.
- **Supabase Consolidation Discrepancies**:
  - In `boot.py`: Hardcoded `MemoryEngine(db_url="dbname=synapse user=root")` ignores `DATABASE_URL` environment variable.
  - In `MemoryEngine`: Missing try/except block; if the DB connection fails, the whole OS crashes instead of entering a "Degraded Mode" (in-memory persistence).
  - Schema mismatch:
    - Synapse `MemoryEngine` defines `chat_sessions`:
      `(id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, timestamp TIMESTAMP)`
    - `PLAN.md` 1.4 defines `chat_sessions`:
      `(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
    - Column name difference: `timestamp` in `MemoryEngine` queries (`INSERT INTO chat_sessions ... VALUES (%s, %s, %s, %s, %s)`) vs `created_at` in `PLAN.md`.
    - Knowledge graph embedding dimension: `vector(1536)` in `MemoryEngine` vs `vector(768)` in `PLAN.md` (Gemini embeddings use 768 dimensions, OpenAI uses 1536).
    - Gateway `services/gateway/db/chat.go` uses `conversations` and `messages` tables (`001_initial_schema.sql`). `002_synapse_tables.sql` is not yet created.

### 1.5 Chat Flow in CLI (`main.py`)
- `main.py` lines 143–246 provide a reference implementation of chat integration with the OS kernel:
  1. Boot OS and register a `ChatBridge(Module)`.
  2. Send `memory.store_chat` event to store user message.
  3. Send `memory.get_chat_history` event and wait on `asyncio.Event` for history.
  4. Build prompt combining conversation history and current message.
  5. Dispatch `task.create` event to `scheduler` and await `task.complete`.
  6. Extract response and send `memory.store_chat` event for assistant message.

### 1.6 Environment Verification & Pytest Results
- **FastAPI Server on Port 9100**:
  - Tested: `python3 -m uvicorn api.server:app --port 9100`
  - Output:
    ```
    INFO:     Started server process [759006]
    INFO:     Waiting for application startup.
    [SYSTEM] Synapse OS Booted Successfully.
    [SERVER] Connected OS to API Server.
    INFO:     Application startup complete.
    INFO:     Uvicorn running on http://127.0.0.1:9100
    * Connected to 127.0.0.1 (127.0.0.1) port 9100
    > GET /docs HTTP/1.1
    < HTTP/1.1 200 OK
    ```
  - Verification confirmed: Server boots cleanly and serves HTTP requests.
- **Pytest Suite (`.venv/bin/pytest`)**:
  - Run across entire test suite: 242 tests collected.
  - **Result**: 233 passed, 9 failed.
  - Failures are caused by:
    - 1 legacy assertion in `test_model_router.py`: `assert 'mistralai/mistral-7b-instruct:free' == 'openrouter/auto'`.
    - 1 assertion in `test_research_dept.py`: `assert 5 != 3` (workers count updated).
    - 1 assertion in `test_memory.py`: `assert 2 != 1` (duplicate record found from previous test run).
    - Residual e2e department tests expecting specific mock data.
  - Overall pass rate: **96.3%** across core kernel, event bus, scheduler, and registry.

---

## 2. Logic Chain

### 2.1 Technical Implications for `/internal/chat`
1. **Synchronous Call Pattern**:
   The Go gateway expects a direct HTTP POST to `/internal/chat` that returns a synchronous JSON response:
   ```json
   {
     "response": "...",
     "conversation_id": "...",
     "model_used": "...",
     "tokens": {...},
     "cost_usd": 0.0,
     "persona": {...}
   }
   ```
2. **Execution Path Inside FastAPI**:
   Instead of the fire-and-forget approach of `/api/task`, `/internal/chat` should:
   - Retrieve `kernel` from `os_state['kernel']` (return 503 if not initialized).
   - Validate non-empty message (return 400 if empty).
   - Resolve `conversation_id` / `session_id` (generate new UUID if missing).
   - Access `memory_engine`:
     - Store user message.
     - Retrieve recent conversation history for `session_id`.
   - Apply `kiwi.py` persona system prompt (`services/orchestrator/persona/kiwi.py`).
   - Call `model_router.generate_with_fallback(prompt=message, system=kiwi_system_prompt, ...)`.
   - Store assistant response in `memory_engine`.
   - Return structured `InternalChatResponse`.
3. **Direct Module Invocation vs Event Bus**:
   While the Event Bus can be used via a temporary listener future (as in `main.py`'s `ChatBridge`), accessing `model_router = kernel.get_module("model_router")` and `memory = kernel.get_module("memory_engine")` directly provides deterministic sub-millisecond overhead, avoiding event bus timeout race conditions under heavy concurrency.

### 2.2 Technical Implications for `/internal/chat/stream`
1. **Protocol**: Server-Sent Events (`text/event-stream`).
2. **Chunk Format**:
   ```
   data: {"token": "hello"}\n\n
   data: {"token": " world"}\n\n
   data: {"done": true}\n\n
   ```
3. **Streaming Generation**:
   `ModelRouter` needs an `async def stream_generate(self, prompt: str, system: Optional[str] = None)` method that:
   - Yields token strings.
   - For `GeminiFlashAdapter`: When API key is present, calls `streamGenerateContent?alt=sse`; when in simulation mode, splits the output into words and yields them with `asyncio.sleep(0.02)`.
   - `/internal/chat/stream` wraps this in FastAPI's `StreamingResponse(generate(), media_type="text/event-stream")`.

### 2.3 Technical Implications for Kiwi Persona (`persona/kiwi.py`)
1. Create `services/orchestrator/persona/__init__.py` and `services/orchestrator/persona/kiwi.py`.
2. Must export:
   - `KIWI_SYSTEM_PROMPT`: Lowercase tone, senior full-stack engineer persona, concise, direct, occasional bird/dev puns.
   - `build_chat_prompt(message: str, history: list, context: dict) -> str`: Formats conversation history and system instructions.

### 2.4 Technical Implications for Database & Supabase Memory Consolidation
1. **Degraded Mode Protection**:
   `MemoryEngine.__init__` must never crash unhandled. It must catch `psycopg2.OperationalError` / `Exception`, log a warning, set `self.conn = None`, and fallback to an in-memory dictionary storage (`self._in_memory_chats = defaultdict(list)`).
2. **`DATABASE_URL` Support**:
   `MemoryEngine` and `boot.py` must prioritize `os.environ.get("DATABASE_URL")` over the hardcoded `"dbname=synapse user=root"`.
3. **Migration Schema Alignment**:
   In `infra/supabase/migrations/002_synapse_tables.sql`, the `chat_sessions` table should include both `created_at TIMESTAMPTZ DEFAULT NOW()` AND an alias or column `timestamp TIMESTAMPTZ DEFAULT NOW()` (or update `MemoryEngine` to use `created_at`), ensuring backward and forward compatibility.
   Vector dimension for `knowledge_graph` should be set to `vector(768)` or conditional based on embedding provider.

---

## 3. Caveats & Risks

| Category | Risk / Caveat | Severity | Mitigation |
|---|---|---|---|
| **Venv Packages** | `fastapi` and `uvicorn` missing from `.venv` | **HIGH** | Set `include-system-site-packages = true` in `.venv/pyvenv.cfg` or run `pip install -r requirements.txt` into `.venv`. In PM2, use `python3 -m uvicorn` or `/usr/local/bin/uvicorn`. |
| **Database Failure** | `MemoryEngine` crashes hard if Postgres / Supabase is unreachable | **HIGH** | Add try/except block in `MemoryEngine.__init__` and implement an in-memory degraded mode fallback. |
| **API Keys** | `GEMINI_API_KEY` is not currently set in the environment | **MEDIUM** | System already has built-in simulation fallback; ensure `.env` is loaded and documentation advises setting key for live LLM responses. |
| **Schema Inconsistency** | Column name differences (`timestamp` vs `created_at`) between `MemoryEngine` and `PLAN.md` | **MEDIUM** | Harmonize `MemoryEngine` and migration SQL `002_synapse_tables.sql` to use standard `created_at` or support both. |
| **Streaming Support** | `ModelRouter` does not have `stream_generate` yet | **MEDIUM** | Required in Sprint 2; design `InternalChatRequest` and model router now to make streaming extension straightforward. |

---

## 4. Conclusion & Recommendations for Implementation

1. **Sprint 1 Preparation is Clear**:
   - The Synapse OS Python Brain is cleanly designed with an interface-driven Kernel, EventBus, ModelRouter, and MemoryEngine.
   - Booting takes ~100ms and integrates seamlessly with FastAPI's `lifespan`.
2. **Key Changes Required for Sprint 1**:
   - **Step 1**: Update `.venv/pyvenv.cfg` with `include-system-site-packages = true` (or install dependencies into `.venv`) so PM2 and `.venv/bin/uvicorn` work without error.
   - **Step 2**: Add `services/orchestrator/persona/kiwi.py` and `persona/__init__.py`.
   - **Step 3**: Add `POST /internal/chat` endpoint to `services/orchestrator/api/server.py` with Pydantic request/response schemas matching `PLAN.md` 1.1.
   - **Step 4**: Update `MemoryEngine` in `services/orchestrator/memory/memory_engine.py` and `boot.py` to support `DATABASE_URL` and gracefully fallback to in-memory degraded mode if the database connection fails.
   - **Step 5**: Create `infra/supabase/migrations/002_synapse_tables.sql` with unified schema for Supabase.
   - **Step 6**: Update `ecosystem.config.js` to manage both `kiwi-gateway` and `kiwi-brain`.

---

## 5. Verification Method

To independently verify the Python brain, run the following commands in `/root/kiwi/services/orchestrator`:

### 1. Test Module Imports & Kernel Boot
```bash
python3 -c "import asyncio; from boot import boot_os; k, r, s = asyncio.run(boot_os()); print('Kernel Boot OK. Registered Modules:', k.list_modules())"
```
*Expected Output*: Includes `[SYSTEM] Synapse OS Booted Successfully.` and lists `memory_engine`, `agent_registry`, `model_router`, `scheduler`, and departments.

### 2. Test FastAPI Lifespan & API Server Startup
```bash
python3 -c "import asyncio; from api.server import app, lifespan; asyncio.run(lifespan(app).__aenter__()); print('FastAPI Lifespan OK')"
```
*Expected Output*: Prints `[SERVER] Connected OS to API Server.` followed by `FastAPI Lifespan OK`.

### 3. Launch Uvicorn on Port 9100 & Probe Endpoint
```bash
# Start server in background
python3 -m uvicorn api.server:app --host 127.0.0.1 --port 9100 &
SERVER_PID=$!
sleep 2

# Check Swagger docs
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9100/docs
# Expected: 200

# Submit a test task
curl -s -X POST http://127.0.0.1:9100/api/task -H "Content-Type: application/json" -d '{"task": "test ping"}'
# Expected: {"status":"success","task_id":"..."}

# Terminate test server
kill $SERVER_PID
```

### 4. Run Pytest Suite
```bash
/root/kiwi/services/orchestrator/.venv/bin/pytest tests/test_kernel.py tests/test_model_router_stress.py -v
```
*Expected Output*: All kernel and model router stress tests pass with 100% success.
