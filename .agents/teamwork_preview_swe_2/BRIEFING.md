# BRIEFING — 2026-09-01T01:51:30+01:00

## Mission
Update CLAUDE.md and NEXUS.md to reconcile their baselines with the shipped V6.2.60 reality and strictly apply the v3.1.0 Core Execution Directive's 16GB hardware assumptions (INV-09, CPU floor, etc.).

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2
- Original parent: parent
- Original parent conversation ID: 169f089a-2444-4a44-aa60-c9074d58b2b8

## 🔒 My Workflow
- **Pattern**: SWE Light
- **Scope document**: /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2/ORIGINAL_REQUEST.md
1. **Decompose**: No decomposition (SWE Light - sequential refinement of whole task).
2. **Dispatch & Execute**:
   - Dispatch teamwork_preview_implementer
   - Sequential refinement via teamwork_preview_reviewer (minimum 3 rounds)
   - Final audit via teamwork_preview_victory_auditor
3. **On failure**:
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent
4. **Succession**: At >= 16 spawns, write soft handoff, spawn successor.
- **Work items**:
  1. Implement baseline reconciliation & 16GB assumptions in CLAUDE.md and NEXUS.md [done]
  2. Review round 1 [in-progress]
  3. Review round 2 [pending]
  4. Review round 3 [pending]
  5. Post-victory audit [pending]
- **Current phase**: 2
- **Current focus**: Reviewer Round 1 running

## 🔒 Key Constraints
- NEVER write, modify, or create source code files yourself. Delegate all implementation and all repair to teamwork_preview_implementer and teamwork_preview_reviewer.
- NEVER explore or debug the codebase in order to solve the task yourself.
- Verify worker claims independently by checking git diff and running test/check commands.
- Pass task verbatim to subagents.
- Carry open-issues ledger across all rounds.
- Floor of 3 review rounds + victory auditor before completion.

## Current Parent
- Conversation ID: 169f089a-2444-4a44-aa60-c9074d58b2b8
- Updated: not yet

## Key Decisions Made
- SWE Light pattern selected with sequential implementer -> reviewer -> reviewer -> reviewer -> victory auditor.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|---|---|---|---|---|
| Implementer_1 | teamwork_preview_implementer | Reconcile CLAUDE.md and NEXUS.md | done | 616d2d14-14d1-4436-b61d-dbb2cec9d697 |
| Reviewer_r1 | teamwork_preview_reviewer | Reviewer Round 1 | in-progress | 493f28ea-baaf-4d5b-baa4-2314a739ec10 |

## Succession Status
- Succession required: no
- Spawn count: 2 / 16
- Pending subagents: 493f28ea-baaf-4d5b-baa4-2314a739ec10
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 9f26353c-765f-4f04-b36c-2a6323b7429e/task-11
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run manage_task(Action="list") — re-create if missing

## Artifact Index
- /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2/ORIGINAL_REQUEST.md — Verbatim user request
- /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2/DISPATCH.md — Incoming dispatch record
- /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2/BRIEFING.md — Working memory and identity
- /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2/progress.md — Liveness heartbeat and iteration tracker
