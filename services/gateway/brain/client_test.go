package brain

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestChat_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/chat" {
			t.Errorf("expected path /internal/chat, got %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}

		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}

		if req.Message != "ping" {
			t.Errorf("expected message 'ping', got '%s'", req.Message)
		}

		resp := ChatResponse{
			Response:       "pong from kiwi",
			ConversationID: req.ConversationID,
			ModelUsed:      "gemini-2.5-flash",
			Tokens: map[string]int{
				"prompt_tokens":     10,
				"completion_tokens": 15,
				"total_tokens":      25,
			},
			CostUSD: 0.0001,
			Persona: map[string]any{
				"name": "Kiwi",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	// Temporarily override BaseURL
	oldBaseURL := BaseURL
	BaseURL = server.URL
	defer func() { BaseURL = oldBaseURL }()

	chatResp, err := Chat(ChatRequest{
		Message:        "ping",
		ConversationID: "conv-123",
	})
	if err != nil {
		t.Fatalf("unexpected error from Chat: %v", err)
	}

	if chatResp.Response != "pong from kiwi" {
		t.Errorf("expected 'pong from kiwi', got '%s'", chatResp.Response)
	}
	if chatResp.ConversationID != "conv-123" {
		t.Errorf("expected 'conv-123', got '%s'", chatResp.ConversationID)
	}
	if chatResp.ModelUsed != "gemini-2.5-flash" {
		t.Errorf("expected model 'gemini-2.5-flash', got '%s'", chatResp.ModelUsed)
	}
}

func TestChat_Unreachable(t *testing.T) {
	oldBaseURL := BaseURL
	BaseURL = "http://127.0.0.1:54321" // Port not in use
	defer func() { BaseURL = oldBaseURL }()

	_, err := Chat(ChatRequest{Message: "test"})
	if err == nil {
		t.Fatal("expected error for unreachable brain, got nil")
	}
}

func TestChat_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}))
	defer server.Close()

	oldBaseURL := BaseURL
	BaseURL = server.URL
	defer func() { BaseURL = oldBaseURL }()

	_, err := Chat(ChatRequest{Message: "test"})
	if err == nil {
		t.Fatal("expected error for 500 status, got nil")
	}
}

func TestHealth_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	oldBaseURL := BaseURL
	BaseURL = server.URL
	defer func() { BaseURL = oldBaseURL }()

	if !Health() {
		t.Error("expected Health() to return true, got false")
	}
}

func TestHealth_Failure(t *testing.T) {
	oldBaseURL := BaseURL
	BaseURL = "http://127.0.0.1:54321"
	defer func() { BaseURL = oldBaseURL }()

	if Health() {
		t.Error("expected Health() to return false for unreachable service, got true")
	}
}

func TestChatStream_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/chat/stream" {
			t.Errorf("expected path /internal/chat/stream, got %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}

		w.Header().Set("Content-Type", "text/event-stream")
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("expected flusher")
		}

		w.Write([]byte("data: {\"token\": \"hello\"}\n\n"))
		flusher.Flush()
		w.Write([]byte("data: {\"token\": \" \"}\n\n"))
		flusher.Flush()
		w.Write([]byte("data: {\"token\": \"kiwi\"}\n\n"))
		flusher.Flush()
		w.Write([]byte("data: {\"done\": true}\n\n"))
		flusher.Flush()
	}))
	defer server.Close()

	oldBaseURL := BaseURL
	BaseURL = server.URL
	defer func() { BaseURL = oldBaseURL }()

	var collected []string
	err := ChatStream(context.Background(), ChatRequest{Message: "hi"}, func(token string) error {
		collected = append(collected, token)
		return nil
	})

	if err != nil {
		t.Fatalf("unexpected error from ChatStream: %v", err)
	}

	result := strings.Join(collected, "")
	if result != "hello kiwi" {
		t.Errorf("expected 'hello kiwi', got '%s'", result)
	}
}

func TestChatStream_ErrorEvent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Write([]byte("data: {\"error\": \"simulation model failure\"}\n\n"))
	}))
	defer server.Close()

	oldBaseURL := BaseURL
	BaseURL = server.URL
	defer func() { BaseURL = oldBaseURL }()

	err := ChatStream(context.Background(), ChatRequest{Message: "hi"}, func(token string) error {
		return nil
	})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "simulation model failure") {
		t.Errorf("expected error containing 'simulation model failure', got %v", err)
	}
}

func TestChatStream_CallbackAbort(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Write([]byte("data: {\"token\": \"first\"}\n\ndata: {\"token\": \"second\"}\n\n"))
	}))
	defer server.Close()

	oldBaseURL := BaseURL
	BaseURL = server.URL
	defer func() { BaseURL = oldBaseURL }()

	abortErr := fmt.Errorf("client disconnected")
	count := 0
	err := ChatStream(context.Background(), ChatRequest{Message: "hi"}, func(token string) error {
		count++
		return abortErr
	})

	if err != abortErr {
		t.Errorf("expected abortErr, got %v", err)
	}
	if count != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}
