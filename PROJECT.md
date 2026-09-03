# Project: SwarmXQ Autonomous Short-Form Video Production Studio

## Architecture
SwarmXQ is a local, CPU-only 16 GB WSL2 short-form video production studio (TikTok / Instagram Reels / YouTube Shorts) with single-click post-ready MP4 generation.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 apps/swarmx-dashboard                   │
                  │   Single-form generate • Live SSE • Virality • Captions  │
                  └────────────────────────────┬────────────────────────────┘
                                               │ HTTP / SSE / Events
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                    apps/swarmx-api                      │
                  │     Fastify API Routes • BullMQ Orchestration Queue     │
                  └──────┬─────────────────────┬────────────────────┬───────┘
                         │                     │                    │
                         ▼                     ▼                    ▼
     ┌───────────────────────┐ ┌─────────────────────────┐ ┌────────────────┐
     │ packages/swarmx-types │ │  video-orchestrator.ts  │ │ ffmpeg-video-  │
     │  Canonical Contracts, │ │  7-Stage Pipeline Loop  │ │  renderer.ts   │
     │  Types & Operator Map │ │  (Auditor + Finalizer)  │ │ Kinetic Engine │
     └───────────────────────┘ └───────────────┬─────────┘ └────────────────┘
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │      Ollama Local AI Models      │
                              │     Single-7B Lock & Eviction    │
                              └──────────────────────────────────┘
```

### Module Boundaries & Data Flow
1. **`packages/swarmx-types/`**: Single source of truth for monorepo contracts. Exports `VideoTemplate`, `VideoJobStage`, `VideoJobRequest`, `VideoOutputMetadata`, `CaptionDraft`, `HashtagSet`, and canonical operator maps.
2. **`apps/swarmx-api/`**:
   - `src/services/video-orchestrator.ts`: Executes the 7-stage pipeline: `intent_classification` -> `planning` -> `scripting` -> `auditor_review` -> `storyboard_generation` -> `render_assembly` -> `finalizing`.
   - `src/services/model-orchestrator.ts`: Enforces Single-7B lock with `evictIncompatible()` before loading Architect (`plan-qwen25-pro-q5km-prod`), Auditor (`critique-deepseekr1-pro-q5km-prod`), or Oracle (`reason-deepseekr1-pro-q5km-prod`).
   - `src/services/ffmpeg-video-renderer.ts`: Procedural background filters (`gradient_flow`, `fractal_noise`, `plasma_pulse`, `minimal_grid`) + Kinetic Text Engine with dynamic `fontsize` expressions, `*asterisk*` / ALL-CAPS emphasis parsing, accent color highlights, and multi-distro font discovery in `/usr/share/fonts/truetype/`.
   - `src/services/video-cleanup.ts`: Background job retention cleanup with `.unref()` timer.
3. **`apps/swarmx-dashboard/`**: Next.js 14 UI featuring single-form generation, live SSE pipeline progress tracking, video player preview, 5-dimension virality score display, in-place caption editing with platform character limits (TikTok, Reels, Shorts), and zero `console.*` logging.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Story Templates Contract | Define `VideoTemplate` 4-member union and add `template?: VideoTemplate` to `VideoJobRequest` | M1 | ORIGINAL_REQUEST §R5 |
| 2 | SEO & Caption Types | Add `captionDraft?: CaptionDraft` to `VideoOutputMetadata` across packages | M1 | ORIGINAL_REQUEST §R3 |
| 3 | QA Auditor Stage Type | Add `auditor_review` to `VideoJobStage`, `VIDEO_JOB_STAGE_ORDER`, and progress weights | M1 | ORIGINAL_REQUEST §R1 |
| 4 | QA Auditor Gate Execution | Integrate Auditor (`critique-deepseekr1-pro-q5km-prod`) between `scripting` and `storyboard_generation` with hook evaluation, blocklist enforcement, and max 1 retry | M2 | ORIGINAL_REQUEST §R1 |
| 5 | Single-7B Eviction for Auditor | Enforce `evictIncompatible()` between Architect and Auditor stages; record `ctx.modelsUsed['auditor_review']` inside stage function | M2 | ORIGINAL_REQUEST §R1, AGENTS.md |
| 6 | Reasoning Sanitization | Wrap all Ollama outputs with `sanitizeReasoningOutput()` and parse with `extractJson()` | M2 | ORIGINAL_REQUEST §R1, §R3, AGENTS.md |
| 7 | Auto-Hashtag & SEO Finalizer | Extend `finalizing` stage with Oracle (narrative) and Pilot (hashtags) to populate `CaptionDraft` with platform caps | M2 | ORIGINAL_REQUEST §R3 |
| 8 | Story Templates Prompt Branching | Branch scripting & storyboard prompts on `ctx.job.request.template` for all 4 templates | M2 | ORIGINAL_REQUEST §R5 |
| 9 | Procedural FFmpeg Backgrounds | Implement `gradient_flow`, `fractal_noise`, `plasma_pulse`, `minimal_grid` mapped to 8 tones via `TONE_BACKGROUNDS` | M3 | ORIGINAL_REQUEST §R2 |
| 10 | Kinetic Text Engine | Dynamic `fontsize` scaling with `t`, ALL-CAPS / `*asterisk*` emphasis parsing, and `TONE_ACCENTS` highlights | M3 | ORIGINAL_REQUEST §R2 |
| 11 | Dynamic Font Discovery | Recursive scanner for `/usr/share/fonts/truetype/` with `FONT_UNAVAILABLE` error throwing | M3 | ORIGINAL_REQUEST §R2 |
| 12 | Subprocess Invariant Hardening | Replace all `exec()` with `execFileChecked()` with timeout and maxBuffer bounds; fix `ollama.ts` | M4 | ORIGINAL_REQUEST §R2, §R6, AGENTS.md |
| 13 | Monorepo Invariant Hardening | Zero `console.*`, zero `-scar` tags, 8 tones in `TONE_RULES`, `{ once: true }` on abort listeners, `COMFY_POLL_MAX_ATTEMPTS` derived, `unref()` cleanup | M4 | ORIGINAL_REQUEST §R6, AGENTS.md |
| 14 | Single-Form Dashboard Generator | Prompt textarea, 8-tone selector, length picker, 4-template picker in unified single view | M5 | ORIGINAL_REQUEST §R4 |
| 15 | Live SSE Pipeline Tracker | `EventSource` subscriber for `video:progress` rendering all 7 stages including `auditor_review` | M5 | ORIGINAL_REQUEST §R4 |
| 16 | Completion & Caption Editor | Native `<video controls>`, 5 virality badges, editable `<textarea>` fields, copy buttons, named platform caps | M5 | ORIGINAL_REQUEST §R4 |
| 17 | Dashboard Tests & Next Build | Ensure $\ge 52$ passing vitest tests and clean `next build` | M5 | ORIGINAL_REQUEST §R4 |
| 18 | E2E Testing Suite (Tiers 1-4) | Comprehensive opaque-box test runner covering all inventoried features with $\ge 11 \times N$ tests | E2E Track | ORIGINAL_REQUEST Acceptance Criteria |
| 19 | Production Readiness & 1st Video | End-to-end local generation producing valid `.mp4`, UI polish and final verification | M6 | ORIGINAL_REQUEST §R7 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Design test runner & test cases for Tiers 1-4, publish `TEST_READY.md` | none | DONE |
| M1 | Monorepo Contracts & Video Types | `packages/swarmx-types`, `apps/swarmx-api/src/types`: `VideoTemplate`, `auditor_review`, `CaptionDraft` metadata | none | DONE |
| M2 | Video Pipeline Stages (Auditor + SEO) | `video-orchestrator.ts`: `auditor_review` stage, Single-7B lock, SEO Finalizer, template prompt branching | M1 | IN_PROGRESS |
| M3 | FFmpeg Procedural BG & Kinetic Text | `ffmpeg-video-renderer.ts`: 4 procedural presets, kinetic text scaling, font scanner, tone accents | M1 | PLANNED |
| M4 | Invariant Hardening & Subprocess Safety | Monorepo-wide zero `console.*`, zero `-scar`, `execFile` exclusively, `{ once: true }` listeners, cleanup timer | M1, M2, M3 | PLANNED |
| M5 | Dashboard UX Overhaul & Vitest Suite | `apps/swarmx-dashboard`: single-form UI, live SSE, caption editor, virality badges, vitest $\ge 52$ | M1, M2 | PLANNED |
| M6 | Production Readiness & Final Verification | Local E2E video generation, full Definition of Done pass, adversarial hardening | M1-M5, E2E | PLANNED |

---

## Interface Contracts

### 1. `VideoTemplate` & `VideoJobRequest` (`packages/swarmx-types/src/video-types.ts`)
```typescript
export type VideoTemplate =
  | "myth-vs-fact"
  | "pov-immersion"
  | "listicle-countdown"
  | "reddit-story";

export interface VideoJobRequest {
  id?: string;
  topic?: string;
  script?: string;
  tone?: VideoTone;
  template?: VideoTemplate;
  lengthPreset?: VideoLengthPreset;
  aspectRatio?: VideoAspectRatio;
  // ... existing optional flags
}
```

### 2. `VideoJobStage` & Progress Map (`packages/swarmx-types/src/video-types.ts`)
```typescript
export type VideoJobStage =
  | "intent_classification"
  | "planning"
  | "scripting"
  | "auditor_review"
  | "storyboard_generation"
  | "render_assembly"
  | "finalizing";

export const VIDEO_STAGE_PROGRESS_RANGES: Record<VideoJobStage, { start: number; end: number }> = {
  intent_classification: { start: 0, end: 15 },
  planning:              { start: 15, end: 25 },
  scripting:             { start: 25, end: 40 },
  auditor_review:        { start: 40, end: 50 },
  storyboard_generation: { start: 50, end: 70 },
  render_assembly:       { start: 70, end: 90 },
  finalizing:            { start: 90, end: 100 },
};
```

### 3. `CaptionDraft` & Platform Caps (`packages/swarmx-types/src/video-types.ts`)
```typescript
export interface HashtagSet {
  broad: string[];
  niche: string[];
  trending: string[];
}

export interface CaptionDraft {
  firstLine: string;
  body: string;
  cta: string;
  hashtags: HashtagSet;
  soundSuggestion?: string;
}

export const PLATFORM_CHAR_CAPS = {
  tiktok: { hard: 2200, soft: 280 },
  reels:  { hard: 2200, soft: 125 },
  shorts: { hard: 5000, soft: 300 },
} as const;
```

### 4. Procedural Background Presets (`apps/swarmx-api/src/services/ffmpeg-video-renderer.ts`)
```typescript
export type ProceduralBackgroundPreset =
  | "gradient_flow"
  | "fractal_noise"
  | "plasma_pulse"
  | "minimal_grid";

export const TONE_PROCEDURAL_PRESETS: Record<VideoTone, ProceduralBackgroundPreset> = {
  cinematic:      "gradient_flow",
  warm:           "gradient_flow",
  educational:    "fractal_noise",
  faceless_broll: "fractal_noise",
  urgent:         "plasma_pulse",
  contrarian:     "plasma_pulse",
  minimal:        "minimal_grid",
  kinetic_text:   "minimal_grid",
};
```

---

## Code Layout & File Ownership
- **Monorepo Root**: `AGENTS.md`, `CLAUDE.md`, `NEXUS.md`, `PROJECT.md`, `package.json`, `pnpm-workspace.yaml`
- **`packages/swarmx-types/`**:
  - `src/video-types.ts`: Monorepo video contracts (`VideoTemplate`, `VideoJobStage`, `CaptionDraft`, `VideoOutputMetadata`).
  - `src/operator-map.ts`: Canonical operator tags and model routing mapping.
- **`apps/swarmx-api/`**:
  - `src/types/video.ts`: Fastify-internal video types and stage definitions.
  - `src/services/video-orchestrator.ts`: 7-stage execution, Single-7B lock transitions, Auditor gate, SEO finalizer, template prompt branching.
  - `src/services/video-runtime-config.ts`: Model tag mappings, stage timeouts.
  - `src/services/video-assets.ts`: Asset generation and metadata compilation.
  - `src/services/ffmpeg-video-renderer.ts`: Procedural FFmpeg background generation, Kinetic Text Engine, font discovery.
  - `src/services/model-orchestrator.ts`: Single-7B lock and model eviction logic.
  - `src/services/ollama.ts`: Local Ollama subprocess management with `execFile`.
  - `src/services/video-cleanup.ts`: Background job retention cleanup with `unref()`.
  - `scripts/video-regression-check.ts`: Renderer regression test harness.
  - `scripts/reasoning-sanitizer-regression.ts`: DeepSeek-R1 sanitizer test harness.
- **`apps/swarmx-dashboard/`**:
  - `src/app/page.tsx`: Single-form generator with 8 tones and 4 templates, live SSE pipeline tracker, video preview, virality badges, caption editor.
  - `src/lib/video-dashboard.ts`: Dashboard-side video constants, stage labels, platform char caps.
  - `src/components/`: Video player, caption editor, virality badges, progress indicator.
  - `tests/`: Vitest test suites ($\ge 52$ tests passing).
