# E2E & Test Harness Investigation Report

**Author**: Explorer 3 (E2E & Test Harness Explorer)  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_explorer_m3_3`  
**Date**: 2026-09-21  
**Project**: Kiwi AI System — Milestone 3 (Mobile App MVP / PWA) & End-to-End Acceptance  
**Reference Specs**: `/root/kiwi/.agents/ORIGINAL_REQUEST.md`, `/root/kiwi/PROJECT.md`, `/root/kiwi/PLAN.md`, `/root/kiwi/ecosystem.config.js`  

---

## Executive Summary

The Kiwi AI System merges the Kiwi Go API Gateway (port 8080) with the Synapse OS Python Brain (port 9100) supervised under PM2. This investigation evaluated the live runtime environment, existing test suites, Bridge verification endpoints, WebSocket streaming protocols, and Milestone 3 PWA requirements.

### Key Empirical Findings
1. **Live PM2 Runtime is Fully Operational**:
   - Both `kiwi-brain` (PID 773706) and `kiwi-gateway` (PID 774107) are online and healthy.
   - Port 8080 (Go Gateway) and Port 9100 (Synapse OS Python Brain) are active and listening.
   - Dual-process health endpoints respond with HTTP 200:
     - `GET http://127.0.0.1:8080/health` -> `{"status":"ok","brain":"connected"}`.
     - `GET http://127.0.0.1:9100/health` -> `{"status":"ok","service":"kiwi-brain"}`.
2. **Bridge Verification (`/api/secure/chat`) Meets All Acceptance Criteria**:
   - `curl -X POST http://127.0.0.1:8080/api/secure/chat` with Bearer auth successfully contacts the Python Brain and returns the AI response with Kiwi persona: `"yo! kiwi here — received: '...'. all systems operational and ready to ship code! 🥝"`.
   - Correctly enforces HTTP 401 for unauthenticated requests and HTTP 400 for empty messages.
3. **Streaming Verification (`/api/secure/ws`) Passes 100% of Empirical Tests**:
   - `scripts/test_ws_streaming.py` executed with **5/5 tests passing** (Bearer auth streaming, query parameter auth streaming, initial auth frame, invalid auth rejection, and client disconnect mid-stream).
   - WebSocket streaming includes `status.thinking`, incremental `chat.stream` chunks, and final `chat.complete`.
   - Error resilience verified: Gateway handles premature stream EOF, brain crashes, and mid-stream disconnects without goroutine leaks.
4. **Milestone 3 PWA Current State & Test Gaps**:
   - Assets present in `/root/kiwi/apps/mobile/public`: `manifest.json`, `styles.css` (644 lines of Kiwi branding), `sw.js` (caching shell assets), `icon.svg`, `icon-192.png`, `icon-512.png`.
   - Assets missing: `index.html` and `app.js` (currently return 404).
   - Go Gateway routing gap: `services/gateway/main.go` does not yet mount a static file server at `/`. Navigating to `http://127.0.0.1:8080/` returns `404 page not found`.
   - Missing test harnesses:
     - `scripts/test_pwa_verification.py`: Does not exist yet; needed to test static file serving, PWA DOM structure, and headless client simulation.
     - `scripts/e2e_verify.sh`: Specified in `PROJECT.md` line 142 but does not exist yet; needed as the master automated acceptance suite.

---

## 1. Live Runtime & PM2 Supervision Environment Audit

### 1.1 PM2 Configuration (`ecosystem.config.js`)
The dual-process architecture is defined in `/root/kiwi/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "kiwi-gateway",
      script: path.resolve(__dirname, "services/gateway/kiwi-gateway"),
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: "fork",
      env: {
        PORT: 8080,
        NODE_ENV: "development",
        BRAIN_URL: "http://127.0.0.1:9100",
        API_TOKEN: process.env.API_TOKEN || "kiwi_secret_token_dev",
        DATABASE_URL: process.env.DATABASE_URL || ""
      }
    },
    {
      name: "kiwi-brain",
      script: path.resolve(__dirname, "services/orchestrator/.venv/bin/uvicorn"),
      args: "api.server:app --host 127.0.0.1 --port 9100",
      cwd: path.resolve(__dirname, "services/orchestrator"),
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

### 1.2 Live Process Verification
Empirical observation using `pm2 status`:
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 4  │ kiwi-gateway       │ fork     │ 4    │ online    │ 0%       │ 9.9mb    │
│ 5  │ kiwi-brain         │ fork     │ 12   │ online    │ 0%       │ 36.4mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

Network socket inspection (`ss -tulpn`):
- `127.0.0.1:9100` -> Python FastAPI Brain (uvicorn, PID 773706).
- `0.0.0.0:8080` -> Go API Gateway (`kiwi-gateway`, PID 774107).

Health check responses:
- `curl -s http://127.0.0.1:8080/health`:
  ```json
  {"status":"ok","message":"Kiwi API Gateway is running","version":"0.1.0","database":"disconnected","brain":"connected"}
  ```
- `curl -s http://127.0.0.1:9100/health`:
  ```json
  {"status":"ok","service":"kiwi-brain","version":"0.1.0"}
  ```

---

## 2. Bridge Verification (`/api/secure/chat`)

### 2.1 Acceptance Requirement
`ORIGINAL_REQUEST.md`:
> "`curl -X POST http://127.0.0.1:8080/api/secure/chat` successfully returns an AI-generated response from the Python brain."

### 2.2 Empirical Verification Results

#### Test Case 1: Valid Authenticated Chat Request
- **Command**:
  ```bash
  curl -i -X POST http://127.0.0.1:8080/api/secure/chat \
    -H "Authorization: Bearer kiwi_secret_token_dev" \
    -H "Content-Type: application/json" \
    -d '{"message": "hello kiwi"}'
  ```
- **Observed Response**:
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json
  Date: Mon, 21 Sep 2026 00:29:11 GMT
  Content-Length: 155

  {"conversation_id":"conv-1789950551432415200","response":"yo! kiwi here — received: 'hello kiwi'. all systems operational and ready to ship code! 🥝"}
  ```
- **Evaluation**: **PASS**. Returns HTTP 200, valid JSON with `conversation_id`, and response generated from Python brain matching Kiwi persona.

#### Test Case 2: Unauthenticated Request
- **Command**:
  ```bash
  curl -i -X POST http://127.0.0.1:8080/api/secure/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "hello kiwi"}'
  ```
- **Observed Response**:
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: text/plain; charset=utf-8
  Content-Length: 29

  Unauthorized - Missing token
  ```
- **Evaluation**: **PASS**. Correctly rejected.

#### Test Case 3: Empty Message Request
- **Command**:
  ```bash
  curl -i -X POST http://127.0.0.1:8080/api/secure/chat \
    -H "Authorization: Bearer kiwi_secret_token_dev" \
    -H "Content-Type: application/json" \
    -d '{"message": "   "}'
  ```
- **Observed Response**:
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: text/plain; charset=utf-8
  Content-Length: 24

  Message cannot be empty
  ```
- **Evaluation**: **PASS**. Edge case correctly validated.

---

## 3. Streaming Verification (`/api/secure/ws`)

### 3.1 Acceptance Requirement
`ORIGINAL_REQUEST.md`:
> "A WebSocket client can connect to the Go Gateway and receive token-by-token streaming messages from the Python brain."

### 3.2 Protocol Architecture
In `services/gateway/ws/hub.go`, the WebSocket hub supports three authentication mechanisms:
1. **Bearer Header**: `Authorization: Bearer <API_TOKEN>` (used by programmatic clients / backend proxies).
2. **Query Parameter**: `ws://127.0.0.1:8080/api/secure/ws?token=<API_TOKEN>` (standard browser WebSocket compatibility).
3. **Initial Auth Frame**: Connect unauthenticated, then within 5 seconds send:
   ```json
   {"type": "auth", "token": "kiwi_secret_token_dev"}
   ```

When an authenticated client sends:
```json
{"type": "chat.message", "conversation_id": "optional-id", "content": "hello"}
```
The gateway executes the following frame sequence:
1. Emits `status.thinking`: `{"type": "status.thinking", "content": "kiwi is thinking..."}`.
2. Initiates SSE stream with Python Brain (`POST http://127.0.0.1:9100/internal/chat/stream`).
3. For each token chunk received from SSE, emits `chat.stream`:
   ```json
   {"type": "chat.stream", "conversation_id": "...", "content": "<token>"}
   ```
4. On SSE `done: true`, emits `chat.complete`:
   ```json
   {"type": "chat.complete", "conversation_id": "...", "content": "<full_response>"}
   ```
5. On error (e.g. Brain crash / premature EOF), emits `error` frame:
   ```json
   {"type": "error", "conversation_id": "...", "content": "Brain streaming failed: ..."}
   ```

### 3.3 Live Streaming Test Execution (`scripts/test_ws_streaming.py`)
Executed command:
```bash
/root/kiwi/services/orchestrator/.venv/bin/python /root/kiwi/scripts/test_ws_streaming.py
```
Empirical output:
```
==================================================
  Kiwi Gateway Milestone 2 WebSocket Test Suite   
==================================================

--- Test 1: Bearer Header Auth & Live Token Streaming ---
Connected via Bearer token.
Sent: {'type': 'chat.message', 'conversation_id': 'test-ws-bearer-1', 'content': 'hello kiwi from websocket'}
✓ Received status.thinking: kiwi is thinking...
  [stream token]: 'yo! '
  [stream token]: 'kiwi '
  [stream token]: 'here '
  [stream token]: '— '
  [stream token]: 'received: '
  [stream token]: "'hello "
  [stream token]: 'kiwi '
  [stream token]: 'from '
  [stream token]: "websocket'. "
  [stream token]: 'all '
  [stream token]: 'systems '
  [stream token]: 'operational '
  [stream token]: 'and '
  [stream token]: 'ready '
  [stream token]: 'to '
  [stream token]: 'ship '
  [stream token]: 'code! '
  [stream token]: '🥝'
✓ Received chat.complete: "yo! kiwi here — received: 'hello kiwi from websocket'. all systems operational and ready to ship code! 🥝"
✓ Test 1 Passed! Received 18 token frames.

--- Test 2: Query Param Auth & Streaming ---
Connected via ?token= query parameter.
✓ Test 2 Passed! Received stream with 17 chunks via query param auth.

--- Test 3: Initial Auth Frame Auth (within 5s deadline) ---
Connected unauthenticated. Sending auth frame...
✓ Test 3 Passed! Authenticated via initial frame and streamed 17 chunks.

--- Test 4: Invalid Auth Rejection ---
✓ Test 4 Passed! Connection rejected with HTTP status: 401

--- Test 5: Client Disconnect Mid-Stream Resilience ---
Received first chunk: 'yo! '. Abruptly closing client connection...
✓ Test 5 Passed! Client disconnected mid-stream cleanly without server panic or orphan leak.

==================================================
  ALL WEBSOCKET STREAMING TESTS PASSED (5/5)!     
==================================================
```

---

## 4. Milestone 3 PWA Functionality & Verification Strategy

### 4.1 Acceptance Requirement
`ORIGINAL_REQUEST.md`:
> "The PWA successfully connects to the backend, authenticates, and displays a streaming chat interface."

### 4.2 Current State Audit of `/root/kiwi/apps/mobile/`
| File Path | Status | MIME Type / Content |
|---|---|---|
| `public/manifest.json` | **Present** | `application/json` (standalone PWA manifest, icons defined) |
| `public/styles.css` | **Present** | `text/css` (644 lines, Kiwi green `#4CAF50`, dark `#0D1117`, animations) |
| `public/sw.js` | **Present** | `application/javascript` (precaches shell assets, bypasses `/api/`) |
| `public/icon.svg` | **Present** | `image/svg+xml` (vector Kiwi icon) |
| `public/icon-192.png` | **Present** | `image/png` (192x192 maskable icon) |
| `public/icon-512.png` | **Present** | `image/png` (512x512 maskable icon) |
| `public/index.html` | **MISSING** | 404 (needs implementation by Worker M3) |
| `public/app.js` | **MISSING** | 404 (needs implementation by Worker M3) |
| Gateway Static Serving | **MISSING** | Go gateway does not route `/` to static files |

### 4.3 Five-Stage PWA Verification Strategy
To independently verify Milestone 3 without manual browser clicking, the verification harness must execute five automated stages:

```
┌───────────────────────────────────────────────────────────┐
│              STAGE 1: Static Asset HTTP & MIME            │
│  GET /, index.html, styles.css, app.js, manifest, icons   │
│  Assert HTTP 200, Content-Type, Unauthenticated Bypass   │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│          STAGE 2: Manifest & Service Worker Spec          │
│  JSON parse manifest.json; verify standalone & icons      │
│  Check sw.js precache list matching SHELL_ASSETS         │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│               STAGE 3: DOM Structural Assertions          │
│  Parse index.html with BeautifulSoup                      │
│  Assert meta tags, avatar element, status pill, chat form │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│            STAGE 4: JavaScript Syntax & Logic Static      │
│  node --check app.js; inspect localStorage & WS logic     │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│            STAGE 5: Simulated PWA Client End-to-End       │
│  1. Ping /api/secure/ping with Bearer token (HTTP 200)    │
│  2. Connect WS via ?token= (or auth frame)                │
│  3. Send chat.message, verify status.thinking             │
│  4. Stream tokens, verify chat.complete matches text      │
└───────────────────────────────────────────────────────────┘
```

---

## 5. Review of Existing Test Scripts & Gap Analysis

### 5.1 Existing Scripts Inventory
| Script Path | Purpose | Execution Method | Status |
|---|---|---|---|
| `scripts/test_ws_streaming.py` | Validates WebSocket authentication & live streaming | `python3 scripts/test_ws_streaming.py` | **PASS (5/5)** |
| `scripts/challenger_m2_suite.py` | Challenger stress suite: midstream disconnects & crashes | `python3 scripts/challenger_m2_suite.py` | **PASS (3/3)** |
| `scripts/m2_ws_stress_harness.py` | Concurrency & latency benchmark (10-20 clients) | `python3 scripts/m2_ws_stress_harness.py` | **PASS** |
| `scripts/test_brain_crash_midstream.py` | Verifies Gateway handling when Brain stops mid-stream | `python3 scripts/test_brain_crash_midstream.py` | **PASS** |
| `scripts/test_ws_adversarial.py` | Adversarial frames, empty content, rapid messages | `python3 scripts/test_ws_adversarial.py` | **PASS** |
| `scripts/m1_stress_test.py` | HTTP `/api/secure/chat` concurrency benchmark | `python3 scripts/m1_stress_test.py` | **PASS** |

### 5.2 Unit Test Suites
1. **Go Gateway (`go test ./...`)**:
   - Total: 19 unit & empirical tests (`services/gateway`, `services/gateway/brain`, `services/gateway/ws`).
   - Status: **100% PASS** in 7.02s.
2. **Python Synapse Brain (`pytest tests/test_internal_api.py tests/test_streaming.py`)**:
   - Total: 8 Kiwi-specific integration tests.
   - Status: **100% PASS** in 4.46s.

### 5.3 Critical Gaps Identified
1. **Gap 1: Missing `scripts/test_pwa_verification.py`**:
   - Worker M3 is instructed in `DISPATCH.md` to write and run this script, but its exact implementation and test cases need to be formally specified.
2. **Gap 2: Missing `scripts/e2e_verify.sh`**:
   - Referenced in `PROJECT.md` line 142 as the unified master verification test script, but currently does not exist on disk.
3. **Gap 3: Static Asset Serving in Go Gateway**:
   - `services/gateway/main.go` currently lacks a handler for serving `apps/mobile/public` at `/`. Until this is mounted, all static requests return 404.

---

## 6. Blueprint for Test Harness 1: `scripts/test_pwa_verification.py`

Below is the complete, production-grade test specification for `scripts/test_pwa_verification.py` to be implemented for Milestone 3:

```python
#!/usr/bin/env python3
"""
Comprehensive PWA Verification Test Suite for Milestone 3.
Validates:
1. Static Asset HTTP 200 & Correct MIME Types (without authentication)
2. PWA Manifest & Service Worker Spec Compliance
3. HTML DOM Structure & UI Element Contracts
4. JavaScript Syntax Validation (via node --check)
5. Simulated PWA Client Lifecycle (Auth Ping -> WS Stream -> Message Completion)
"""

import asyncio
import json
import os
import subprocess
import sys
import httpx
import websockets
from bs4 import BeautifulSoup

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://127.0.0.1:8080")
GATEWAY_WS = os.environ.get("GATEWAY_WS", "ws://127.0.0.1:8080/api/secure/ws")
API_TOKEN = os.environ.get("API_TOKEN", "kiwi_secret_token_dev")


async def test_static_assets_http():
    print("\n--- 1. Testing Static Asset Serving & MIME Types ---")
    assets = [
        ("/", 200, "text/html"),
        ("/index.html", 200, "text/html"),
        ("/styles.css", 200, "text/css"),
        ("/app.js", 200, ["application/javascript", "text/javascript"]),
        ("/manifest.json", 200, ["application/json", "application/manifest+json"]),
        ("/sw.js", 200, ["application/javascript", "text/javascript"]),
        ("/icon.svg", 200, "image/svg+xml"),
        ("/icon-192.png", 200, "image/png"),
        ("/icon-512.png", 200, "image/png"),
    ]

    async with httpx.AsyncClient() as client:
        for path, expected_status, expected_mime in assets:
            url = f"{GATEWAY_URL}{path}"
            # Ensure static assets are accessible unauthenticated!
            resp = await client.get(url, follow_redirects=True)
            assert resp.status_code == expected_status, f"Expected {expected_status} for {path}, got {resp.status_code}"
            
            content_type = resp.headers.get("content-type", "").lower()
            if isinstance(expected_mime, list):
                assert any(m in content_type for m in expected_mime), f"MIME mismatch for {path}: {content_type}"
            else:
                assert expected_mime in content_type, f"MIME mismatch for {path}: {content_type}"
            print(f"✓ {path.ljust(16)} -> HTTP {resp.status_code} [{content_type.split(';')[0]}]")


async def test_pwa_manifest_and_sw():
    print("\n--- 2. Testing PWA Manifest & Service Worker Specs ---")
    async with httpx.AsyncClient() as client:
        # Check manifest
        resp = await client.get(f"{GATEWAY_URL}/manifest.json")
        assert resp.status_code == 200
        manifest = resp.json()
        assert manifest.get("name") == "Kiwi AI Assistant"
        assert manifest.get("short_name") == "Kiwi"
        assert manifest.get("display") == "standalone"
        assert manifest.get("theme_color") == "#0D1117"
        assert len(manifest.get("icons", [])) >= 2
        print("✓ manifest.json is valid and standalone-compliant")

        # Check sw.js
        resp_sw = await client.get(f"{GATEWAY_URL}/sw.js")
        assert resp_sw.status_code == 200
        sw_text = resp_sw.text
        assert "caches.open" in sw_text or "CACHE_NAME" in sw_text
        assert "/index.html" in sw_text
        assert "/styles.css" in sw_text
        assert "/app.js" in sw_text
        print("✓ sw.js implements caching of core shell assets")


async def test_dom_structure():
    print("\n--- 3. Testing HTML DOM & UI Element Contracts ---")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GATEWAY_URL}/index.html")
        assert resp.status_code == 200
        soup = BeautifulSoup(resp.text, "html.parser")

        # Viewport meta tag
        viewport = soup.find("meta", attrs={"name": "viewport"})
        assert viewport is not None, "Missing viewport meta tag"
        assert "viewport-fit=cover" in viewport.get("content", "")

        # PWA Links
        assert soup.find("link", attrs={"rel": "manifest"}) is not None, "Missing manifest link tag"
        assert soup.find("link", attrs={"rel": "stylesheet"}) is not None, "Missing stylesheet link tag"
        assert soup.find("script", attrs={"src": lambda s: s and "app.js" in s}) is not None, "Missing app.js script tag"

        # Key UI Elements
        avatar = soup.find(id="kiwi-avatar") or soup.find(class_=lambda c: c and "avatar-face" in c)
        assert avatar is not None, "Missing Kiwi avatar element (#kiwi-avatar)"
        assert "[ ^ _ ^ ]" in avatar.get_text() or "state-idle" in avatar.get("class", [])

        status_pill = soup.find(id="status-pill") or soup.find(class_=lambda c: c and "status-pill" in c)
        assert status_pill is not None, "Missing status pill element"

        chat_messages = soup.find(id="chat-messages") or soup.find(class_=lambda c: c and "chat-messages" in c)
        assert chat_messages is not None, "Missing chat messages container (#chat-messages)"

        chat_input = soup.find(id="chat-input") or soup.find("textarea")
        assert chat_input is not None, "Missing chat input element (#chat-input)"

        send_btn = soup.find(id="send-btn") or soup.find("button", attrs={"type": "submit"})
        assert send_btn is not None, "Missing send button (#send-btn)"

        auth_modal = soup.find(id="auth-modal") or soup.find(class_=lambda c: c and "modal" in c)
        assert auth_modal is not None, "Missing auth/settings modal (#auth-modal)"

        print("✓ index.html satisfies all DOM and UI element contracts")


def test_js_syntax():
    print("\n--- 4. Validating JavaScript Syntax via node --check ---")
    app_js_path = "/root/kiwi/apps/mobile/public/app.js"
    res = subprocess.run(["node", "--check", app_js_path], capture_output=True, text=True)
    assert res.returncode == 0, f"Syntax error in app.js:\n{res.stderr}"
    print("✓ app.js syntax check passed with zero errors")


async def test_simulated_pwa_client_flow():
    print("\n--- 5. Simulating PWA Client End-to-End Flow ---")
    async with httpx.AsyncClient() as client:
        # Step 5a: Token validation against GET /api/secure/ping
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        r_ping = await client.get(f"{GATEWAY_URL}/api/secure/ping", headers=headers)
        assert r_ping.status_code == 200, f"Token ping failed: {r_ping.status_code}"
        assert "pong" in r_ping.json().get("message", "")
        print("✓ Step 5a: PWA client successfully validates token via GET /api/secure/ping")

        # Step 5b: Browser-style WebSocket connection with query param
        ws_url = f"{GATEWAY_WS}?token={API_TOKEN}"
        async with websockets.connect(ws_url) as ws:
            print("✓ Step 5b: PWA connected to WebSocket via query parameter auth")

            # Step 5c: Send user chat message
            turn_msg = {
                "type": "chat.message",
                "conversation_id": "test-pwa-flow-1",
                "content": "can you verify the pwa streaming chat?"
            }
            await ws.send(json.dumps(turn_msg))

            # Step 5d: Read response stream
            thinking_received = False
            stream_tokens = []
            completed_text = None

            while True:
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                frame = json.loads(raw_msg)
                ftype = frame.get("type")

                if ftype == "status.thinking":
                    thinking_received = True
                elif ftype == "chat.stream":
                    stream_tokens.append(frame.get("content", ""))
                elif ftype == "chat.complete":
                    completed_text = frame.get("content")
                    break

            assert thinking_received, "Expected status.thinking frame"
            assert len(stream_tokens) > 0, "Expected at least 1 stream token chunk"
            assert completed_text is not None, "Expected chat.complete frame"
            assert "".join(stream_tokens) == completed_text, "Concatenated tokens must match complete text"
            assert "kiwi" in completed_text.lower(), "Expected kiwi persona in complete response"
            print(f"✓ Step 5c & 5d: Received status.thinking, {len(stream_tokens)} stream chunks, and chat.complete")
            print(f"  Final message preview: '{completed_text[:60]}...'")


async def main():
    print("==================================================")
    print("      Kiwi PWA Milestone 3 Verification Suite     ")
    print("==================================================")
    try:
        await test_static_assets_http()
        await test_pwa_manifest_and_sw()
        await test_dom_structure()
        test_js_syntax()
        await test_simulated_pwa_client_flow()
        print("\n==================================================")
        print("  ALL PWA VERIFICATION TESTS PASSED (5/5)!         ")
        print("==================================================")
    except Exception as e:
        print(f"\n❌ PWA VERIFICATION FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 7. Blueprint for Test Harness 2: `scripts/e2e_verify.sh`

Below is the complete, production-grade test specification for the master automated test script `/root/kiwi/scripts/e2e_verify.sh` satisfying all criteria from `ORIGINAL_REQUEST.md`:

```bash
#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# Kiwi AI System — Master End-to-End Acceptance Test Runner
# Verifies:
# 1. Host Toolchain & PM2 Process Supervision
# 2. Go ↔ Python Bridge (POST /api/secure/chat)
# 3. Streaming & WebSockets (GET /api/secure/ws)
# 4. Mobile App MVP / PWA (Static assets, DOM, simulated browser client)
# 5. Unit & Regression Test Suites (Go & Python)
# ==============================================================================

ROOT_DIR="/root/kiwi"
GATEWAY_URL="http://127.0.0.1:8080"
GATEWAY_WS="ws://127.0.0.1:8080/api/secure/ws"
BRAIN_URL="http://127.0.0.1:9100"
API_TOKEN="${API_TOKEN:-kiwi_secret_token_dev}"
PYTHON_BIN="${ROOT_DIR}/services/orchestrator/.venv/bin/python"
PYTEST_BIN="${ROOT_DIR}/services/orchestrator/.venv/bin/pytest"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((pass_count++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((fail_count++)); }
log_stage() {
  echo ""
  echo -e "${YELLOW}================================================================${NC}"
  echo -e "${YELLOW} $1 ${NC}"
  echo -e "${YELLOW}================================================================${NC}"
}

# --- STAGE 1: PM2 Dual Process Supervision ---
log_stage "STAGE 1: PM2 Process Supervision & Health Checks"

if pm2 status | grep -q "kiwi-gateway.*online"; then
  log_pass "PM2 service 'kiwi-gateway' is ONLINE"
else
  log_fail "PM2 service 'kiwi-gateway' is NOT online"
fi

if pm2 status | grep -q "kiwi-brain.*online"; then
  log_pass "PM2 service 'kiwi-brain' is ONLINE"
else
  log_fail "PM2 service 'kiwi-brain' is NOT online"
fi

# Health endpoints
gateway_health=$(curl -s "${GATEWAY_URL}/health" || true)
if echo "$gateway_health" | grep -q '"brain":"connected"'; then
  log_pass "Gateway /health probe: Gateway running and Brain connected"
else
  log_fail "Gateway /health probe failed: $gateway_health"
fi

brain_health=$(curl -s "${BRAIN_URL}/health" || true)
if echo "$brain_health" | grep -q '"service":"kiwi-brain"'; then
  log_pass "Brain /health probe: Python brain active"
else
  log_fail "Brain /health probe failed: $brain_health"
fi

# --- STAGE 2: Go ↔ Python Bridge Verification ---
log_stage "STAGE 2: Go ↔ Python HTTP Chat Bridge Verification"

# 2a: Unauthenticated check
unauth_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${GATEWAY_URL}/api/secure/chat" \
  -H "Content-Type: application/json" -d '{"message":"hello"}')
if [ "$unauth_code" -eq 401 ]; then
  log_pass "Unauthenticated POST /api/secure/chat rejected with HTTP 401"
else
  log_fail "Expected HTTP 401 for unauth chat, got $unauth_code"
fi

# 2b: Authenticated chat check
bridge_resp=$(curl -s -X POST "${GATEWAY_URL}/api/secure/chat" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message":"e2e verification ping"}')

if echo "$bridge_resp" | grep -q '"conversation_id"' && echo "$bridge_resp" | grep -qi "kiwi"; then
  log_pass "Authenticated POST /api/secure/chat returned valid Kiwi AI response"
else
  log_fail "Bridge chat response did not contain conversation_id or Kiwi persona: $bridge_resp"
fi

# --- STAGE 3: Streaming & WebSockets Verification ---
log_stage "STAGE 3: WebSocket Streaming Verification"

if [ -f "${ROOT_DIR}/scripts/test_ws_streaming.py" ]; then
  if "${PYTHON_BIN}" "${ROOT_DIR}/scripts/test_ws_streaming.py"; then
    log_pass "WebSocket streaming test suite passed (Bearer, QueryParam, AuthFrame, Disconnect)"
  else
    log_fail "WebSocket streaming test suite failed"
  fi
else
  log_fail "Script ${ROOT_DIR}/scripts/test_ws_streaming.py missing"
fi

# --- STAGE 4: PWA Frontend Verification ---
log_stage "STAGE 4: Milestone 3 PWA Frontend Verification"

if [ -f "${ROOT_DIR}/scripts/test_pwa_verification.py" ]; then
  if "${PYTHON_BIN}" "${ROOT_DIR}/scripts/test_pwa_verification.py"; then
    log_pass "PWA verification suite passed (Assets, Manifest, DOM, Simulated Client)"
  else
    log_fail "PWA verification suite failed"
  fi
else
  log_info "PWA verification script will be created by Worker M3"
  # Spot-check static asset route
  root_code=$(curl -s -o /dev/null -w "%{http_code}" "${GATEWAY_URL}/" || true)
  if [ "$root_code" -eq 200 ]; then
    log_pass "Gateway root '/' successfully serves PWA with HTTP 200"
  else
    log_fail "Gateway root '/' returned HTTP $root_code (static serving not ready)"
  fi
fi

# --- STAGE 5: Unit & Integration Regression Suites ---
log_stage "STAGE 5: Go & Python Unit Regression Suites"

log_info "Running Go test suite (gateway, ws, brain)..."
if (cd "${ROOT_DIR}" && go test ./...); then
  log_pass "All Go unit and integration tests passed"
else
  log_fail "Go test suite had failures"
fi

log_info "Running Python FastAPI & Streaming tests..."
if (cd "${ROOT_DIR}/services/orchestrator" && "${PYTEST_BIN}" -q tests/test_internal_api.py tests/test_streaming.py); then
  log_pass "Python internal API and streaming test suites passed"
else
  log_fail "Python test suite had failures"
fi

# --- Summary ---
echo ""
echo -e "${YELLOW}================================================================${NC}"
echo -e "${YELLOW}                  E2E VERIFICATION SUMMARY                      ${NC}"
echo -e "${YELLOW}================================================================${NC}"
echo -e "Total Passed Checks: ${GREEN}${pass_count}${NC}"
echo -e "Total Failed Checks: ${RED}${fail_count}${NC}"

if [ "$fail_count" -eq 0 ]; then
  echo -e "\n${GREEN}🎉 ALL END-TO-END ACCEPTANCE CRITERIA MET!${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ END-TO-END VERIFICATION FAILED WITH ${fail_count} ERRORS!${NC}\n"
  exit 1
fi
```

---

## 7. End-to-End Acceptance Criteria Matrix

| Acceptance Criterion | Source | Target Component | Verification Method | Expected Outcome | Current Status |
|---|---|---|---|---|---|
| **PM2 Supervision** | `ORIGINAL_REQUEST.md` | `ecosystem.config.js` | `pm2 status` | Both `kiwi-gateway` and `kiwi-brain` online | **VERIFIED (PASS)** |
| **Go ↔ Python Bridge** | `ORIGINAL_REQUEST.md` | `/api/secure/chat` | `curl -X POST /api/secure/chat` with Bearer token | HTTP 200, JSON response with Kiwi persona | **VERIFIED (PASS)** |
| **Streaming WebSockets** | `ORIGINAL_REQUEST.md` | `/api/secure/ws` | `python3 scripts/test_ws_streaming.py` | 5/5 passed: `status.thinking` + token stream + `chat.complete` | **VERIFIED (PASS)** |
| **PWA Static Serving** | `ORIGINAL_REQUEST.md` | Gateway `main.go` | `curl -s http://127.0.0.1:8080/` | HTTP 200 HTML without auth | **BLOCKED on M3** (needs static mount) |
| **PWA Shell Assets** | `ORIGINAL_REQUEST.md` | `apps/mobile/public/` | `curl` for manifest, sw, styles, app.js | HTTP 200 with correct MIME types | **BLOCKED on M3** (`index.html`/`app.js` missing) |
| **PWA Client Chat** | `ORIGINAL_REQUEST.md` | `apps/mobile/public/app.js` | Simulated client in `test_pwa_verification.py` | Connects, authenticates, streams response | **BLOCKED on M3** (ready for worker) |

---

## 8. Concrete Recommendations for Worker M3 & Orchestrator

1. **Mounting Static Files in Go Gateway (`services/gateway/main.go`)**:
   - The worker must mount `http.FileServer` at `/`:
     ```go
     staticDir := "/root/kiwi/apps/mobile/public"
     fileServer := http.FileServer(http.Dir(staticDir))
     mux.Handle("/", fileServer)
     ```
   - Crucially, `mux.Handle("/", ...)` must be registered so that existing routes `/api/` and `/health` take precedence. In Go's `http.ServeMux`, the most specific pattern matches first, so `/api/` and `/health` are preserved while `/` catches all other static asset requests.
   - Recompile binary: `go build -o services/gateway/kiwi-gateway ./services/gateway`.
   - Restart Gateway: `pm2 restart kiwi-gateway`.
2. **Implement Missing Frontend Files**:
   - Create `apps/mobile/public/index.html` following the structure in Explorer 1's report.
   - Create `apps/mobile/public/app.js` with token storage, ping test, WebSocket streaming, avatar states, and auto-reconnect.
3. **Execute Test Harnesses**:
   - Create `/root/kiwi/scripts/test_pwa_verification.py` using the blueprint in Section 6.
   - Run `python3 scripts/test_pwa_verification.py` until all 5 stages pass.
   - Create `/root/kiwi/scripts/e2e_verify.sh` using the blueprint in Section 7.
   - Make executable (`chmod +x scripts/e2e_verify.sh`) and execute `bash scripts/e2e_verify.sh`.
