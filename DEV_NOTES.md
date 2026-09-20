# Developer Notes & Engineering Decisions

Living document capturing key architectural decisions, feature implementations, and engineering context in short, concise bullet points for future developers.

---

### Project Inception & Setup
- **Repository Initialized**: Git repo initialized with `main` as the default branch.
- **Agent Guidelines Established**: Added [AGENT.md](file:///root/kiwi/AGENT.md) enforcing clean, human-friendly code, zero bloat/bluff, and continuous documentation updates.
- **Developer Documentation Created**: Established [DEV_NOTES.md](file:///root/kiwi/DEV_NOTES.md) as the central log for architectural decisions and feature notes.
- **Architecture Roadmap Integrated**: Parsed full roadmap specification ([ROADMAP.md](file:///root/kiwi/ROADMAP.md)) defining the modular monolith structure, Go gateway/backend, PostgreSQL + pgvector memory, controlled tool registry, and device agents.
- **Documentation Enhanced**: Updated [README.md](file:///root/kiwi/README.md) with complete system architecture diagrams, layer breakdowns, phased milestones, and design principles. Standardized full roadmap to [ROADMAP.md](file:///root/kiwi/ROADMAP.md).
- **Networking Reference Added**: Created [networking_commands.md](file:///root/kiwi/networking_commands.md) capturing essential UFW firewall, listening socket inspection (`ss`), port reachability (`nc`/`curl`), and network interface diagnostics for VPS management.
- **Infrastructure Pivot**: Skipped Docker (to save CPU/space). Selected PM2 for process management, Supabase for managed PostgreSQL/pgvector, and Caddy for reverse proxy.
- **Go API Gateway Initialized**: Scaffolded Go module and created initial gateway service with a `/health` endpoint in `services/gateway`.
- **Database & Auth Layer Added**: Integrated `pgx/v5` for Supabase connection pooling and implemented a static Bearer token `AuthMiddleware` for securing endpoints like `/api/secure/ping`.
- **CI/CD Configured**: Added `.github/workflows/deploy.yml` for automated push-to-deploy using SSH and `pm2 reload`.
- **Orchestrator Iteration 1 (Memory System)**: Defined `conversations` and `messages` SQL schema for Supabase. Built the Go Data Access Layer (`db/chat.go`) and a `/api/secure/chat` endpoint to test reading/writing messages via a "Dumb Echo" response.
