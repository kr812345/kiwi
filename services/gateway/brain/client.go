package brain

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	// BaseURL points to the internal Python Synapse OS server
	BaseURL string
	// HTTPClient is the dedicated client for brain communication
	HTTPClient *http.Client
)

func init() {
	Init()
}

// Init sets up the brain client configuration
func Init() {
	BaseURL = os.Getenv("BRAIN_URL")
	if BaseURL == "" {
		BaseURL = "http://127.0.0.1:9100"
	}
	HTTPClient = &http.Client{
		Timeout: 120 * time.Second,
	}
}

// ChatRequest represents the internal chat payload sent to Synapse OS
type ChatRequest struct {
	Message        string `json:"message"`
	ConversationID string `json:"conversation_id,omitempty"`
	SessionID      string `json:"session_id,omitempty"`
}

// ChatResponse represents the response payload returned by Synapse OS
type ChatResponse struct {
	Response       string         `json:"response"`
	ConversationID string         `json:"conversation_id"`
	ModelUsed      string         `json:"model_used"`
	Tokens         map[string]int `json:"tokens"`
	CostUSD        float64        `json:"cost_usd"`
	Persona        map[string]any `json:"persona"`
}

// Chat sends a synchronous chat request to the Python brain internal endpoint
func Chat(req ChatRequest) (*ChatResponse, error) {
	return ChatWithContext(context.Background(), req)
}

// ChatWithContext sends a synchronous chat request to the Python brain with context
func ChatWithContext(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal brain request: %w", err)
	}

	targetURL := BaseURL + "/internal/chat"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("brain unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("brain returned status %d", resp.StatusCode)
	}

	var result ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode brain response: %w", err)
	}

	return &result, nil
}

// ChatStream connects to /internal/chat/stream, reads SSE lines, and invokes callback for each token
func ChatStream(ctx context.Context, req ChatRequest, chunkCallback func(token string) error) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal brain request: %w", err)
	}

	targetURL := BaseURL + "/internal/chat/stream"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := HTTPClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("brain unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("brain returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var doneReceived bool
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataStr := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			var payload struct {
				Token string `json:"token"`
				Done  bool   `json:"done"`
				Error string `json:"error"`
			}
			if err := json.Unmarshal([]byte(dataStr), &payload); err != nil {
				continue
			}
			if payload.Error != "" {
				return fmt.Errorf("brain stream error: %s", payload.Error)
			}
			if payload.Done {
				doneReceived = true
				return nil
			}
			if payload.Token != "" {
				if err := chunkCallback(payload.Token); err != nil {
					return err
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading stream: %w", err)
	}

	if !doneReceived {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return errors.New("stream closed prematurely before completion")
	}

	return nil
}

// Health checks if the Python brain is online
func Health() bool {
	return HealthWithContext(context.Background())
}

// HealthWithContext checks if the Python brain is online with context
func HealthWithContext(ctx context.Context) bool {
	targetURL := BaseURL + "/health"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return false
	}

	checkClient := &http.Client{Timeout: 3 * time.Second}
	resp, err := checkClient.Do(httpReq)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}
