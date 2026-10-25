package approvals

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Broadcaster sends one JSON frame to authenticated clients.
type Broadcaster interface {
	Broadcast(message []byte)
}

type pendingApproval struct {
	ID     string `json:"id"`
	Action string `json:"action"`
	Secret string `json:"secret"`
	Detail string `json:"detail"`
	Status string `json:"status"`
}

type approvalList struct {
	Approvals []pendingApproval `json:"approvals"`
}

type note struct {
	Job     string `json:"job"`
	Message string `json:"message"`
	State   string `json:"state"`
}

type noteList struct {
	Notifications []note `json:"notifications"`
}

// Start polls the brain for approvals and job notifications and pushes them
// onto the phone socket. It stops when stop is closed.
func Start(hub Broadcaster, brainURL string, stop <-chan struct{}) {
	if brainURL == "" {
		brainURL = "http://127.0.0.1:9100"
	}
	go loop(hub, strings.TrimRight(brainURL, "/"), stop)
}

func loop(hub Broadcaster, brainURL string, stop <-chan struct{}) {
	seen := map[string]bool{}
	client := &http.Client{Timeout: 5 * time.Second}
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			pollApprovals(client, hub, brainURL, seen)
			pollNotes(client, hub, brainURL)
		}
	}
}

func pollApprovals(client *http.Client, hub Broadcaster, brainURL string, seen map[string]bool) {
	var list approvalList
	if err := getJSON(client, brainURL+"/internal/approvals", &list); err != nil {
		return
	}
	for _, item := range list.Approvals {
		if item.ID == "" || seen[item.ID] {
			continue
		}
		seen[item.ID] = true
		frame := map[string]any{
			"type":    "approval.required",
			"content": item.Detail,
			"metadata": map[string]any{
				"id":     item.ID,
				"action": item.Action,
				"secret": item.Secret,
				"detail": item.Detail,
				"state":  "approval",
			},
		}
		send(hub, frame)
		send(hub, map[string]any{"type": "status.state", "content": "approval"})
	}
}

func pollNotes(client *http.Client, hub Broadcaster, brainURL string) {
	var list noteList
	if err := getJSON(client, brainURL+"/internal/notifications", &list); err != nil {
		return
	}
	for _, item := range list.Notifications {
		state := item.State
		if state == "" {
			state = "nudge"
		}
		send(hub, map[string]any{
			"type":    "status." + state,
			"content": item.Message,
			"metadata": map[string]any{
				"job":   item.Job,
				"state": state,
			},
		})
		send(hub, map[string]any{"type": "status.state", "content": state})
	}
}

// Decide posts an allow or refuse to the brain.
func Decide(brainURL, id string, allow bool) error {
	if brainURL == "" {
		brainURL = "http://127.0.0.1:9100"
	}
	body, err := json.Marshal(map[string]bool{"allow": allow})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(brainURL, "/")+"/internal/approvals/"+id, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("approval post returned %d", resp.StatusCode)
	}
	return nil
}

func getJSON(client *http.Client, url string, dest any) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dest)
}

func send(hub Broadcaster, frame map[string]any) {
	raw, err := json.Marshal(frame)
	if err != nil {
		return
	}
	hub.Broadcast(raw)
}
