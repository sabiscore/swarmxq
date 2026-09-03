# SwarmXQ End-to-End Test Infrastructure Specification

**Document Version**: 2026.9.1-e2e-v1  
**Project**: SwarmXQ Autonomous Short-Form Video Production Studio  
**Target Environment**: CPU-only 16 GB RAM WSL2 / Linux  
**Status**: ACTIVE / CANONICAL

---

## 1. Test Philosophy & Principles

The SwarmXQ testing framework enforces rigorous quality assurance across all layers of the autonomous short-form video production studio. The core testing tenets are:

1. **Opaque-Box Testing**: Test suites evaluate the system via observable external contracts (Fastify API routes, Server-Sent Events, BullMQ job states, FFmpeg CLI invocations, file artifacts, and TypeScript interface contracts) without coupling to private implementation minutiae.
2. **Contract-Driven Expected Outputs**: All test assertions derive directly from authoritative specifications in `ORIGINAL_REQUEST.md`, `PROJECT.md`, `AGENTS.md`, and the governing `.ai/skills/` documents (`swarmxq-video-pipeline-architect`, `swarmxq-creative-director`, `swarmxq-model-orchestrator`, `swarmxq-startup-ops-architect`).
3. **Four-Tier Testing Hierarchy**:
   - **Tier 1: Feature Coverage** ($\ge 5$ tests per feature) — Verifies the happy path, primary functional contracts, and standard behavior for each of the 19 inventoried features.
   - **Tier 2: Boundary & Corner Cases** ($\ge 5$ tests per feature) — Rigorously stresses extreme inputs, limit thresholds, error cascades, malformed inputs, timeout ceilings, and recovery paths.
   - **Tier 3: Cross-Feature Combinations** — Validates pairwise interactions across multiple dimensions: Story Templates $\times$ Creative Tones $\times$ Length Presets $\times$ Render Backends $\times$ Memory Pressure Tiers $\times$ Hook Qualities.
   - **Tier 4: Real-World Application Scenarios** ($\ge 5$ complex scenarios) — Simulates full creator production lifecycles end-to-end from user prompt to final rendered MP4, caption package, virality scoring, and dashboard state.
4. **Deterministic & Isolated Execution**: Each test sets up and tears down its own isolated context, uses temporary directories, isolates subprocess execution, and handles non-deterministic values (such as timestamps and UUIDs) via regex or invariant structural matchers.
5. **Progressive Testability**: Tests support progressive verification across development milestones while offering comprehensive mock and live operational modes.

---

## 2. Feature Inventory & Requirement Traceability Matrix

| Feature # | Feature Name | Requirement Ref | Target Milestone | Source Document | Test Suite Location |
|---|---|---|---|---|---|
| **F01** | Story Templates Contract | §R5 | M1 | `packages/swarmx-types/src/video-types.ts` | `tier1-contracts-types.test.ts` |
| **F02** | SEO & Caption Types | §R3 | M1 | `packages/swarmx-types/src/video-types.ts` | `tier1-contracts-types.test.ts` |
| **F03** | QA Auditor Stage Type | §R1 | M1 | `packages/swarmx-types/src/video-types.ts`, `apps/swarmx-api/src/types/video.ts` | `tier1-contracts-types.test.ts` |
| **F04** | QA Auditor Gate Execution | §R1 | M2 | `apps/swarmx-api/src/services/video-orchestrator.ts` | `tier1-auditor-and-eviction.test.ts` |
| **F05** | Single-7B Eviction for Auditor | §R1, AGENTS.md §1 | M2 | `apps/swarmx-api/src/services/model-orchestrator.ts` | `tier1-auditor-and-eviction.test.ts` |
| **F06** | Reasoning Sanitization | §R1, §R3, AGENTS.md §4 | M2 | `apps/swarmx-api/src/services/reasoning-sanitizer.ts` | `tier1-sanitizer-and-seo.test.ts` |
| **F07** | Auto-Hashtag & SEO Finalizer | §R3 | M2 | `apps/swarmx-api/src/services/caption-generator.ts`, `video-orchestrator.ts` | `tier1-sanitizer-and-seo.test.ts` |
| **F08** | Story Templates Prompt Branching | §R5 | M2 | `apps/swarmx-api/src/services/video-orchestrator.ts` | `tier1-templates-and-ffmpeg.test.ts` |
| **F09** | Procedural FFmpeg Backgrounds | §R2 | M3 | `apps/swarmx-api/src/services/ffmpeg-video-renderer.ts` | `tier1-templates-and-ffmpeg.test.ts` |
| **F10** | Kinetic Text Engine | §R2 | M3 | `apps/swarmx-api/src/services/ffmpeg-video-renderer.ts` | `tier1-kinetic-and-fonts.test.ts` |
| **F11** | Dynamic Font Discovery | §R2 | M3 | `apps/swarmx-api/src/services/ffmpeg-video-renderer.ts` | `tier1-kinetic-and-fonts.test.ts` |
| **F12** | Subprocess Invariant Hardening | §R2, §R6, AGENTS.md | M4 | `apps/swarmx-api/src/services/ffmpeg-video-renderer.ts`, `ollama.ts` | `tier1-invariants-and-hardening.test.ts` |
| **F13** | Monorepo Invariant Hardening | §R6, AGENTS.md | M4 | Monorepo-wide scans | `tier1-invariants-and-hardening.test.ts` |
| **F14** | Single-Form Dashboard Generator | §R4 | M5 | `apps/swarmx-dashboard/src/app/page.tsx` | `tier1-dashboard-and-sse.test.ts` |
| **F15** | Live SSE Pipeline Tracker | §R4 | M5 | `apps/swarmx-api/src/routes/video.ts`, dashboard | `tier1-dashboard-and-sse.test.ts` |
| **F16** | Completion & Caption Editor | §R4 | M5 | `apps/swarmx-dashboard/src/components/` | `tier1-completion-and-vitest.test.ts` |
| **F17** | Dashboard Tests & Next Build | §R4 | M5 | `apps/swarmx-dashboard/tests/` | `tier1-completion-and-vitest.test.ts` |
| **F18** | E2E Testing Suite (Tiers 1-4) | Acceptance Criteria | E2E | `apps/swarmx-api/tests/e2e/runner.ts` | `tier1-e2e-and-production.test.ts` |
| **F19** | Production Readiness & 1st Video | §R7 | M6 | Local render harness & verification | `tier1-e2e-and-production.test.ts` |

---

## 3. Test Architecture & Directory Structure

All end-to-end and integration test suites reside in `apps/swarmx-api/tests/e2e/` with clean modular isolation:

```
apps/swarmx-api/tests/e2e/
├── runner.ts                                      # Master CLI & automated test runner
├── test-helpers.ts                                # Test framework fixtures, mocks, assertions & utilities
├── tier1-feature-coverage/                        # Tier 1: >=5 tests per feature (Features 1–19)
│   ├── tier1-contracts-types.test.ts              # F01, F02, F03 (15 tests)
│   ├── tier1-auditor-and-eviction.test.ts         # F04, F05 (10 tests)
│   ├── tier1-sanitizer-and-seo.test.ts            # F06, F07 (10 tests)
│   ├── tier1-templates-and-ffmpeg.test.ts         # F08, F09 (10 tests)
│   ├── tier1-kinetic-and-fonts.test.ts            # F10, F11 (10 tests)
│   ├── tier1-invariants-and-hardening.test.ts     # F12, F13 (10 tests)
│   ├── tier1-dashboard-and-sse.test.ts            # F14, F15 (10 tests)
│   ├── tier1-completion-and-vitest.test.ts        # F16, F17 (10 tests)
│   └── tier1-e2e-and-production.test.ts           # F18, F19 (10 tests)
├── tier2-boundary-corner/                         # Tier 2: >=5 boundary/corner tests per feature (Features 1–19)
│   ├── tier2-boundaries-contracts-auditor.test.ts # F01–F05 Boundaries (25 tests)
│   ├── tier2-boundaries-sanitizer-seo-ffmpeg.test.ts # F06–F10 Boundaries (25 tests)
│   ├── tier2-boundaries-fonts-hardening-dash.test.ts # F11–F15 Boundaries (25 tests)
│   └── tier2-boundaries-completion-e2e-prod.test.ts  # F16–F19 Boundaries (20 tests)
├── tier3-combinations/                            # Tier 3: Pairwise & multi-dimensional combinations
│   └── tier3-pairwise-matrix.test.ts              # Templates x Tones x Lengths x Backends x Pressure (50+ tests)
└── tier4-application-scenarios/                   # Tier 4: Real-world creator production scenarios
    └── tier4-real-world-scenarios.test.ts         # 5 complete end-to-end production scenarios
```

---

## 4. Real-World Application Scenarios (Tier 4)

### Scenario 1: Tech Myth-Buster Short (TikTok / Contrarian)
- **Actor/Goal**: Tech content creator debunking popular programming dogma.
- **Workflow**:
  1. Submits prompt *"Why 100% Code Coverage is Actually Bad"* with template `myth-vs-fact`, tone `contrarian`, length `short` for TikTok.
  2. Orchestrator executes `intent_classification` (Pilot) $\to$ `planning` (Architect) $\to$ `scripting` (Architect).
  3. Script generates Counterintuitive Claim hook and two distinct sections (Myth challenge vs evidence).
  4. `auditor_review` loads Auditor model (`critique-deepseekr1-pro-q5km-prod`) with Single-7B eviction of Architect; evaluates hook length ($\le 18$ words) and blocklist cleanliness.
  5. `storyboard_generation` outputs scene list containing split-screen visual instructions.
  6. `render_assembly` invokes FFmpeg with `plasma_pulse` background preset, `#ff2222` contrast accent, and kinetic text scaling.
  7. `finalizing` produces TikTok caption ($\le 280$ char soft limit), verified niche hashtags (`#devtips`, `#cleancode`), and attaches metadata.
- **Success Criteria**: Valid `.mp4` created, `auditor_review` stage recorded in SSE events, all 5 virality metrics populated.

### Scenario 2: Urgent Market Alert (YouTube Shorts / Listicle Countdown)
- **Actor/Goal**: Financial news creator delivering a fast countdown update.
- **Workflow**:
  1. Submits prompt *"Top 3 AI Regulations Passing This Week"* with template `listicle-countdown`, tone `urgent`, length `short` for Shorts.
  2. Scripting stage enforces $3 \to 1$ countdown structure with Number Shock hook.
  3. Auditor evaluates urgency framing and hook strength.
  4. Storyboard generates countdown scenes; FFmpeg renders with dynamic numeric emphasis and fast hold pacing ($1-2\text{ s}$).
  5. Auto-Hashtag populates YouTube Shorts caption ($\le 300$ soft limit, $\le 5000$ hard limit) with niche financial tags.
- **Success Criteria**: Storyboard scene count aligns with list count, kinetic text highlights all numerical cues.

### Scenario 3: Mystery / Deep Lore Reel (Instagram Reels / Reddit Story)
- **Actor/Goal**: Storyteller channel producing engaging anonymous narrative.
- **Workflow**:
  1. Submits prompt *"The Unexplained Radio Signal from Deep Trench"* with template `reddit-story`, tone `faceless_broll`, length `medium`.
  2. Scripting enforces Forbidden Knowledge hook and mandatory `[VISUAL:]` tags on every sentence.
  3. FFmpeg renders with `fractal_noise` procedural preset and muted monochrome highlights.
  4. Finalizer enforces Instagram Reels soft caption limit ($\le 125$ chars) with high-retention CTA.
- **Success Criteria**: Every body sentence verified for `[VISUAL:]` tag, caption fits Instagram in-feed display window.

### Scenario 4: POV Career Transformation (Kinetic Text / First-Person Immersion)
- **Actor/Goal**: Professional mentor challenging career status quo.
- **Workflow**:
  1. Submits prompt *"You Are Spending 80% of Your Time on the Wrong Tasks"* with template `pov-immersion`, tone `kinetic_text`, length `medium`.
  2. Scripting maintains second-person ("You") address and Identity Challenge hook.
  3. Kinetic Text Engine parses ALL-CAPS words and `*asterisks*` into dynamic `fontsize` filter expressions.
  4. Single-7B lock coordinates model handoffs smoothly without memory pressure overflow.
- **Success Criteria**: Dynamic font sizing correctly calculated per word weight; zero text overflow.

### Scenario 5: Blocklisted Hook Auto-Repair & Memory Pressure Recovery
- **Actor/Goal**: System resilience test simulating low-quality initial output under high host RAM load.
- **Workflow**:
  1. Submits prompt starting with weak opener *"In today's video we will look at..."*.
  2. Governor reports High Memory Pressure; orchestrator applies backoff delay before proceeding.
  3. Scripting stage initial output fails `validateHook()` against `HOOK_BLOCKLIST`.
  4. Auditor gate forces scripting re-run with hook repair instruction.
  5. Second pass produces compliant hook ($\le 18$ words, no blocklisted phrases, hookStrength $\ge 0.55$).
  6. Pipeline completes rendering; Single-7B eviction unloads all inference models before FFmpeg execution.
- **Success Criteria**: Pipeline successfully recovers, total retries $\le 1$, final video passes creative quality gating.

---

## 5. Coverage Thresholds & Assertions Matrix

| Tier | Description | Minimum Target Tests | Implemented Tests | Status |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage (F01–F19) | $\ge 95$ tests ($19 \times 5$) | 95 tests | VERIFIED |
| **Tier 2** | Boundary & Corner Cases (F01–F19) | $\ge 95$ tests ($19 \times 5$) | 95 tests | VERIFIED |
| **Tier 3** | Cross-Feature Combinations | $\ge 50$ tests | 52 tests | VERIFIED |
| **Tier 4** | Real-World Application Scenarios | $\ge 5$ scenarios | 5 scenarios | VERIFIED |
| **TOTAL** | Full E2E & Integration Suite | $\ge 245$ tests | **247 tests** | **PASSING** |

---

## 6. Test Runner Invocation & Verification Commands

### Execute Full E2E Test Suite
```bash
# Direct runner invocation via tsx
npx tsx apps/swarmx-api/tests/e2e/runner.ts

# With detailed verbose log output
npx tsx apps/swarmx-api/tests/e2e/runner.ts --verbose

# Run specific tier only (e.g. Tier 1 or Tier 4)
npx tsx apps/swarmx-api/tests/e2e/runner.ts --tier=1
npx tsx apps/swarmx-api/tests/e2e/runner.ts --tier=4

# Run specific feature tests only (e.g. Feature 4: Auditor Gate)
npx tsx apps/swarmx-api/tests/e2e/runner.ts --feature=4
```

### Monorepo Validation Commands
```bash
# TypeScript compilation across all packages
pnpm -F @swarmx/types typecheck
pnpm -F @swarmx/api typecheck
pnpm -F @swarmx/dashboard typecheck

# Monorepo invariant checks
grep -rn 'console\.' apps/swarmx-api/src/services apps/swarmx-api/src/routes  # Must return 0 hits
grep -rn '\-scar' apps/ packages/ src/                                          # Must return 0 hits
```
