package desktop

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
)

// Authorized allows the bearer token or the same token on the query string,
// which noVNC's websocket needs.
func Authorized(r *http.Request) bool {
	expected := os.Getenv("API_TOKEN")
	if expected == "" {
		return false
	}
	header := r.Header.Get("Authorization")
	if strings.HasPrefix(header, "Bearer ") && strings.TrimPrefix(header, "Bearer ") == expected {
		return true
	}
	return r.URL.Query().Get("token") == expected
}

// Handler proxies the local noVNC desktop. The public path is
// /api/secure/desktop/ and the upstream is PIP_NOVNC_URL (default
// http://127.0.0.1:6080). Callers must already be authenticated.
func Handler(upstream string) http.Handler {
	if upstream == "" {
		upstream = os.Getenv("PIP_NOVNC_URL")
	}
	if upstream == "" {
		upstream = "http://127.0.0.1:6080"
	}
	target, err := url.Parse(upstream)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "desktop upstream is not configured", http.StatusBadGateway)
		})
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1
	director := proxy.Director
	proxy.Director = func(req *http.Request) {
		director(req)
		req.Host = target.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "desktop is not running", http.StatusBadGateway)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		trimmed := strings.TrimPrefix(r.URL.Path, "/secure/desktop")
		if trimmed == "" {
			trimmed = "/"
		}
		r.URL.Path = trimmed
		r.URL.RawPath = ""
		proxy.ServeHTTP(w, r)
	})
}
