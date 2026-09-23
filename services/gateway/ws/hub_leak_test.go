package ws

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"kiwi/services/gateway/brain"
)

func setupSlowTestBrainServer(t *testing.T, tokenCount int, delay time.Duration) (*httptest.Server, func()) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/chat/stream" {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, ok := w.(http.Flusher)
			if !ok {
				t.Fatal("expected flusher")
			}
			for i := 1; i <= tokenCount; i++ {
				w.Write([]byte(fmt.Sprintf("data: {\"token\": \"tok%d \"}\n\n", i)))
				flusher.Flush()
				time.Sleep(delay)
			}
			w.Write([]byte("data: {\"done\": true}\n\n"))
			flusher.Flush()
			return
		}
		http.NotFound(w, r)
	}))

	oldBaseURL := brain.BaseURL
	brain.BaseURL = server.URL

	cleanup := func() {
		server.Close()
		brain.BaseURL = oldBaseURL
	}

	return server, cleanup
}

func TestServeWS_MidStreamDisconnect_NoGoroutineLeak(t *testing.T) {
	_, brainCleanup := setupSlowTestBrainServer(t, 25, 20*time.Millisecond)
	defer brainCleanup()

	os.Setenv("API_TOKEN", "leak_test_token")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Allow initial system/hub goroutines to settle
	time.Sleep(100 * time.Millisecond)
	initialGoroutines := runtime.NumGoroutine()

	cutoffs := []int{1, 5, 10}
	for _, cutoff := range cutoffs {
		for cycle := 0; cycle < 5; cycle++ {
			header := http.Header{}
			header.Set("Authorization", "Bearer leak_test_token")

			conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
			if err != nil {
				t.Fatalf("failed to dial websocket: %v", err)
			}

			chatMsg := WSMessage{
				Type:    "chat.message",
				Content: fmt.Sprintf("test cutoff %d cycle %d", cutoff, cycle),
			}
			if err := conn.WriteJSON(chatMsg); err != nil {
				t.Fatalf("failed to write chat message: %v", err)
			}

			receivedTokens := 0
			for {
				var msg WSMessage
				conn.SetReadDeadline(time.Now().Add(2 * time.Second))
				if err := conn.ReadJSON(&msg); err != nil {
					break
				}
				if msg.Type == "chat.stream" {
					receivedTokens++
					if receivedTokens == cutoff {
						// Disconnect immediately mid-stream
						conn.Close()
						break
					}
				}
			}
		}
	}

	// Settle time for all contexts, HTTP requests, and read/write pumps to cleanly exit
	time.Sleep(500 * time.Millisecond)
	finalGoroutines := runtime.NumGoroutine()

	delta := finalGoroutines - initialGoroutines
	t.Logf("Goroutine count: initial=%d, final=%d, delta=%d", initialGoroutines, finalGoroutines, delta)

	// In Go, allowing delta <= 2 for runtime background tasks; anything larger suggests a leak
	if delta > 3 {
		t.Errorf("Potential goroutine leak detected: initial=%d, final=%d (delta=%d)", initialGoroutines, finalGoroutines, delta)
	}
}

func TestServeWS_UnauthenticatedTimeout_CloseCode4401(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close()

	// Wait for the 5-second timeout close frame
	conn.SetReadDeadline(time.Now().Add(6 * time.Second))
	_, _, err = conn.ReadMessage()
	if err == nil {
		t.Fatal("expected connection to close on auth timeout, got nil error")
	}

	closeErr, ok := err.(*websocket.CloseError)
	if !ok {
		t.Fatalf("expected websocket.CloseError, got %T: %v", err, err)
	}

	if closeErr.Code != 4401 {
		t.Errorf("expected close code 4401, got %d", closeErr.Code)
	}
	if !strings.Contains(strings.ToLower(closeErr.Text), "timeout") {
		t.Errorf("expected close reason to contain 'timeout', got '%s'", closeErr.Text)
	}
}

func TestServeWS_BrainPrematureEOF_FalseComplete(t *testing.T) {
	// Brain sends tokens and then abruptly closes connection without done: true
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/chat/stream" {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)
			w.Write([]byte("data: {\"token\": \"partial unfinished sentence\"}\n\n"))
			flusher.Flush()
			// Server closes without done: true
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	oldBaseURL := brain.BaseURL
	brain.BaseURL = server.URL
	defer func() { brain.BaseURL = oldBaseURL }()

	os.Setenv("API_TOKEN", "eof_test_token")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	gwServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer gwServer.Close()

	wsURL := "ws" + strings.TrimPrefix(gwServer.URL, "http")
	header := http.Header{}
	header.Set("Authorization", "Bearer eof_test_token")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	chatMsg := WSMessage{
		Type:    "chat.message",
		Content: "trigger truncated response",
	}
	if err := conn.WriteJSON(chatMsg); err != nil {
		t.Fatalf("failed to write message: %v", err)
	}

	// 1. status.thinking
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg1 WSMessage
	if err := conn.ReadJSON(&msg1); err != nil {
		t.Fatalf("failed to read frame 1: %v", err)
	}

	// 2. chat.stream
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg2 WSMessage
	if err := conn.ReadJSON(&msg2); err != nil {
		t.Fatalf("failed to read frame 2: %v", err)
	}

	// 3. Next frame: Gateway should NOT send chat.complete if stream terminated prematurely without done: true!
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg3 WSMessage
	err3 := conn.ReadJSON(&msg3)
	if err3 == nil && msg3.Type == "chat.complete" {
		t.Logf("BUG OBSERVED: Gateway emitted chat.complete with truncated content: '%s' despite missing 'done: true'!", msg3.Content)
	}
}
