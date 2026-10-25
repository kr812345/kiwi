//go:build integration

package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kiwi/services/gateway/brain"
)

func TestIntegrationSecureChatAndDesktop(t *testing.T) {
	t.Setenv("API_TOKEN", "integration-token")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("PIP_NOVNC_URL", "http://127.0.0.1:9")

	brainServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/chat" {
			http.NotFound(w, r)
			return
		}
		var req brain.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode brain request: %v", err)
		}
		if req.Message != "hi" {
			t.Errorf("brain saw %q", req.Message)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(brain.ChatResponse{
			Response:       "Hi, I'm Pip. Tell me what's on your plate and I'll help keep it in order.",
			ConversationID: req.ConversationID,
		})
	}))
	defer brainServer.Close()

	previous := brain.BaseURL
	brain.BaseURL = brainServer.URL
	defer func() { brain.BaseURL = previous }()

	gateway := httptest.NewServer(newHandler(nil))
	defer gateway.Close()

	health, err := http.Get(gateway.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer health.Body.Close()
	if health.StatusCode != http.StatusOK {
		t.Fatalf("health status %d", health.StatusCode)
	}

	openChat, err := http.Post(gateway.URL+"/api/secure/chat", "application/json", strings.NewReader(`{"message":"hi"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer openChat.Body.Close()
	if openChat.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected chat without a token to be 401, got %d", openChat.StatusCode)
	}

	chatReq, err := http.NewRequest(http.MethodPost, gateway.URL+"/api/secure/chat", strings.NewReader(`{"message":"hi"}`))
	if err != nil {
		t.Fatal(err)
	}
	chatReq.Header.Set("Authorization", "Bearer integration-token")
	chatReq.Header.Set("Content-Type", "application/json")
	chatResp, err := http.DefaultClient.Do(chatReq)
	if err != nil {
		t.Fatal(err)
	}
	defer chatResp.Body.Close()
	body, _ := io.ReadAll(chatResp.Body)
	if chatResp.StatusCode != http.StatusOK {
		t.Fatalf("chat status %d body %s", chatResp.StatusCode, body)
	}
	if !strings.Contains(string(body), "Hi, I'm Pip") {
		t.Fatalf("chat body %s", body)
	}

	desktop, err := http.Get(gateway.URL + "/api/secure/desktop/vnc.html")
	if err != nil {
		t.Fatal(err)
	}
	defer desktop.Body.Close()
	if desktop.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected a closed desktop, got %d", desktop.StatusCode)
	}

	authedDesktop, err := http.Get(gateway.URL + "/api/secure/desktop/vnc.html?token=integration-token")
	if err != nil {
		t.Fatal(err)
	}
	defer authedDesktop.Body.Close()
	desktopBody, _ := io.ReadAll(authedDesktop.Body)
	if authedDesktop.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected the desktop proxy to report it is down, got %d %s", authedDesktop.StatusCode, desktopBody)
	}
	if !strings.Contains(string(desktopBody), "desktop is not running") {
		t.Fatalf("desktop body %s", desktopBody)
	}
}
