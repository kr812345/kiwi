package desktop

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestAuthorized(t *testing.T) {
	t.Setenv("API_TOKEN", "desk-token")
	req := httptest.NewRequest(http.MethodGet, "/secure/desktop/vnc.html?token=desk-token", nil)
	if !Authorized(req) {
		t.Fatal("expected query token to authorize the desktop")
	}
	header := httptest.NewRequest(http.MethodGet, "/secure/desktop/", nil)
	header.Header.Set("Authorization", "Bearer desk-token")
	if !Authorized(header) {
		t.Fatal("expected bearer token to authorize the desktop")
	}
	denied := httptest.NewRequest(http.MethodGet, "/secure/desktop/", nil)
	if Authorized(denied) {
		t.Fatal("expected a missing token to be refused")
	}
	os.Unsetenv("API_TOKEN")
	if Authorized(req) {
		t.Fatal("expected a closed desktop when the gateway token is unset")
	}
}

func TestHandlerStripsPrefix(t *testing.T) {
	var seen string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	handler := Handler(upstream.URL)
	req := httptest.NewRequest(http.MethodGet, "/secure/desktop/vnc.html", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if seen != "/vnc.html" {
		t.Fatalf("expected upstream path /vnc.html, got %s", seen)
	}
}
