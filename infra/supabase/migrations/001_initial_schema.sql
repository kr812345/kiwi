-- Migration: 001_initial_schema
-- Description: Create conversations and messages tables for AI orchestrator memory

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE role_type AS ENUM ('user', 'assistant', 'system', 'tool');

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role role_type NOT NULL,
    content TEXT NOT NULL,
    -- JSONB metadata to store tool call arguments, error states, token usage, etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for retrieving a conversation's history sequentially
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
