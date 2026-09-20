package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	
	"kiwi/services/gateway/auth"
	"kiwi/services/gateway/db"
)

type HealthResponse struct {
	Status   string `json:"status"`
	Message  string `json:"message"`
	Version  string `json:"version"`
	Database string `json:"database"`
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
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(HealthResponse{
		Status:   "ok",
		Message:  "Kiwi API Gateway is running",
		Version:  "0.1.0",
		Database: dbStatus,
	})
}

func pingHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "pong - authenticated successfully!"})
}

// chatHandler acts as the Iteration 1 Dumb Echo Orchestrator
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

	ctx := r.Context()
	convID := req.ConversationID

	// If no conversation exists, create a new one
	if convID == "" {
		var err error
		convID, err = db.CreateConversation(ctx, "New Chat")
		if err != nil {
			log.Printf("Error creating conversation: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
	}

	// 1. Save User Message
	_, err := db.InsertMessage(ctx, convID, "user", req.Message)
	if err != nil {
		log.Printf("Error inserting user message: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// 2. Dummy "Echo" Agent Logic
	echoResponse := "Echo: I heard you say '" + req.Message + "'"

	// 3. Save Assistant Message
	_, err = db.InsertMessage(ctx, convID, "assistant", echoResponse)
	if err != nil {
		log.Printf("Error inserting assistant message: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// 4. Return response to user
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChatResponse{
		ConversationID: convID,
		Response:       echoResponse,
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
	
	// Mount protected routes under /api/secure/ 
	apiMux.Handle("/secure/", http.StripPrefix("/secure", auth.AuthMiddleware(protectedMux)))

	// Mount API under /api/
	mux.Handle("/api/", http.StripPrefix("/api", apiMux))
	
	// Keep a root public health check for infrastructure monitors
	mux.HandleFunc("/health", healthCheckHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
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
