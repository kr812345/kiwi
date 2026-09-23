# Original User Request

## 2026-09-20T21:02:41Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Build the Kiwi AI System by merging the Kiwi Go API Gateway with the Synapse OS Python Brain, according to the master implementation plan in `/root/kiwi/PLAN.md`. Focus on token efficiency and use smaller models (flash) where appropriate.

Working directory: `/root/kiwi`
Integrity mode: development

## Requirements

### R1. Go ↔ Python Bridge (Sprint 1)
Implement an internal `/internal/chat` endpoint in the Python brain (Synapse OS) that takes a message, routes it through the OS, and returns the response. Create a corresponding HTTP client in the Go Gateway (`services/gateway/brain/client.go`) to forward requests to this endpoint instead of the "Dumb Echo". Consolidate database connections to use Supabase (update `MemoryEngine` and apply schema migrations). 

### R2. Streaming & WebSockets (Sprint 2)
Implement a WebSocket hub in the Go Gateway (`ws/hub.go`) to handle real-time client connections. Update the Python brain to support SSE streaming for LLM generation. Bridge the Go SSE consumer to relay tokens over the WebSocket to the client.

### R3. Mobile App MVP (Sprint 3)
Build a Progressive Web App (PWA) using Next.js or plain HTML/JS/CSS that connects to the Go Gateway's WebSocket endpoint. It must support token authentication, display chat messages with streaming animations, and have a Kiwi-branded UI.

## Acceptance Criteria

### Bridge Verification
- [ ] `curl -X POST http://127.0.0.1:8080/api/secure/chat` successfully returns an AI-generated response from the Python brain.
- [ ] PM2 successfully starts both the Go Gateway and the Python FastAPI server.

### Streaming Verification
- [ ] A WebSocket client can connect to the Go Gateway and receive token-by-token streaming messages from the Python brain.

### Frontend Verification
- [ ] The PWA successfully connects to the backend, authenticates, and displays a streaming chat interface.
