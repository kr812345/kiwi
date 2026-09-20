package auth

import (
	"net/http"
	"os"
	"strings"
)

// AuthMiddleware protects routes by requiring a valid Bearer token matching API_TOKEN
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expectedToken := os.Getenv("API_TOKEN")
		
		// If no token is set in the environment, we reject all requests to secure endpoints
		if expectedToken == "" {
			http.Error(w, "Server auth is not configured", http.StatusInternalServerError)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized - Missing token", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Unauthorized - Invalid token format", http.StatusUnauthorized)
			return
		}

		if parts[1] != expectedToken {
			http.Error(w, "Unauthorized - Invalid token", http.StatusUnauthorized)
			return
		}

		// Token is valid, proceed to the handler
		next.ServeHTTP(w, r)
	})
}
