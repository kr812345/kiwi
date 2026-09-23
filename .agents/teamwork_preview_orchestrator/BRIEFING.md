# BRIEFING — 2026-09-20T21:40:40Z

## Mission
Build the Kiwi AI System by merging Kiwi Go Gateway with Synapse OS Python Brain (R1 Bridge, R2 Streaming/WS, R3 Mobile App MVP).

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /root/kiwi/.agents/teamwork_preview_orchestrator
- Original parent: sentinel
- Original parent conversation ID: e0dfa253-3df8-484f-b084-f72a133d5d71

## 🔒 My Workflow
- **Pattern**: Project Pattern
- **Scope document**: /root/kiwi/PROJECT.md
1. **Decompose**: Decompose Kiwi AI system into milestones based on module boundaries and sprints (Survey -> M1 Bridge -> M2 Streaming/WS -> M3 Mobile App MVP -> M_E2E Testing / Verification).
2. **Dispatch & Execute** (pick ONE):
   - **Direct (iteration loop)**: For each milestone, run Explorer -> Worker -> Reviewer -> Challenger -> Auditor loop.
   - **Delegate (sub-orchestrator)**: When an item is too large, spawn a sub-orchestrator for it.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, cancel timers, spawn successor.
- **Work items**:
  1. Survey & Project Spec Setup [done]
  2. R1. Go ↔ Python Bridge (Sprint 1) [done]
  3. R2. Streaming & WebSockets (Sprint 2) [done]
  4. R3. Mobile App MVP (Sprint 3) [in-progress]
  5. E2E Testing & Acceptance Verification [pending]
- **Current phase**: 3 (Milestone 3)
- **Current focus**: Milestone 3 — Mobile App MVP / PWA (Worker active)

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Focus on token efficiency and use smaller models (flash) where appropriate.
- Audit is a binary veto. If Forensic Auditor reports INTEGRITY VIOLATION, milestone fails unconditionally.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: e0dfa253-3df8-484f-b084-f72a133d5d71
- Updated: not yet

## Key Decisions Made
- Milestone 1 Gate PASSED.
- Milestone 2 Gate PASSED (Iteration 2 error resilience verified).
- Dispatched Milestone 3 Worker (conv ID `634ce31d-a3e7-467b-b2b1-6634f6337714`) to build the PWA in `apps/mobile/`.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| worker_m3 | teamwork_preview_worker | Milestone 3 (Mobile App MVP / PWA) | in-progress | 634ce31d-a3e7-467b-b2b1-6634f6337714 |

## Succession Status
- Succession required: no
- Active timer: task-187
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 61906bc7-6cc0-4500-84df-f0a2171b46ad/task-187
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run manage_task(Action="list") — re-create if missing

## Artifact Index
- /root/kiwi/.agents/ORIGINAL_REQUEST.md — Original user request
- /root/kiwi/PLAN.md — Master implementation plan
- /root/kiwi/PROJECT.md — Master project architecture and feature inventory
- /root/kiwi/.agents/teamwork_preview_orchestrator/BRIEFING.md — Persistent working memory
- /root/kiwi/.agents/teamwork_preview_orchestrator/progress.md — Liveness & iteration checkpoint
- /root/kiwi/.agents/teamwork_preview_orchestrator/plan.md — Orchestrator action plan
- /root/kiwi/.agents/teamwork_preview_orchestrator/GATE_STATUS.md — Gate verdicts
