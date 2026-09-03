# SwarmX APEX-17 r8 Architecture

SwarmX is a production-grade autonomous multi-agent swarm control plane combining
a deterministic async orchestration core, specialist LLM agent roles, persistent
layered memory, proposal-based bounded evolution, and a self-improving overlay.

This document is a high-level architecture map. The authoritative low-RAM runtime
profile, canonical model tags, and startup invariants live in [README.md](README.md),
[scripts/rebuild-all-modelfiles.sh](scripts/rebuild-all-modelfiles.sh), and
[setup/env.swarmx](setup/env.swarmx).

---

## Layer Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Interface Layer — CLI · Next.js Dashboard · Fastify API · MCP Server   │
├─────────────────────────────────────────────────────────────────────────┤
│  Brain Layer — brain/            (lightweight adapter over orchestration)│
│    orchestrator · planner · dispatcher · router · reflector · loop      │
│    rag (4-tier RAG) · graph (async DAG) · memory (JSONL)                │
├─────────────────────────────────────────────────────────────────────────┤
│  Orchestration Layer — orchestration/                                   │
│    SwarmXOrchestrator (V5.8 async) · OllamaClient · TaskTrace           │
│    tools.py (24 tools + circuit breaker + rate limiter)                 │
│    swarmx_config.yaml (single config authority)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Memory Layer — memory/ · src/swarmx/memory/                            │
│    FAISSStore (tier-1) · VectorStore TF-IDF (tier-2)                   │
│    brain.memory JSONL (tier-3) · SQLite via swarmx.storage (tier-4)    │
├─────────────────────────────────────────────────────────────────────────┤
│  Evolution Layer — src/swarmx/evolution_layer/ · src/swarmx/core/       │
│    observer · critique · mutation · validation · deployment              │
│    evolution_engine (delta_capture, generate_proposals, approve/reject) │
├─────────────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer — Docker Compose · Ollama · zRAM · SQLite         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Model Topology (APEX-17 r8)

| Operator   | Ollama Tag                          | Typical role |
|------------|-------------------------------------|--------------|
| Relay      | `route-phi4-lite-q4km-prod`         | ultra-light routing only |
| Pilot      | `instruct-phi4-pro-q8-prod`         | fast chat and safe fallback |
| Architect  | `plan-phi4-pro-q8-prod`             | light planning |
| Architect  | `plan-qwen25-pro-q5km-prod`         | complex planning |
| Architect  | `plan-deepseekr1-pro-q5km-prod`     | deep planning fallback |
| Forge      | `code-qwen25-pro-q5km-prod`         | code generation |
| Oracle     | `reason-deepseekr1-pro-q5km-prod`   | deep reasoning |
| Auditor    | `critique-deepseekr1-pro-q5km-prod` | adversarial review |
| Lab        | `synth-phi4-exp-q8-dev`             | evolution observe |
| Lab        | `synth-qwen25-exp-q5km-dev`         | evolution mutate |
| Lab        | `synth-deepseekr1-exp-q5km-dev`     | evolution critique/validate |

GGUF files live under `~/llm-local/gguf/`. Modelfiles resolve through the explicit
tag-to-path map in [scripts/rebuild-all-modelfiles.sh](scripts/rebuild-all-modelfiles.sh).

**Hardware target:** 8 GB RAM, CPU-only, WSL-compatible.
**Strict single-model mode** is the default on constrained hosts.
Never load two 7B-class models simultaneously. Global Ollama residency is pinned to
`OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_KEEP_ALIVE=0` on the 8 GB profile.

**Legacy tag normalisation** (`src/swarmx/config.py → _normalise_model_tag()`):

| Legacy tag | Canonical tag | Operator |
|------------|---------------|----------|
| `phi4-mini` | `instruct-phi4-pro-q8-prod` | Pilot |
| `deepseek-r1:7b` | `reason-deepseekr1-pro-q5km-prod` | Oracle |
| `qwen2.5-coder` | `code-qwen25-pro-q5km-prod` | Forge |
| `phi4-fast-scar` (r6) | `instruct-phi4-pro-q8-prod` | Pilot |
| `deepseek-reasoner-scar` (r6) | `reason-deepseekr1-pro-q5km-prod` | Oracle |
| `qwen-worker-scar` (r6) | `code-qwen25-pro-q5km-prod` | Forge |

---

## Orchestration Flow (Python brain layer)

```
Task prompt
    │
    ▼
score_complexity()          ← Pilot (`instruct-phi4-pro-q8-prod`)
    │
        ├─ complexity < 0.65 ──► Architect plans  (`plan-qwen25-pro-q5km-prod`)
        └─ complexity ≥ 0.65 ──► Oracle plans     (`reason-deepseekr1-pro-q5km-prod`)
                                │
                                ▼
                        Plan normalisation
                        (min 1 step guard — V5.8 ENH-04)
                                │
                        ┌───────┴──────────┐
                        │  Step execution   │  × max_steps_per_task (20)
                        │   per-step tool   │
                        │   call loop       │  × max_tool_calls_per_step (6)
                        │   (max retries 3) │
                        └───────┬──────────┘
                                │
                        Memory compression
                        (triggered at 70% context threshold)
                                │
                        Final answer synthesis  (Architect)
                                │
                        Background critic audit (Auditor: `critique-deepseekr1-pro-q5km-prod`)
                                │
                        TaskTrace → disk  (atomic .tmp→rename, V5.8 ENH-02)
```

---

## Execution Policy Gate

All execution paths now enforce policy assessment before `execute_plan()`:

1. [src/swarmx/execution_gate.py](src/swarmx/execution_gate.py) provides `gate_execution()` as the shared fail-closed helper.
2. [src/swarmx/cli.py](src/swarmx/cli.py) retains policy enforcement for direct CLI execution.
3. [src/swarmx/server.py](src/swarmx/server.py) now gates `/api/run` and returns `403` with `policy_blocked` payloads when denied.
4. [src/swarmx/worker.py](src/swarmx/worker.py) now gates both `run/mission` and `resume` job paths.

This closes the prior safety gap where HTTP and background job execution could bypass policy checks.

---

## Runtime Governor

SwarmX now includes a pressure-aware runtime governor designed for 8 GB RAM + ZRAM targets.

Authoritative control path:

1. [src/swarmx/pressure.py](src/swarmx/pressure.py) samples `/proc/meminfo` and `/proc/swaps`.
2. [src/swarmx/config.py](src/swarmx/config.py) resolves `governance.*` thresholds and limits.
3. [orchestration/orchestrator.py](orchestration/orchestrator.py) degrades root-step fanout and batch concurrency under pressure.
4. [src/swarmx/llm.py](src/swarmx/llm.py) enforces per-tier token ceilings and persists dispatch telemetry.
5. [src/swarmx/metrics.py](src/swarmx/metrics.py) emits the canonical `governor_snapshot` consumed by the API and dashboard.

Governor tiers:

| Pressure tier | Trigger | Runtime behavior |
|---------------|---------|------------------|
| `normal` | available RAM above warn threshold and ZRAM below warn threshold | allow configured normal concurrency |
| `high` | RAM below warn threshold or ZRAM above warn threshold | degrade fanout to sequential execution |
| `critical` | RAM below critical threshold or ZRAM above critical threshold | enforce sequential execution and preserve headroom |

Governor payload surfaced to the UI:

```json
{
        "pressureLevel": "high",
        "availableMb": 912,
        "zramUsedPct": 0.72,
        "concurrencyLimit": 1,
        "observeOnly": false,
        "tokenCeilings": {
                "fast": 512,
                "worker": 1024,
                "supervisor": 1536,
                "reasoner": 4096,
                "critic": 2048
        },
        "timestamp": "2026-05-04T22:10:00+00:00"
}
```

The API rebroadcasts this snapshot as `system:governor`, and the dashboard renders it in both the command bar and telemetry rail.

---

## Startup Autopilot (V6.1 ENH-01)

SwarmX now performs a deterministic launch-time autopilot before `swarm up` starts the API stack.

Execution path:

1. [src/swarmx/console/commands/up.py](src/swarmx/console/commands/up.py) invokes `run_startup_autopilot_sync()`.
2. [src/swarmx/startup.py](src/swarmx/startup.py) runs four fail-open steps in parallel-aware fashion:
         - Ollama reachability probe
         - procfs pressure snapshot and concurrency resolution
         - fast-model warmup ping
         - dry-run evolution sync
3. The resulting `StartupSummary` is persisted to `~/.swarmx/state/startup_summary.json`.
4. The Fastify SSE layer caches and replays `system:startup`, `system:governor`, and `system:scs` so late-joining dashboards hydrate immediately.

### Python Event Bridge

SwarmX now separates historical lifecycle hydration from live SSE delivery.

Execution path:

1. [apps/swarmx-api/src/routes/logs.ts](apps/swarmx-api/src/routes/logs.ts) reads the tail of `~/.swarmx/traces/journal.jsonl` and maps it into canonical `SwarmXEvent` payloads at `GET /api/logs/events`.
2. [apps/swarmx-dashboard/src/hooks/useSwarmXEvents.ts](apps/swarmx-dashboard/src/hooks/useSwarmXEvents.ts) fetches that history once on load so Recent Events and the Log Explorer hydrate immediately after refresh.
3. [apps/swarmx-api/src/services/pyevents.ts](apps/swarmx-api/src/services/pyevents.ts) primes its byte cursor to EOF on first successful open, then broadcasts only new journal entries into `/api/events`.
4. [apps/swarmx-dashboard/src/stores/events.ts](apps/swarmx-dashboard/src/stores/events.ts) normalises `mission`, `run`, `task`, `evolution`, and `worker` lifecycle events into the unified log feed used by the dashboard overview and logs page.

This avoids replaying the full journal over SSE on every API boot while preserving immediate visibility into recent Python-side activity.

Startup summary contract:

```json
{
        "timestamp": "2026-05-05T06:30:10+00:00",
        "status": "ready",
        "narrative": "The swarm is humming beautifully. All systems nominal — models warm, memory green, ready to go.",
        "pressureLevel": "normal",
        "availableMb": 2418,
        "zramUsedPct": 0.22,
        "concurrencyLimit": 2,
        "ollamaReachable": true,
        "warmupDone": true,
        "evolverSynced": true,
        "evolverProposals": 1,
        "durationMs": 1840
}
```

---

## Tool Registry (24 tools)

| Tool                 | Category      | Key safety feature                         |
|----------------------|---------------|--------------------------------------------|
| `read_file`          | filesystem    | `_SAFE_READ_ROOTS` gate + line_range       |
| `write_file`         | filesystem    | `_SAFE_WRITE_ROOTS` gate                   |
| `list_directory`     | filesystem    | read-only, depth-limited                   |
| `run_python`         | execution     | AST-level import/call blocklist            |
| `run_shell_safe`     | execution     | explicit command allowlist, no shell=True  |
| `http_get`           | network       | SSRF blocklist (9 host/prefix entries)     |
| `http_post`          | network       | SSRF blocklist                             |
| `git_status`         | vcs           | safe roots gate, fixed command set         |
| `summarise_text`     | llm           | `/api/chat` only (no deprecated generate)  |
| `hash_file`          | utility       | SHA-256 / MD5                              |
| `yaml_parse`         | utility       | safe read roots gate                       |
| `json_merge`         | utility       | recursive deep-merge, no shell             |
| `json_validate`      | utility       | JSONSchema validation                      |
| `diff_files`         | utility       | **NEW V5.8** — difflib, safe read roots    |
| `semantic_search`    | memory        | **NEW V5.8** — 3-tier vector store         |
| `list_tools`         | meta          | registry introspection                     |
| `get_tool_call_log`  | observability | call log, last 500 entries                 |
| `env_info`           | diagnostics   | env var values redacted to length          |
| `read_url`           | network       | SSRF-checked HTTP fetch                    |
| `write_memory`       | memory        | guarded memory store write                 |
| `search_memory`      | memory        | keyword + FAISS fallback                   |
| `list_files`         | filesystem    | alias for list_directory                   |
| `template_render`    | utility       | Jinja2 template rendering (safe mode)      |
| `workflow_validate`  | workflow      | YAML workflow schema validation            |

**Cross-cutting:** every tool has per-tool rate limiting, circuit breaker (5-failure
threshold, 60 s reset window), call logging (keys only — values never logged), and
`ToolResult.to_dict()` safe JSON serialisation.

---

## Memory Architecture (4 Tiers)

```
Query/Store request
        │
        ▼
Tier 1: FAISSStore          ← requires faiss-cpu + sentence-transformers
        │  (384-dim L2, all-MiniLM-L6-v2, atomic index save)
        │  Fail → Tier 2
        ▼
Tier 2: VectorStore         ← requires scikit-learn + numpy
        │  (TF-IDF cosine, JSONL append-only, MAX_DOCS=1000 compaction)
        │  Fail → Tier 3
        ▼
Tier 3: brain.memory        ← stdlib only (json, pathlib)
        │  (JSONL keyword search, MAX_ENTRIES=500 compaction)
        │  Fail → Tier 4
        ▼
Tier 4: bare passthrough    ← always available (no memory enrichment)
```

All stores write to `$SWARM_HOME/memory/` (default `~/.swarmx/memory/`).

---

## Evolution Cycle (APEX-17 Gate-Aware)

```
observe()           collect runtime signals, recent runs, memory surface
    │
critique()          heuristic score + optional LLM reasoning critic
    │               (SWARM_LAYER_USE_LLM=1 to enable LLM path)
    │
generate_mutations()   3 bounded reversible candidates (routing / validation / config)
    │
validate_candidate()   score ≥ 0.05 AND risk ∈ {low, medium} → approved
    │
delta_capture()        composite fitness snapshot, keeper/rollback tagging
    │
stage_candidate()      persist as proposal artifact
    │
[Human approval gate]  required for risk=high; auto for risk=low with fitness delta > 0
    │
apply_proposals()      NEVER auto-deploys production changes (allow_auto_deploy: false)
```

**Gödel guard:** enforced in `src/swarmx/policy.py:godel_guard()` — an agent cannot
approve changes to its own permission scope. Hard `PolicyViolation` raised, never
silently bypassed.

---

## Directory Reference

```
SwarmX-1.5/
├── orchestration/          Core async orchestrator, tool registry, config
│   ├── orchestrator.py     V5.8 SwarmXOrchestrator (1935 lines)
│   ├── tools.py            Tool registry (24 tools, circuit breaker)
│   └── swarmx_config.yaml  Single config authority (V5.8)
├── brain/                  Lightweight adapter + domain logic
│   ├── __init__.py         Clean public API
│   ├── orchestrator.py     Bridge to orchestration/ + RAG enrichment
│   ├── graph.py            Async DAG executor (topological + parallel)
│   ├── router.py           Ollama /api/chat dispatcher
│   ├── dispatcher.py       Step classifier + model router
│   ├── planner.py          Goal → step list decomposition
│   ├── loop.py             Autonomous multi-iteration loop + quality scorer
│   ├── reflector.py        Post-execution quality reflection
│   ├── rag.py              4-tier RAG enrichment (graceful degradation)
│   ├── memory.py           JSONL brain memory store
│   ├── roles.py            Role→model mapping (aligned with swarmx_config.yaml)
│   ├── scorer.py           Re-exports score_output from loop.py
│   └── utils.py            chunk_tasks, flatten_results, truncate
├── memory/                 Vector memory backends
│   ├── __init__.py         get_store() factory (best available)
│   ├── faiss_store.py      Semantic NN store (graceful fallback)
│   └── vector_store.py     TF-IDF store (JSONL, safe path)
├── agents/                 Agent logic modules
│   ├── analyzer.py         Async result aggregator
│   ├── executor.py         Async parallel step executor
│   └── *.md                Agent persona cards (30 agents)
├── src/swarmx/             Python package (swarmx)
│   ├── core/               DB helpers, evolution engine, status schema
│   ├── evolution_layer/    Observer, critique, mutation, validation, deployment
│   ├── evolution/          Critique pipeline, critic/redteam agents
│   ├── memory/             Core memory types and JSONL implementation
│   ├── console/            TUI, Rich output, CLI commands
│   └── framework_adapters/ LangGraph, CrewAI, AutoGen, ADK, Strands, MCP
├── configs/                YAML config overlays (routing, evolution, guardrails)
├── workflows/              28 pre-built YAML workflow blueprints
├── skills/                 50+ skill cards (markdown persona fragments)
├── agents/                 Agent catalog + 30 agent cards
├── tests/                  pytest suite (brain, memory, agents, cli, evolution)
├── docs/                   Documentation (QUICKSTART, INSTALL, OPERATIONS)
├── models/                 Modelfiles (primary 6 + variant 4)
└── setup/                  install.sh, health_check.py, zram_setup.sh
```

---

## Safety Invariants (never bypassed)

1. `allow_auto_deploy` is **always False** in orchestrator config
2. Tool write paths restricted to `~/swarmx_outputs` and `/tmp`
3. SSRF blocklist covers all major cloud metadata endpoints
4. `run_python` uses AST-level dangerous import/call checking (not regex)
5. `run_shell_safe` uses an explicit command allowlist — model never supplies a shell string
6. Gödel guard prevents agents from approving changes to their own permission scope
7. ESCALATE / BLOCK / BLOCKED envelopes halt execution immediately
8. TaskTrace written atomically (`.tmp` → rename) — no partial trace files on crash
9. Memory failure never blocks orchestration (all store ops in try/except)
10. Complexity scoring timeout (30 s) → neutral routing (0.5) — never blocks

---

## Phase 1: Canonical Runtime Boundary *(added 2026-05-04)*

### Summary

Phase 1 establishes a hard runtime boundary between the **canonical execution
path** (`src/swarmx` + `cli/`) and the **compatibility adapter layer** (`brain/`).
All new code should target the canonical path. The brain/ layer is retained only
for backward-compatible import surfaces.

### Canonical vs. Legacy Entrypoints

| Use case                     | Legacy (deprecated)                          | Canonical (use this)                  |
|------------------------------|----------------------------------------------|---------------------------------------|
| Run a task from CLI          | `python -m swarmx run …`                     | `python -m cli run …`                 |
| Run a task from Python       | `brain.orchestrator.run_task(…)`             | `swarmx.cli.run(…)`                   |
| Plan a mission               | `brain.planner.plan_task(…)`                 | `swarmx.cli.plan_cmd(…)`              |
| Dispatch a step              | `brain.dispatcher.dispatch(…)`               | `swarmx.cli.run(…)`                   |
| Route to a model             | `brain.router.route(…)`                      | `swarmx.cli.run(…)` (routing internal)|
| Autonomous loop              | `brain.loop.autonomous_run(…)`               | `swarmx.cli.run(…)` with `autonomous=True` |
| Shell convenience wrappers   | direct `-m swarmx` or `-m cli` in each `.sh` | all `swarm-*.sh` → `swarm.sh` → `cli` |

### brain/ Compatibility Layer Status

The `brain/` directory is a **deprecated compatibility layer**. Each module emits
a one-time `DeprecationWarning` on first use:

```
DeprecationWarning: brain.orchestrator is a compatibility adapter.
Use swarmx.cli.run() directly.
```

**Do not add new functionality to `brain/`.** New features belong in `src/swarmx/`.

The legacy dashboard is archived at `docs/archive/dashboard-legacy/`; the canonical runtime is `apps/swarmx-dashboard/`.

### Shell Wrapper Delegation Chain

All 14 named convenience scripts now use a single two-line delegation pattern:

```bash
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$ROOT/swarm.sh" <COMMAND> "$@"
```

`swarm.sh` resolves the best available Python module at launch time:

```
swarm-*.sh → swarm.sh → importlib probe cli → importlib probe swarmx → error
                               ↓                        ↓
                       python -m cli              python -m swarmx
                       (canonical)                (compat fallback + warning)
```

### Dry-Run Diagnostics

Run with `SWARM_DRY_RUN=1` to inspect the fully resolved dispatch target and
dependency readiness without launching:

```bash
SWARM_DRY_RUN=1 bash swarm.sh
# or via Make:
make dry-run
```

Output includes: Python path/version, module availability (cli, swarmx, brain,
typer, yaml, aiohttp, faiss), dispatch resolution, registered CLI shims,
wrapper delegation status, and config file presence.

### Phase 1 CI Invariant Check

```bash
bash scripts/ci_phase1_check.sh
# or via Make:
make check-phase1
```

Verifies (without requiring a running service or Docker):
1. All `swarm-*.sh` pass `bash -n` syntax check  
2. All wrappers delegate via `bash "$ROOT/swarm.sh"`  
3. `swarm.sh` probes `cli` before `swarmx`  
4. All 15 CLI command shims exist in `cli/commands/`  
5. All shims registered in `cli/main.py`  
6. All `brain/*.py` compile cleanly  
7. All `brain/` adapter modules carry `DeprecationWarning`  
8. Phase 1 pytest regression suite (if pytest available)  

Exit code is `0` on full pass, `1` on any failure. Safe to run in CI without
Docker, Ollama, or network access.

