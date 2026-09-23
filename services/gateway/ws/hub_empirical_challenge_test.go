package ws

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"kiwi/services/gateway/brain"
)

// TestServeWS_BrainFailure_ErrorFrame verifies whether the gateway emits an error frame when the brain returns 503.
func TestServeWS_BrainFailure_ErrorFrame(t *testing.T) {
	// Setup brain server that returns 503 Service Unavailable
	errorBrainServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/chat/stream" {
			http.Error(w, "Brain kernel crashed", http.StatusServiceUnavailable)
			return
		}
		http.NotFound(w, r)
	}))
	defer errorBrainServer.Close()

	oldBaseURL := brain.BaseURL
	brain.BaseURL = errorBrainServer.URL
	defer func() { brain.BaseURL = oldBaseURL }()

	os.Setenv("API_TOKEN", "test_token_err")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	header := http.Header{}
	header.Set("Authorization", "Bearer test_token_err")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close()

	// Send chat message
	chatMsg := WSMessage{
		Type:           "chat.message",
		ConversationID: "conv-err-test",
		Content:        "trigger failure",
	}
	if err := conn.WriteJSON(chatMsg); err != nil {
		t.Fatalf("failed to write chat message: %v", err)
	}

	// Read first frame: should be status.thinking
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg1 WSMessage
	if err := conn.ReadJSON(&msg1); err != nil {
		t.Fatalf("failed to read first frame: %v", err)
	}
	if msg1.Type != "status.thinking" {
		t.Errorf("expected status.thinking, got %s", msg1.Type)
	}

	// Read next frame: what arrives when brain fails?
	conn.SetReadDeadline(time.Now().Add(1 * time.Second))
	var msg2 WSMessage
	err2 := conn.ReadJSON(&msg2)
	if err2 != nil {
		t.Logf("Empirical Observation: No second frame received after brain error! Error: %v", err2)
	} else {
		t.Logf("Empirical Observation: Received frame type: %s, content: %s", msg2.Type, msg2.Content)
	}

	if err2 != nil || msg2.Type != "error" {
		t.Errorf("BUG CONFIRMED: Gateway does not emit an error frame when upstream brain streaming fails! Received err=%v, frame=%+v", err2, msg2)
	}
}

// TestServeWS_BrainMidStreamError_ErrorFrame verifies whether the gateway emits an error frame when the brain emits an error event mid-stream.
func TestServeWS_BrainMidStreamError_ErrorFrame(t *testing.T) {
	// Setup brain server that emits a token and then an error event
	errorBrainServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/chat/stream" {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, ok := w.(http.Flusher)
			if !ok {
				t.Fatal("expected flusher")
			}
			w.Write([]byte("data: {\"token\": \"partial start\"}\n\n"))
			flusher.Flush()
			w.Write([]byte("data: {\"error\": \"LLM provider quota exceeded\"}\n\n"))
			flusher.Flush()
			return
		}
		http.NotFound(w, r)
	}))
	defer errorBrainServer.Close()

	oldBaseURL := brain.BaseURL
	brain.BaseURL = errorBrainServer.URL
	defer func() { brain.BaseURL = oldBaseURL }()

	os.Setenv("API_TOKEN", "test_token_err")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	header := http.Header{}
	header.Set("Authorization", "Bearer test_token_err")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close()

	chatMsg := WSMessage{
		Type:           "chat.message",
		ConversationID: "conv-midstream-err",
		Content:        "trigger midstream failure",
	}
	if err := conn.WriteJSON(chatMsg); err != nil {
		t.Fatalf("failed to write chat message: %v", err)
	}

	// 1. status.thinking
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg1 WSMessage
	if err := conn.ReadJSON(&msg1); err != nil {
		t.Fatalf("failed to read thinking frame: %v", err)
	}

	// 2. chat.stream ("partial start")
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg2 WSMessage
	if err := conn.ReadJSON(&msg2); err != nil {
		t.Fatalf("failed to read first stream token: %v", err)
	}
	if msg2.Type != "chat.stream" || msg2.Content != "partial start" {
		t.Errorf("expected chat.stream 'partial start', got %+v", msg2)
	}

	// 3. Next frame should be error frame explaining failure
	conn.SetReadDeadline(time.Now().Add(1 * time.Second))
	var msg3 WSMessage
	err3 := conn.ReadJSON(&msg3)
	if err3 != nil {
		t.Logf("Empirical Observation: No error frame received after brain midstream error! Error: %v", err3)
	} else {
		t.Logf("Empirical Observation: Received frame: %+v", msg3)
	}

	if err3 != nil || msg3.Type != "error" {
		t.Errorf("BUG CONFIRMED: Gateway does not emit an error frame on midstream brain failure! Received err=%v, frame=%+v", err3, msg3)
	}
}
