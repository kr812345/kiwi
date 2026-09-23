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

func setupTestBrainServer(t *testing.T) (*httptest.Server, func()) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/chat/stream" {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, ok := w.(http.Flusher)
			if !ok {
				t.Fatal("expected flusher")
			}
			w.Write([]byte("data: {\"token\": \"yo! \"}\n\n"))
			flusher.Flush()
			w.Write([]byte("data: {\"token\": \"kiwi \"}\n\n"))
			flusher.Flush()
			w.Write([]byte("data: {\"token\": \"here\"}\n\n"))
			flusher.Flush()
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

func TestServeWS_BearerAuth_Success(t *testing.T) {
	_, brainCleanup := setupTestBrainServer(t)
	defer brainCleanup()

	os.Setenv("API_TOKEN", "test_secret_token")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	header := http.Header{}
	header.Set("Authorization", "Bearer test_secret_token")

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("expected 101 Switching Protocols, got %d", resp.StatusCode)
	}

	// Send chat message
	chatMsg := WSMessage{
		Type:           "chat.message",
		ConversationID: "conv-test-1",
		Content:        "hello kiwi",
	}
	if err := conn.WriteJSON(chatMsg); err != nil {
		t.Fatalf("failed to write chat message: %v", err)
	}

	// Expect status.thinking
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var thinkingMsg WSMessage
	if err := conn.ReadJSON(&thinkingMsg); err != nil {
		t.Fatalf("failed to read thinking frame: %v", err)
	}
	if thinkingMsg.Type != "status.thinking" {
		t.Errorf("expected status.thinking, got %s", thinkingMsg.Type)
	}

	// Expect stream tokens
	var tokens []string
	var completeMsg WSMessage

	for {
		var msg WSMessage
		conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		if err := conn.ReadJSON(&msg); err != nil {
			t.Fatalf("error reading stream message: %v", err)
		}
		if msg.Type == "chat.stream" {
			tokens = append(tokens, msg.Content)
		} else if msg.Type == "chat.complete" {
			completeMsg = msg
			break
		}
	}

	if len(tokens) == 0 {
		t.Fatal("expected at least one chat.stream token")
	}

	concatenated := strings.Join(tokens, "")
	if concatenated != "yo! kiwi here" {
		t.Errorf("expected 'yo! kiwi here', got '%s'", concatenated)
	}
	if completeMsg.Content != "yo! kiwi here" {
		t.Errorf("expected completeMsg 'yo! kiwi here', got '%s'", completeMsg.Content)
	}
}

func TestServeWS_QueryParamAuth_Success(t *testing.T) {
	_, brainCleanup := setupTestBrainServer(t)
	defer brainCleanup()

	os.Setenv("API_TOKEN", "query_token_123")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?token=query_token_123"

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket with query param: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("expected 101 Switching Protocols, got %d", resp.StatusCode)
	}
}

func TestServeWS_InitialAuthFrame_Success(t *testing.T) {
	_, brainCleanup := setupTestBrainServer(t)
	defer brainCleanup()

	os.Setenv("API_TOKEN", "frame_auth_token")
	defer os.Unsetenv("API_TOKEN")

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

	// Send initial auth frame
	authMsg := WSMessage{
		Type:    "auth",
		Content: "frame_auth_token",
	}
	if err := conn.WriteJSON(authMsg); err != nil {
		t.Fatalf("failed to send auth frame: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	// Send chat message
	chatMsg := WSMessage{
		Type:    "chat.message",
		Content: "test message",
	}
	if err := conn.WriteJSON(chatMsg); err != nil {
		t.Fatalf("failed to send chat message: %v", err)
	}

	var thinking WSMessage
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	if err := conn.ReadJSON(&thinking); err != nil {
		t.Fatalf("expected thinking frame after frame auth: %v", err)
	}
	if thinking.Type != "status.thinking" {
		t.Errorf("expected status.thinking, got %s", thinking.Type)
	}
}

func TestServeWS_InvalidToken_Rejected(t *testing.T) {
	os.Setenv("API_TOKEN", "correct_token")
	defer os.Unsetenv("API_TOKEN")

	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	header := http.Header{}
	header.Set("Authorization", "Bearer wrong_token")

	_, resp, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err == nil {
		t.Fatal("expected error dialing with invalid token, got nil")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", resp.StatusCode)
	}
}
