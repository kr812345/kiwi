package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"kiwi/services/gateway/brain"
)

func TestChatHandler_EmptyMessage_Returns400(t *testing.T) {
	body := []byte(`{"message": ""}`)
	req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(body))
	w := httptest.NewRecorder()

	chatHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Message cannot be empty") {
		t.Errorf("expected body to contain 'Message cannot be empty', got '%s'", w.Body.String())
	}

	// Whitespace only message
	bodyWS := []byte(`{"message": "    "}`)
	reqWS := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(bodyWS))
	wWS := httptest.NewRecorder()

	chatHandler(wWS, reqWS)

	if wWS.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for whitespace, got %d", wWS.Code)
	}
}

func TestChatHandler_FallbackConversationID_Nanosecond(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var bReq brain.ChatRequest
		json.NewDecoder(r.Body).Decode(&bReq)

		json.NewEncoder(w).Encode(brain.ChatResponse{
			Response:       "hello back",
			ConversationID: bReq.ConversationID,
		})
	}))
	defer mockServer.Close()

	oldBaseURL := brain.BaseURL
	brain.BaseURL = mockServer.URL
	defer func() { brain.BaseURL = oldBaseURL }()

	// Send request without conversation_id
	body := []byte(`{"message": "hello"}`)
	req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(body))
	w := httptest.NewRecorder()

	chatHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp ChatResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !strings.HasPrefix(resp.ConversationID, "conv-") {
		t.Errorf("expected conversation_id starting with 'conv-', got '%s'", resp.ConversationID)
	}

	// Verify two consecutive calls get distinct IDs
	time.Sleep(1 * time.Millisecond)
	req2 := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(body))
	w2 := httptest.NewRecorder()
	chatHandler(w2, req2)

	var resp2 ChatResponse
	json.NewDecoder(w2.Body).Decode(&resp2)

	if resp.ConversationID == resp2.ConversationID {
		t.Errorf("expected distinct conversation IDs, both were '%s'", resp.ConversationID)
	}
}

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

	// Test index.html via root "/"
	reqRoot := httptest.NewRequest(http.MethodGet, "/", nil)
	wRoot := httptest.NewRecorder()
	handler.ServeHTTP(wRoot, reqRoot)
	if wRoot.Code != http.StatusOK {
		t.Errorf("expected status 200 for /, got %d", wRoot.Code)
	}
	if !strings.Contains(wRoot.Body.String(), "<title>Kiwi AI Assistant</title>") {
		t.Errorf("expected Kiwi title in root response, got: %s", wRoot.Body.String())
	}

	// Test index.html via direct "/index.html"
	reqIndex := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	wIndex := httptest.NewRecorder()
	handler.ServeHTTP(wIndex, reqIndex)
	if wIndex.Code != http.StatusOK {
		t.Errorf("expected status 200 for /index.html, got %d", wIndex.Code)
	}
	if !strings.Contains(wIndex.Body.String(), "<title>Kiwi AI Assistant</title>") {
		t.Errorf("expected Kiwi title in /index.html response, got: %s", wIndex.Body.String())
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
	if !strings.Contains(w.Header().Get("Access-Control-Allow-Methods"), "OPTIONS") {
		t.Errorf("missing OPTIONS in Access-Control-Allow-Methods")
	}
}

