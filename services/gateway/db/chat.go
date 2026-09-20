package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type Conversation struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	Metadata       string    `json:"metadata"` // JSON string representation
	CreatedAt      time.Time `json:"created_at"`
}

// CreateConversation initializes a new thread in the database
func CreateConversation(ctx context.Context, title string) (string, error) {
	var id string
	err := Pool.QueryRow(ctx, "INSERT INTO conversations (title) VALUES ($1) RETURNING id", title).Scan(&id)
	return id, err
}

// InsertMessage stores a message and bumps the conversation's updated_at timestamp
func InsertMessage(ctx context.Context, convID, role, content string) (string, error) {
	var id string
	err := Pool.QueryRow(ctx, "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id", convID, role, content).Scan(&id)
	if err == nil {
		// Asynchronously bump the updated_at timestamp to keep conversation sorting fresh
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			Pool.Exec(bgCtx, "UPDATE conversations SET updated_at = NOW() WHERE id = $1", convID)
		}()
	}
	return id, err
}

// GetMessages retrieves the full timeline of a conversation
func GetMessages(ctx context.Context, convID string) ([]Message, error) {
	rows, err := Pool.Query(ctx, 
		"SELECT id, conversation_id, role, content, metadata::text, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC", 
		convID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Message, error) {
		var m Message
		err := row.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.Metadata, &m.CreatedAt)
		return m, err
	})
}
