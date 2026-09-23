package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"kiwi/services/gateway/brain"
	"kiwi/services/gateway/db"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512 * 1024

	// Time allowed for an unauthenticated client to send an auth frame.
	authTimeout = 5 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for API Gateway
	},
}

// WSMessage represents the standard JSON message envelope exchanged over WebSockets.
type WSMessage struct {
	Type           string `json:"type"`
	ConversationID string `json:"conversation_id,omitempty"`
	Content        string `json:"content,omitempty"`
	Token          string `json:"token,omitempty"`
	Metadata       any    `json:"metadata,omitempty"`
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub initializes a new WebSocket Hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the Hub event loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.close()
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				client.mu.Lock()
				isAuth := client.authenticated
				client.mu.Unlock()
				if isAuth {
					client.sendBytes(message)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Client represents an active WebSocket connection.
type Client struct {
	hub           *Hub
	conn          *websocket.Conn
	send          chan []byte
	authenticated bool
	authTimer     *time.Timer
	activeCancel  context.CancelFunc
	closed        bool
	mu            sync.Mutex
}

func (c *Client) sendBytes(msg []byte) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return false
	}
	select {
	case c.send <- msg:
		return true
	default:
		return false
	}
}

func (c *Client) sendMessage(msg WSMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	if !c.sendBytes(data) {
		return fmt.Errorf("client send buffer full or closed")
	}
	return nil
}

func (c *Client) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		if c.authTimer != nil {
			c.authTimer.Stop()
		}
		close(c.send)
	}
}

func (c *Client) cancelStream() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cancelStreamLocked()
}

func (c *Client) cancelStreamLocked() {
	if c.activeCancel != nil {
		c.activeCancel()
		c.activeCancel = nil
	}
}

// readPump pumps messages from the websocket connection to the hub and handlers.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.cancelStream()
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket unexpected close: %v", err)
			}
			break
		}

		var wsMsg WSMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("Invalid WebSocket JSON frame: %v", err)
			continue
		}

		expectedToken := os.Getenv("API_TOKEN")

		c.mu.Lock()
		isAuth := c.authenticated
		c.mu.Unlock()

		if !isAuth {
			// Require initial auth frame within deadline
			if wsMsg.Type == "auth" {
				token := wsMsg.Content
				if token == "" {
					token = wsMsg.Token
				}
				if expectedToken != "" && token == expectedToken {
					c.mu.Lock()
					c.authenticated = true
					if c.authTimer != nil {
						c.authTimer.Stop()
					}
					c.mu.Unlock()
					log.Println("WebSocket client successfully authenticated via initial frame")
					continue
				} else {
					log.Println("WebSocket authentication failed: invalid token in frame")
					c.conn.WriteControl(
						websocket.CloseMessage,
						websocket.FormatCloseMessage(4401, "Unauthorized - Invalid token"),
						time.Now().Add(time.Second),
					)
					break
				}
			} else {
				log.Println("WebSocket client sent non-auth message while unauthenticated")
				c.conn.WriteControl(
					websocket.CloseMessage,
					websocket.FormatCloseMessage(4401, "Unauthorized - Please authenticate first"),
					time.Now().Add(time.Second),
				)
				break
			}
		}

		// Authenticated message dispatch
		switch wsMsg.Type {
		case "chat.message":
			c.handleChatMessage(wsMsg)
		case "auth":
			// Redundant auth frame when already authenticated
			continue
		default:
			log.Printf("Received message of type: %s", wsMsg.Type)
		}
	}
}

// writePump pumps messages from the send channel to the websocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The Hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleChatMessage handles an incoming user chat message, emits status, streams tokens, and saves turns.
func (c *Client) handleChatMessage(msg WSMessage) {
	userContent := strings.TrimSpace(msg.Content)
	if userContent == "" {
		return
	}

	convID := msg.ConversationID
	if convID == "" {
		if db.Pool != nil {
			var err error
			convID, err = db.CreateConversation(context.Background(), "New Chat")
			if err != nil {
				log.Printf("Warning: error creating conversation in DB: %v", err)
			}
		}
		if convID == "" {
			convID = fmt.Sprintf("conv-%d", time.Now().UnixNano())
		}
	}

	// 1. Emit status.thinking frame
	thinkingMsg := WSMessage{
		Type:           "status.thinking",
		ConversationID: convID,
		Content:        "kiwi is thinking...",
	}
	c.sendMessage(thinkingMsg)

	// 2. Save user message to database if connected
	if db.Pool != nil {
		if _, err := db.InsertMessage(context.Background(), convID, "user", userContent); err != nil {
			log.Printf("Warning: failed to insert user message in DB: %v", err)
		}
	}

	// 3. Create cancellable stream context tied to client lifecycle
	streamCtx, cancel := context.WithCancel(context.Background())
	c.mu.Lock()
	c.cancelStreamLocked()
	c.activeCancel = cancel
	c.mu.Unlock()

	go func() {
		defer cancel()

		brainReq := brain.ChatRequest{
			Message:        userContent,
			ConversationID: convID,
			SessionID:      convID,
		}

		var fullResponse strings.Builder

		err := brain.ChatStream(streamCtx, brainReq, func(token string) error {
			fullResponse.WriteString(token)
			streamMsg := WSMessage{
				Type:           "chat.stream",
				ConversationID: convID,
				Content:        token,
			}
			return c.sendMessage(streamMsg)
		})

		if err != nil {
			if streamCtx.Err() != nil {
				log.Printf("Brain SSE stream aborted due to client disconnect: %v", streamCtx.Err())
				return
			}
			log.Printf("Brain streaming failed: %v", err)
			errorMsg := WSMessage{
				Type:           "error",
				ConversationID: convID,
				Content:        "Brain streaming failed: " + err.Error(),
			}
			c.sendMessage(errorMsg)
			return
		}

		completedContent := fullResponse.String()

		// 4. Send chat.complete frame with full concatenated response
		completeMsg := WSMessage{
			Type:           "chat.complete",
			ConversationID: convID,
			Content:        completedContent,
		}
		c.sendMessage(completeMsg)

		// 5. Save assistant message to database if connected
		if db.Pool != nil && completedContent != "" {
			if _, err := db.InsertMessage(context.Background(), convID, "assistant", completedContent); err != nil {
				log.Printf("Warning: failed to insert assistant message in DB: %v", err)
			}
		}
	}()
}

// ServeWS handles websocket upgrade requests from clients.
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	expectedToken := os.Getenv("API_TOKEN")
	authenticated := false

	// Method 1: Bearer token header
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			if expectedToken != "" && parts[1] == expectedToken {
				authenticated = true
			} else {
				http.Error(w, "Unauthorized - Invalid token", http.StatusUnauthorized)
				return
			}
		} else {
			http.Error(w, "Unauthorized - Invalid token format", http.StatusUnauthorized)
			return
		}
	}

	// Method 2: ?token= query parameter
	queryToken := r.URL.Query().Get("token")
	if !authenticated && queryToken != "" {
		if expectedToken != "" && queryToken == expectedToken {
			authenticated = true
		} else {
			http.Error(w, "Unauthorized - Invalid token", http.StatusUnauthorized)
			return
		}
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:           hub,
		conn:          conn,
		send:          make(chan []byte, 256),
		authenticated: authenticated,
	}

	hub.register <- client

	// Method 3: If not yet authenticated, give client 5 seconds to send auth frame
	if !authenticated {
		client.authTimer = time.AfterFunc(authTimeout, func() {
			client.mu.Lock()
			isAuth := client.authenticated
			client.mu.Unlock()

			if !isAuth {
				log.Println("WebSocket client auth timeout (5s); disconnecting")
				client.conn.WriteControl(
					websocket.CloseMessage,
					websocket.FormatCloseMessage(4401, "Authentication timeout"),
					time.Now().Add(time.Second),
				)
				client.conn.Close()
			}
		})
	}

	go client.writePump()
	go client.readPump()
}
