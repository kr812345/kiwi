package main

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

type HealthResponse struct {
	Status   string `json:"status"`
	Message  string `json:"message"`
	Version  string `json:"version"`
	Database string `json:"database"`
	Brain    string `json:"brain"`
}

type ChatRequest struct {
	ConversationID string `json:"conversation_id,omitempty"`
	Message        string `json:"message"`
}

type ChatResponse struct {
	ConversationID string `json:"conversation_id"`
	Response       string `json:"response"`
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	dbStatus := "disconnected"
	if db.Pool != nil {
		dbStatus = "connected"
	}

	brainStatus := "disconnected"
	if brain.HealthWithContext(r.Context()) {
		brainStatus = "connected"
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(HealthResponse{
		Status:   "ok",
		Message:  "Kiwi API Gateway is running",
		Version:  "0.1.0",
		Database: dbStatus,
		Brain:    brainStatus,
	})
}

func pingHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "pong - authenticated successfully!"})
}

// chatHandler bridges user chat requests to the Synapse OS Python brain
func chatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Message) == "" {
		http.Error(w, "Message cannot be empty", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	convID := req.ConversationID

	// If no conversation exists, create a new one (if DB is connected)
	if convID == "" {
		if db.Pool != nil {
			var err error
			convID, err = db.CreateConversation(ctx, "New Chat")
			if err != nil {
				log.Printf("Warning: error creating conversation in DB: %v", err)
			}
		}
		if convID == "" {
			convID = fmt.Sprintf("conv-%d", time.Now().UnixNano())
		}
	}

	// 1. Save User Message (if DB connected)
	if db.Pool != nil {
		if _, err := db.InsertMessage(ctx, convID, "user", req.Message); err != nil {
			log.Printf("Warning: failed to insert user message in DB: %v", err)
		}
	}

	// 2. Forward request to Synapse OS Python Brain
	brainReq := brain.ChatRequest{
		Message:        req.Message,
		ConversationID: convID,
		SessionID:      convID,
	}

	brainResp, err := brain.ChatWithContext(ctx, brainReq)
	if err != nil {
		log.Printf("Brain communication failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Brain temporarily unavailable: " + err.Error(),
		})
		return
	}

	// 3. Save Assistant Message (if DB connected)
	if db.Pool != nil {
		if _, err := db.InsertMessage(ctx, convID, "assistant", brainResp.Response); err != nil {
			log.Printf("Warning: failed to insert assistant message in DB: %v", err)
		}
	}

	// 4. Return response to user
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChatResponse{
		ConversationID: convID,
		Response:       brainResp.Response,
	})
}

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

		// Directly serve index.html for root and /index.html to avoid 301 redirects
		if cleanPath == "/" || cleanPath == "/index.html" {
			indexPath := filepath.Join(staticDir, "index.html")
			data, err := os.ReadFile(indexPath)
			if err == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				w.Write(data)
				return
			}
		}

		// Check if file exists on disk
		fullPath := filepath.Join(staticDir, cleanPath)
		info, err := os.Stat(fullPath)
		if err != nil || info.IsDir() {
			// If file does not exist and request does not look like a static asset,
			// fallback to index.html for SPA client-side routing
			ext := filepath.Ext(cleanPath)
			if ext == "" {
				indexPath := filepath.Join(staticDir, "index.html")
				data, err := os.ReadFile(indexPath)
				if err == nil {
					w.Header().Set("Content-Type", "text/html; charset=utf-8")
					w.WriteHeader(http.StatusOK)
					w.Write(data)
					return
				}
			}
		}

		fs.ServeHTTP(w, r)
	})
}

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
	protectedMux.HandleFunc("/chat", chatHandler) // New Chat Endpoint!
	
	// Initialize WebSocket Hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Mount WebSocket route under /api/secure/ws
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
		Handler: corsMiddleware(mux),
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
