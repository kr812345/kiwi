# Gateway Static Serving & Protocol Compatibility Report

**Agent**: Explorer 2 (Gateway Static Serving Explorer)  
**Date**: 2026-09-21  
**Working Directory**: `/root/kiwi/.agents/teamwork_preview_explorer_m3_2`  
**Target Subsystem**: Kiwi Go API Gateway (`/root/kiwi/services/gateway`)  

---

## 1. Executive Summary

This investigation analyzed the Go API Gateway (`services/gateway`) to determine the exact requirements and architecture for serving the Milestone 3 Mobile PWA (`apps/mobile/public`), ensuring public asset access without authentication blockers, verifying WebSocket handshake compatibility, and resolving CORS and header considerations.

### Key Conclusions:
1. **Mounting Static Files at Root (`/`)**: Static file serving must be mounted directly at root (`/`) on the top-level `http.ServeMux`. In Go 1.22 `http.ServeMux`, specific patterns (`/health`) and prefix subtrees (`/api/`) take strict precedence over catch-all `/`. Mounting static files at `/` preserves all existing API and health routes with zero regressions while allowing users navigating to `http://127.0.0.1:8080/` to immediately load the PWA.
2. **Auth Middleware Exemption**: Authentication middleware (`auth.AuthMiddleware`) is scoped strictly to `/api/secure/` sub-routes (`/ping`, `/chat`). Static routes mounted at `/` completely bypass `AuthMiddleware`, enabling browsers to load `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, and icon assets anonymously prior to user login.
3. **WebSocket Handshake Compatibility**: The WebSocket hub (`/api/secure/ws`) is mounted directly on `apiMux.HandleFunc("/secure/ws", ...)` outside `auth.AuthMiddleware`. It independently supports three authentication mechanisms: HTTP `Authorization: Bearer <token>` header, query parameter `?token=<token>`, and post-handshake in-band `{"type":"auth","token":"..."}` frame (5s timeout). Browser `new WebSocket(url)` cannot set custom HTTP headers, so the query parameter `?token=` and in-band frame mechanisms are fully operational and verified.
4. **CORS & Headers**: Currently, the Go Gateway has no CORS middleware. While same-origin requests on `http://127.0.0.1:8080` do not require CORS, adding a lightweight CORS middleware in Go Gateway allows cross-origin test harnesses, dev servers (e.g. port 3000/5173), and preflight `OPTIONS` requests to succeed. Additionally, `/sw.js` requires `Cache-Control: no-cache` to avoid stale service worker caches, and `manifest.json` requires `application/manifest+json`.

---

## 2. Current Gateway Routing Topology

The current Go Gateway router is configured in `/root/kiwi/services/gateway/main.go` (lines 150–180):

```go
// Top-level Mux
mux := http.NewServeMux()

// API Mux
apiMux := http.NewServeMux()
apiMux.HandleFunc("/health", healthCheckHandler)

// Protected API Mux
protectedMux := http.NewServeMux()
protectedMux.HandleFunc("/ping", pingHandler)
protectedMux.HandleFunc("/chat", chatHandler)

// WebSocket Hub
apiMux.HandleFunc("/secure/ws", func(w http.ResponseWriter, r *http.Request) {
    ws.ServeWS(wsHub, w, r)
})

// Protected routes wrapped in AuthMiddleware
apiMux.Handle("/secure/", http.StripPrefix("/secure", auth.AuthMiddleware(protectedMux)))

// API Mux mounted on top-level
mux.Handle("/api/", http.StripPrefix("/api", apiMux))

// Public health check
mux.HandleFunc("/health", healthCheckHandler)
```

### Route Resolution Table (Current State)

| URL Path | Matcher Pattern | Handler | Auth Required? |
|---|---|---|---|
| `GET /health` | Exact `/health` (len 7) | `healthCheckHandler` | No |
| `GET /api/health` | Prefix `/api/` (len 5) -> `/health` | `healthCheckHandler` | No |
| `GET /api/secure/ping` | Prefix `/api/` -> `/secure/` | `auth.AuthMiddleware` -> `pingHandler` | **Yes** (`Bearer <token>`) |
| `POST /api/secure/chat` | Prefix `/api/` -> `/secure/` | `auth.AuthMiddleware` -> `chatHandler` | **Yes** (`Bearer <token>`) |
| `GET /api/secure/ws` | Prefix `/api/` -> `/secure/ws` (len 10) | `ws.ServeWS` | **Handshake/Param/Frame Auth** |
| `GET /` | None (no root handler) | Go default 404 | N/A |
| `GET /manifest.json` | None | Go default 404 | N/A |
| `GET /sw.js` | None | Go default 404 | N/A |

Empirically verified via live curl:
- `curl -i http://127.0.0.1:8080/` -> `HTTP/1.1 404 Not Found`
- `curl -i http://127.0.0.1:8080/manifest.json` -> `HTTP/1.1 404 Not Found`

---

## 3. Investigation Finding 1: Static Route Mounting Strategy

### 3.1 Recommendation: Serve at Root (`/`)
Static files MUST be mounted at `/` on the top-level `mux`.
- **User Experience**: Navigating directly to `http://127.0.0.1:8080/` serves `index.html`.
- **PWA Standard Compliance**: `apps/mobile/public/manifest.json` specifies `"start_url": "/"` and `"scope": "/"`. Serving at `/` guarantees that the PWA install prompt and service worker scope operate natively without redirect loops or path mismatches.
- **Service Worker Scope**: The Service Worker specification limits a service worker's maximum scope to the path of the script itself. By serving `/sw.js` at root, its default scope covers the entire origin (`/`), intercepting all app navigations.
- **Asset Relative Links**: Assets referenced as `/styles.css`, `/app.js`, `/manifest.json`, `/icon.svg` resolve cleanly.

### 3.2 Go 1.22 `http.ServeMux` Precedence Rules
A common concern when mounting at `/` is whether it intercepts or shadows `/api/...` or `/health`.
In Go's `http.ServeMux`:
1. Exact pattern matches take highest priority (e.g., `/health`).
2. Prefix patterns (patterns ending with `/`) are matched by longest prefix:
   - `/api/` has length 5.
   - `/` has length 1.
3. Therefore:
   - Any request starting with `/api/` will ALWAYS route to `apiMux`.
   - Any request to `/health` will ALWAYS route to `healthCheckHandler`.
   - Requests to `/`, `/styles.css`, `/app.js`, `/sw.js`, etc. will route to the root file server.

### 3.3 Directory Resolution Resilience
In PM2 production (`ecosystem.config.js`), the gateway working directory is set to `/root/kiwi`. Relative path `"apps/mobile/public"` resolves correctly.
However, during test runs or when running `go run main.go` from `services/gateway`, cwd is `services/gateway`.
To prevent directory resolution failures, the gateway must use an adaptive path resolver:
```go
func getStaticDir() string {
    if dir := os.Getenv("STATIC_DIR"); dir != "" {
        return dir
    }
    candidates := []string{
        "apps/mobile/public",
        "../../apps/mobile/public",
        "../apps/mobile/public",
        "/root/kiwi/apps/mobile/public",
    }
    for _, c := range candidates {
        if fi, err := os.Stat(c); err == nil && fi.IsDir() {
            return c
        }
    }
    return "apps/mobile/public"
}
```

### 3.4 Custom Static Handler Features
Rather than bare `http.FileServer`, a dedicated `staticFileHandler` provides:
1. **SPA Fallback**: If a path without a file extension is requested (e.g., direct navigation to `/chat` or `/settings`), fallback to serving `index.html`.
2. **PWA Header Injection**:
   - For `/sw.js`: Inject `Cache-Control: no-cache, no-store, must-revalidate` and `Service-Worker-Allowed: /`.
   - For `/manifest.json`: Ensure `Content-Type: application/manifest+json`.
3. **Safety Guards**: Reject any path starting with `/api/` or `/health` inside the file server as an extra defense layer.

---

## 4. Investigation Finding 2: Auth Middleware Review & Public Route Exemption

### 4.1 Auth Middleware Implementation
In `services/gateway/auth/middleware.go`:
```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        expectedToken := os.Getenv("API_TOKEN")
        if expectedToken == "" {
            http.Error(w, "Server auth is not configured", http.StatusInternalServerError)
            return
        }
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "Unauthorized - Missing token", http.StatusUnauthorized)
            return
        }
        parts := strings.Split(authHeader, " ")
        if len(parts) != 2 || parts[0] != "Bearer" || parts[1] != expectedToken {
            http.Error(w, "Unauthorized - Invalid token", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### 4.2 Route Exemption Verification
- `AuthMiddleware` is applied ONLY to `protectedMux` via `apiMux.Handle("/secure/", ...)`.
- Static files mounted at `mux.Handle("/", staticFileHandler(...))` are attached to the root mux, completely outside `AuthMiddleware`.
- **Browser Lifecycle**:
  1. Unauthenticated browser loads `http://127.0.0.1:8080/` -> 200 OK (renders Kiwi UI shell & auth modal).
  2. Browser fetches `/styles.css`, `/app.js`, `/manifest.json`, `/sw.js`, `/icon.svg` -> 200 OK.
  3. User enters token in modal -> UI issues `GET /api/secure/ping` with `Authorization: Bearer <token>`.
  4. Gateway returns 200 OK (`{"message": "pong - authenticated successfully!"}`).
  5. UI stores token in `localStorage` and connects to `/api/secure/ws`.

Static assets are 100% exempt from token authentication.

---

## 5. Investigation Finding 3: WebSocket Handshake & Auth Compatibility

### 5.1 Route Isolation from AuthMiddleware
In `services/gateway/main.go`:
```go
apiMux.HandleFunc("/secure/ws", func(w http.ResponseWriter, r *http.Request) {
    ws.ServeWS(wsHub, w, r)
})
apiMux.Handle("/secure/", http.StripPrefix("/secure", auth.AuthMiddleware(protectedMux)))
```
Because `/secure/ws` (length 10) is an exact match on `apiMux`, it takes precedence over the prefix match `/secure/` (length 8).
As a result, `/api/secure/ws` NEVER executes `auth.AuthMiddleware`.

### 5.2 Supported WebSocket Authentication Methods
In `services/gateway/ws/hub.go`, `ServeWS` and `readPump` implement three distinct authentication paths:

| Method | Transport | Mechanism | Target Client |
|---|---|---|---|
| **1. Header Auth** | HTTP Handshake | `Authorization: Bearer <token>` | Python scripts, Go clients, curl, websocat |
| **2. Query Param Auth** | HTTP Handshake | `GET /api/secure/ws?token=<token>` | Browser PWA (`new WebSocket(...)`) |
| **3. In-Band Frame** | WebSocket Frame | `{"type":"auth","token":"<token>"}` within 5s | Browser PWA fallback, restricted proxies |

### 5.3 Empirical Verification
Live test run of `/root/kiwi/scripts/test_ws_streaming.py` against running PM2 gateway on port 8080:
- `Test 1: Bearer Header Auth & Live Token Streaming` -> **PASSED** (18 token chunks received).
- `Test 2: Query Param Auth & Streaming` -> **PASSED** (17 token chunks received via `?token=kiwi_secret_token_dev`).
- `Test 3: Initial Auth Frame Auth (within 5s)` -> **PASSED** (17 token chunks received).
- `Test 4: Invalid Auth Rejection` -> **PASSED** (Rejected with HTTP 401).
- `Test 5: Client Disconnect Mid-Stream` -> **PASSED** (Clean disconnect without crash or leak).

### 5.4 Origin Verification
In `services/gateway/ws/hub.go` (line 39):
```go
var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        return true // Allow all origins for API Gateway
    },
}
```
`CheckOrigin` always returns `true`. The WebSocket upgrade will never fail due to CORS/Origin restrictions regardless of host or port.

---

## 6. Investigation Finding 4: CORS & MIME-Type Handling

### 6.1 CORS Analysis
- **Same-Origin (PWA served from Gateway)**:
  When the PWA is served directly from `http://127.0.0.1:8080/`, all fetch calls to `/api/secure/ping` and `/api/secure/chat` are same-origin. The browser does not send CORS preflight requests.
- **Cross-Origin Scenario (Dev Server / Headless E2E)**:
  If an engineer or test runner connects from another origin (e.g. `localhost:3000` or `null` in mobile webview), the browser issues an `OPTIONS` preflight.
  Currently, `OPTIONS /api/secure/ping` would be rejected with 401 because `auth.AuthMiddleware` requires an Authorization header that browser `OPTIONS` requests do not send.
- **Recommendation**:
  Wrap the entire top-level router in a lightweight `corsMiddleware` that automatically answers `OPTIONS` requests with 200 OK and sets:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Authorization, Content-Type, Accept`

### 6.2 MIME-Type Resolution
The host operating system's MIME registry (`/etc/mime.types`) maps:
- `.js` -> `text/javascript`
- `.css` -> `text/css`
- `.json` -> `application/json`
- `.svg` -> `image/svg+xml`
- `.png` -> `image/png`

For optimal PWA compliance, `staticFileHandler` should explicitly enforce:
- `manifest.json`: `Content-Type: application/manifest+json; charset=utf-8`
- `sw.js`: `Content-Type: application/javascript; charset=utf-8`

---

## 7. Concrete Implementation Blueprint for Worker

The worker should apply the following modifications to `/root/kiwi/services/gateway/main.go`.

### 7.1 New Helper Functions in `services/gateway/main.go`

```go
import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"kiwi/services/gateway/auth"
	"kiwi/services/gateway/brain"
	"kiwi/services/gateway/db"
	"kiwi/services/gateway/ws"
)

// getStaticDir dynamically discovers the static files directory
func getStaticDir() string {
	if dir := os.Getenv("STATIC_DIR"); dir != "" {
		return dir
	}
	candidates := []string{
		"apps/mobile/public",
		"../../apps/mobile/public",
		"../apps/mobile/public",
		"/root/kiwi/apps/mobile/public",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			return c
		}
	}
	return "apps/mobile/public"
}

// corsMiddleware adds standard CORS headers and handles preflight OPTIONS
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// staticFileHandler serves PWA assets with cache control, manifest types, and SPA fallback
func staticFileHandler(staticDir string) http.Handler {
	fs := http.FileServer(http.Dir(staticDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := filepath.Clean(r.URL.Path)

		// Safety guard: do not handle API or health routes
		if strings.HasPrefix(cleanPath, "/api/") || cleanPath == "/health" {
			http.NotFound(w, r)
			return
		}

		// Service worker must never be aggressively cached
		if strings.HasSuffix(cleanPath, "sw.js") {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Service-Worker-Allowed", "/")
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		} else if strings.HasSuffix(cleanPath, "manifest.json") {
			w.Header().Set("Content-Type", "application/manifest+json; charset=utf-8")
		}

		// Check if file exists on disk
		fullPath := filepath.Join(staticDir, cleanPath)
		info, err := os.Stat(fullPath)
		if err != nil || info.IsDir() {
			// If file does not exist and request does not look like a static asset,
			// fallback to index.html for SPA client-side routing
			ext := filepath.Ext(cleanPath)
			if ext == "" || cleanPath == "/" {
				indexPath := filepath.Join(staticDir, "index.html")
				if _, err := os.Stat(indexPath); err == nil {
					http.ServeFile(w, r, indexPath)
					return
				}
			}
		}

		fs.ServeHTTP(w, r)
	})
}
```

### 7.2 Updated `main()` in `services/gateway/main.go`

```go
func main() {
	// Initialize Database
	if err := db.InitDB(); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	defer db.CloseDB()

	// Initialize router
	mux := http.NewServeMux()

	// API Router
	apiMux := http.NewServeMux()

	// Public API routes
	apiMux.HandleFunc("/health", healthCheckHandler)

	// Protected API routes
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("/ping", pingHandler)
	protectedMux.HandleFunc("/chat", chatHandler)

	// Initialize WebSocket Hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Mount WebSocket route under /api/secure/ws (bypasses auth middleware)
	apiMux.HandleFunc("/secure/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(wsHub, w, r)
	})

	// Mount protected routes under /api/secure/ 
	apiMux.Handle("/secure/", http.StripPrefix("/secure", auth.AuthMiddleware(protectedMux)))

	// Mount API under /api/
	mux.Handle("/api/", http.StripPrefix("/api", apiMux))

	// Keep a root public health check for infrastructure monitors
	mux.HandleFunc("/health", healthCheckHandler)

	// Mount PWA static file server at root "/"
	staticDir := getStaticDir()
	log.Printf("Serving static assets from: %s\n", staticDir)
	mux.Handle("/", staticFileHandler(staticDir))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: corsMiddleware(mux), // Wrap router with CORS middleware
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Starting Kiwi API Gateway on port %s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v\n", err)
		}
	}()

	<-stop
	log.Println("\nShutting down Gateway gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Gateway Shutdown Failed: %+v", err)
	}

	log.Println("Gateway exited gracefully")
}
```

---

## 8. Unit Test Plan (`services/gateway/main_test.go`)

The worker should add the following automated tests to verify routing, static serving, and CORS behavior:

```go
func TestStaticFileServing_PublicAssets(t *testing.T) {
	staticDir := getStaticDir()
	handler := staticFileHandler(staticDir)

	// Test manifest.json
	req := httptest.NewRequest(http.MethodGet, "/manifest.json", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for manifest.json, got %d", w.Code)
	}
	if !strings.Contains(w.Header().Get("Content-Type"), "application/manifest+json") {
		t.Errorf("unexpected content type for manifest: %s", w.Header().Get("Content-Type"))
	}

	// Test sw.js
	reqSW := httptest.NewRequest(http.MethodGet, "/sw.js", nil)
	wSW := httptest.NewRecorder()
	handler.ServeHTTP(wSW, reqSW)
	if wSW.Code != http.StatusOK {
		t.Errorf("expected status 200 for sw.js, got %d", wSW.Code)
	}
	if wSW.Header().Get("Cache-Control") != "no-cache, no-store, must-revalidate" {
		t.Errorf("unexpected Cache-Control for sw.js: %s", wSW.Header().Get("Cache-Control"))
	}
	if wSW.Header().Get("Service-Worker-Allowed") != "/" {
		t.Errorf("unexpected Service-Worker-Allowed: %s", wSW.Header().Get("Service-Worker-Allowed"))
	}
}

func TestRoutePrecedence_HealthNotShadowed(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheckHandler)
	mux.Handle("/", staticFileHandler(getStaticDir()))

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Kiwi API Gateway is running") {
		t.Errorf("expected health check body, got %s", w.Body.String())
	}
}

func TestCORSMiddleware_Preflight(t *testing.T) {
	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/secure/ping", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for OPTIONS, got %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("missing or invalid Access-Control-Allow-Origin")
	}
}
```

---

## 9. Verification & Acceptance Checklist for Worker

After making changes:

1. **Compilation & Unit Tests**:
   ```bash
   cd /root/kiwi/services/gateway
   go build -o kiwi-gateway .
   go test -v ./...
   ```
2. **PM2 Reload**:
   ```bash
   pm2 restart kiwi-gateway
   pm2 status
   ```
3. **Live Endpoint Verification**:
   - `curl -i http://127.0.0.1:8080/` -> 200 OK (returns `index.html`).
   - `curl -i http://127.0.0.1:8080/styles.css` -> 200 OK (`Content-Type: text/css`).
   - `curl -i http://127.0.0.1:8080/manifest.json` -> 200 OK (`Content-Type: application/manifest+json`).
   - `curl -i http://127.0.0.1:8080/sw.js` -> 200 OK (`Cache-Control: no-cache, no-store, must-revalidate`).
   - `curl -i http://127.0.0.1:8080/health` -> 200 OK (`{"status":"ok",...}`).
   - `curl -i -X OPTIONS http://127.0.0.1:8080/api/secure/ping` -> 200 OK with `Access-Control-Allow-Origin: *`.
   - `curl -i http://127.0.0.1:8080/api/secure/ping` -> 401 Unauthorized.
   - `curl -i -H "Authorization: Bearer kiwi_secret_token_dev" http://127.0.0.1:8080/api/secure/ping` -> 200 OK.
   - `python3 scripts/test_ws_streaming.py` -> 5/5 WebSocket tests pass.
