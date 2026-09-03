# Original User Request

## Initial Request — 2026-09-01T04:15:17+01:00

You are the Project Orchestrator for SwarmXQ.

Your Working Directory: `/home/scar/Documents/SwarmXQ/.agents/teamwork_preview_orchestrator_1`
Project Root: `/home/scar/Documents/SwarmXQ`
Authoritative Request: `/home/scar/Documents/SwarmXQ/ORIGINAL_REQUEST.md` (and `.agents/ORIGINAL_REQUEST.md`)

## Mission Overview
Transform SwarmXQ (`/home/scar/Documents/SwarmXQ`) from a general-purpose AI swarm into a hyper-focused, fully autonomous **short-form video production studio** (TikTok/Reels/Shorts) that runs entirely on CPU-only 16 GB WSL2 hardware.

Read and adhere strictly to `AGENTS.md`, `CLAUDE.md`, and relevant `.ai/skills/` (`swarmxq-video-pipeline-architect`, `swarmxq-creative-director`, `swarmxq-model-orchestrator`, `swarmxq-startup-ops-architect`).

## Core Requirements to Implement and Verify

### R1. QA Auditor Gate — Script Critique Before Render
- Integrate the Auditor operator (`critique-deepseekr1-pro-q5km-prod`) as a new pipeline step between `scripting` and `storyboard_generation`.
- Evaluates generated script against HOOK_BLOCKLIST, 18-word hard limit on `[HOOK]`, and virality rubric anchors defined in `.ai/skills/swarmxq-creative-director/SKILL.md`.
- If `hookStrength < 0.55`, force a scripting re-run with explicit hook repair instructions (max 1 retry).
- Obey SINGLE-7B LOCK: call `evictIncompatible()` before loading `critique-deepseekr1-pro-q5km-prod`, and Architect model must be unloaded first.
- Wrap all Auditor output in `sanitizeReasoningOutput()` before parsing.
- Set `ctx.modelsUsed['auditor_review']` immediately after `acquireModel()` inside stage function (never in `runStage()`).
- Use AbortController with `{ once: true }` listener.
- Update pipeline progress map so all stages (including new audit step) sum to 100% and SSE `video:progress` broadcasts it.

### R2. Procedural FFmpeg Background + Kinetic Text Engine
- Upgrade `apps/swarmx-api/src/services/ffmpeg-video-renderer.ts` so `renderWithFfmpeg()` generates native FFmpeg procedural abstract backgrounds:
  - 4 presets: `gradient_flow` (`geq`), `fractal_noise` (`geq` + `colorchannelmixer`), `plasma_pulse` (sine-wave RGB oscillation), `minimal_grid` (sharp geometric lines on dark BG) selectable via storyboard tone and `TONE_BACKGROUNDS` map.
- Kinetic Text Engine:
  - `drawtext` with scale animation (`fontsize` expression driven by `t`) and colour-highlight (accent from `TONE_ACCENTS`) for all-caps words or `*asterisks*` in script.
  - Standard body text uses smaller, lower-opacity style.
  - Scan `/usr/share/fonts/truetype/` and throw `FONT_UNAVAILABLE` if no `.ttf` found.
  - Use `execFile()` (never `exec()`), with explicit `timeout` and `maxBuffer` caps.

### R3. Auto-Hashtag & SEO Finalizer in `finalizing` Stage
- Extend `finalizing` in `video-orchestrator.ts` to produce a fully populated `CaptionDraft` attached to `VideoOutputMetadata`.
- Oracle operator (`reason-deepseekr1-pro-q5km-prod`) generates caption narrative; Pilot (`instruct-phi4-pro-q8-prod`) generates hashtag set.
- Both calls must use `withTimeout()`, `sanitizeReasoningOutput()`, and `extractJson()` (never raw `JSON.parse()`).
- Satisfy `CaptionDraft` interface in full: `firstLine` (<= 40 chars, regex-blocked openers `I|My|This|We|Our`), `body`, `cta`, `hashtags.broad/niche/trending`, `soundSuggestion` (no URLs, no artist names).
- Platform character caps (TikTok 2200/280, Instagram Reels 2200/125, YouTube Shorts 5000/300) must be named constants.
- SINGLE-7B LOCK: Oracle evicted before Pilot loads if cannot co-reside.

### R4. Zero-Friction Dashboard — One-Click Generate + Instant Playback
- Refactor `apps/swarmx-dashboard/`:
  1. Single-form generate: prompt textarea, tone selector (8 variants), length picker (short/medium/long), optional template picker. No multi-step wizard.
  2. Live pipeline view via SSE (`EventSource` -> `GET /api/video/jobs/:id/events`).
  3. Completion state: native `<video>` pointing at `GET /api/video/jobs/:id/download`, 5 virality score badges, full CaptionDraft display with char count badges (amber at soft limit, red at hard cap).
  4. Caption editor: in-place editable `<textarea>` per caption field with live char counter per platform + "Copy" button.
  5. Error state with retry/edit prompt.
- Zero `console.*` anywhere in `apps/swarmx-dashboard/src/`. All logging via `log.*`.

### R5. Video Template System — 4 Canonical Story Templates
- 4 named templates: `myth-vs-fact`, `pov-immersion`, `listicle-countdown`, `reddit-story`.
- Add `VideoTemplate = 'myth-vs-fact' | 'pov-immersion' | 'listicle-countdown' | 'reddit-story'` to `packages/swarmx-types/src/` and optional `template?: VideoTemplate` in `VideoJobRequest`.
- Branch on `ctx.request.template` in scripting and storyboard stage prompts in `video-orchestrator.ts`.

### R6. Invariant Hardening & Compliance
- Ensure definition of done checks pass:
  - `pnpm -F swarmx-api tsc --noEmit` exits 0
  - `pnpm -F swarmx-types tsc --noEmit` exits 0
  - `pnpm -F swarmx-dashboard tsc --noEmit` exits 0
  - `pnpm -F swarmx-dashboard vitest run` (>= 52 passing)
  - `pnpm -F swarmx-dashboard next build` exits 0
  - `npx tsx apps/swarmx-api/scripts/video-regression-check.ts` exits 0
  - `npx tsx apps/swarmx-api/scripts/reasoning-sanitizer-regression.ts` exits 0
  - `grep -rn 'console\.' apps/swarmx-api/src/services apps/swarmx-api/src/routes` (0 hits)
  - `grep -rn '\-scar' apps/ packages/ src/` (0 hits)
  - `git diff --check` passes with no whitespace errors.
