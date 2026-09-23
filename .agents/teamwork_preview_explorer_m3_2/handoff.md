# Handoff: Gateway Static Serving & Protocol Compatibility

**Author**: Explorer 2 (Gateway Static Serving Explorer)  
**Date**: 2026-09-21T00:33:00Z  
**Directory**: `/root/kiwi/.agents/teamwork_preview_explorer_m3_2`  
**Recipient**: Orchestrator / Worker M3  

---

## 1. Observation

1. **Current Gateway Routes**: In `/root/kiwi/services/gateway/main.go` lines 150–180:
   - Top-level router `mux := http.NewServeMux()` registers only `/health` and `/api/` (via `http.StripPrefix("/api", apiMux)`).
   - `/` has no registered handler.
   - Live command `curl -i http://127.0.0.1:8080/` returned verbatim:
     `HTTP/1.1 404 Not Found`
     `404 page not found`
   - Live command `curl -i http://127.0.0.1:8080/manifest.json` returned verbatim:
     `HTTP/1.1 404 Not Found`
2. **Auth Middleware Scope**: In `/root/kiwi/services/gateway/main.go` lines 172–174:
   ```go
   // Mount protected routes under /api/secure/ 
   apiMux.Handle("/secure/", http.StripPrefix("/secure", auth.AuthMiddleware(protectedMux)))
   ```
   `auth.AuthMiddleware` is applied exclusively to `protectedMux` (`/api/secure/ping`, `/api/secure/chat`). It is not applied to top-level `mux`.
3. **WebSocket Handshake Mounting & Isolation**: In `/root/kiwi/services/gateway/main.go` lines 168–170:
   ```go
   // Mount WebSocket route under /api/secure/ws
   apiMux.HandleFunc("/secure/ws", func(w http.ResponseWriter, r *http.Request) {
       ws.ServeWS(wsHub, w, r)
   })
   ```
   In `http.ServeMux`, the exact match `/secure/ws` (length 10) takes precedence over prefix `/secure/` (length 8). Thus, `/api/secure/ws` does not pass through `auth.AuthMiddleware`.
4. **WebSocket Multi-Method Authentication**: In `/root/kiwi/services/gateway/ws/hub.go` lines 380–450 and 196–236:
   - Line 386–400: Checks `Authorization: Bearer <token>`.
   - Line 403–411: Checks query parameter `r.URL.Query().Get("token")`.
   - Line 430–446: Sets a 5-second `authTimer` for unauthenticated connections.
   - Line 204–227: Validates in-band `{"type": "auth", "token": "..."}` or `{"type": "auth", "content": "..."}` JSON frames.
   - Line 39–41: Upgrader sets `CheckOrigin: func(r *http.Request) bool { return true }`.
5. **Empirical Verification of WebSocket**:
   Command `python3 scripts/test_ws_streaming.py` executed against live PM2 gateway and returned:
   ```
   --- Test 1: Bearer Header Auth & Live Token Streaming --- ✓ Test 1 Passed!
   --- Test 2: Query Param Auth & Streaming --- ✓ Test 2 Passed!
   --- Test 3: Initial Auth Frame Auth (within 5s deadline) --- ✓ Test 3 Passed!
   --- Test 4: Invalid Auth Rejection --- ✓ Test 4 Passed!
   --- Test 5: Client Disconnect Mid-Stream Resilience --- ✓ Test 5 Passed!
   ALL WEBSOCKET STREAMING TESTS PASSED (5/5)!
   ```
6. **Mobile Static Assets Layout**: In `/root/kiwi/apps/mobile/public/`:
   `styles.css` (12,784 bytes), `manifest.json` (785 bytes), `sw.js` (2,626 bytes), `icon.svg` (2,059 bytes), `icon-192.png` (2,245 bytes), `icon-512.png` (6,543 bytes).
   `apps/mobile/public/manifest.json` defines `"start_url": "/"` and `"scope": "/"`.
   `apps/mobile/public/sw.js` defines `SHELL_ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', ...]`.
7. **CORS Absences**: In `/root/kiwi/services/gateway`, ripgrep search for `cors` yielded 0 matches.

---

## 2. Logic Chain

1. **Premise**: Navigating to `http://127.0.0.1:8080/` currently returns 404 (Observation 1), but the PWA specification expects users to access the application directly at `http://127.0.0.1:8080/` with scope `/` (Observation 6).
2. **Inference 1**: Mounting static file serving at root `/` on top-level `mux` allows `http://127.0.0.1:8080/` to serve `index.html` and resolve all asset URLs (`/styles.css`, `/app.js`, `/manifest.json`, `/sw.js`, `/icon.svg`).
3. **Inference 2**: In Go 1.22 `http.ServeMux`, the longest matching pattern wins. Registered prefix `/api/` (len 5) and exact match `/health` (len 7) are strictly longer than `/` (len 1). Therefore, mounting `/` cannot intercept or break `/api/...` or `/health`.
4. **Inference 3**: Because `auth.AuthMiddleware` is attached only to `/secure/` on `apiMux` (Observation 2), any route on top-level `mux` outside `/api/` completely bypasses token authentication. Static assets can be loaded anonymously by web browsers.
5. **Inference 4**: Standard browser JavaScript cannot set custom headers during `new WebSocket(...)`. Because `/api/secure/ws` bypasses `auth.AuthMiddleware` (Observation 3) and accepts `?token=` query parameter or in-band auth frames (Observations 4 & 5), browser WebSocket connections will authenticate without friction.
6. **Inference 5**: While same-origin requests do not require CORS, preflight `OPTIONS` requests from external origins or dev servers currently fail. Adding zero-dependency `corsMiddleware` in Go Gateway prevents cross-origin failures.

---

## 3. Caveats

1. `index.html` and `app.js` are currently not yet created in `apps/mobile/public/` (being drafted by Explorer 1 / Worker M3). Static serving of `/` will return 404 until `index.html` is placed into `apps/mobile/public/`.
2. Directory resolution must account for PM2 (`cwd: /root/kiwi`) vs manual CLI runs (`cwd: services/gateway`). An adaptive resolver checking candidate paths is required.
3. No caveats regarding WebSocket or auth compatibility; both are fully verified.

---

## 4. Conclusion

1. Mount static file serving directly at `/` on `mux` using an adaptive directory resolver and a dedicated `staticFileHandler` that adds PWA headers (`Cache-Control: no-cache` for `/sw.js`, `application/manifest+json` for `/manifest.json`) and SPA fallback to `index.html`.
2. Public assets will automatically bypass `auth.AuthMiddleware` with zero router conflicts.
3. WebSocket handshake at `/api/secure/ws` is already compatible with browser authentication via `?token=` and in-band frames.
4. Wrap top-level `mux` with `corsMiddleware` to support preflight `OPTIONS` and cross-origin access.
5. Full implementation details, code snippets, and test cases are documented in `/root/kiwi/.agents/teamwork_preview_explorer_m3_2/report.md`.

---

## 5. Verification Method

1. **Unit Tests**:
   Run `cd /root/kiwi && go test -v ./services/gateway/...`
   Expected: All unit tests pass.
2. **PM2 Rebuild & Restart**:
   ```bash
   cd /root/kiwi/services/gateway && go build -o kiwi-gateway .
   pm2 restart kiwi-gateway
   ```
3. **Live Endpoint Assertions**:
   - `curl -i http://127.0.0.1:8080/manifest.json` -> HTTP 200 OK, `Content-Type: application/manifest+json`
   - `curl -i http://127.0.0.1:8080/sw.js` -> HTTP 200 OK, `Cache-Control: no-cache, no-store, must-revalidate`
   - `curl -i http://127.0.0.1:8080/health` -> HTTP 200 OK, `{"status":"ok",...}`
   - `curl -i -X OPTIONS http://127.0.0.1:8080/api/secure/ping` -> HTTP 200 OK with `Access-Control-Allow-Origin: *`
   - `curl -i http://127.0.0.1:8080/api/secure/ping` -> HTTP 401 Unauthorized
   - `curl -i -H "Authorization: Bearer kiwi_secret_token_dev" http://127.0.0.1:8080/api/secure/ping` -> HTTP 200 OK
   - `python3 scripts/test_ws_streaming.py` -> 5/5 tests pass.
