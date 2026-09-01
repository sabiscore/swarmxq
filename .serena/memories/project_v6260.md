---
name: project_v6260
description: V6.2.60 - low-RAM auto-enable ESM-ordering fix, dedicated isLowRamVideoMode cache, voiceProfileId/storyMode request contract + runtime wiring, dashboard quick-start/runtime-guidance UX
metadata:
  type: project
---

# SwarmXQ Project Memory - V6.2.60

## Session Date

2026-08-05

## Shipped

### Video pipeline — low-RAM auto-enable ESM ordering fix

- Fixed `shouldAutoEnableLowRamMode()` in `video-runtime-config.ts`: it was
  comparing the Zod-defaulted `loadEnv().SWARMX_VIDEO_LOW_RAM_MODE` (always
  `"0"` unless explicitly set) instead of the raw env var, so auto-enable on
  constrained RAM was dead code.
- Deeper fix: `isLowRamVideoMode()` now owns a dedicated, self-contained
  memoized cache (`cachedLowRamMode`) populated from `readRawEnv()` plus a
  live `/proc/meminfo` check on first real invocation, immune to ESM
  import-ordering hazards from other modules calling `loadEnv()` at their own
  top level before `server.ts`'s body runs.
- Added `resetLowRamModeCacheForTesting()` matching the existing
  `resetEnvForTesting()` pattern in `env.ts`.
- Updated `video-regression-check.ts` and `video-runtime-config.test.ts` to
  explicitly set `SWARMX_VIDEO_LOW_RAM_MODE=0` where prior assertions assumed
  "unset" always means the full 7B pipeline.
- Verified end-to-end after a full stack restart: startup log
  `"Video pipeline runtime mode resolved"` now reflects live `/proc/meminfo`
  state instead of being stuck at `false`.

### Backend — voice profile routing (voiceProfileId / storyMode)

- Added `voiceProfileId` and `storyMode` to the canonical video request
  contracts (`packages/swarmx-types/src/video-types.ts`,
  `apps/swarmx-api/src/types/video.ts`), route validation
  (`apps/swarmx-api/src/routes/video.ts`), and dashboard normalization
  (`apps/swarmx-dashboard/src/lib/video-dashboard.ts`).
- `ffmpeg-video-renderer.ts` now forwards both fields into TTS synthesis,
  stamps them onto the packaged `voiceArtifact`, and records provider
  fallback reasons when a requested Kokoro profile has to degrade.
- `voice-providers.ts`: explicit Kokoro profile requests are now preferred
  ahead of benchmark ordering, while the normal `auto` path still uses
  benchmark-guided ranking.

### Dashboard — guided submission UX

- Added `video-form-presets.ts` (quick-start presets) and
  `video-runtime-messaging.ts` (runtime-blocking/failure guidance), each with
  a dedicated test file.
- `VideoJobForm.tsx` restructured into an Essentials/Advanced split with
  quick-start presets; `VideoJobTimeline.tsx` and the job detail/list pages
  updated to surface runtime-blocking messages and concrete failure
  next-actions instead of relying on console output.

### Documentation

- `docs/VIDEO-GENERATION.md`: documented `voiceProfileId`/`storyMode` in the
  `POST /api/video/jobs` request body, and added a submission UX subsection
  under Dashboard integration.
- `docs/CHANGELOG.md`: added a new entry. **Correction made this session**:
  the entry was initially mislabeled `V6.2.59` (already used by the
  2026-08-03 retry-ceiling/disclosure-mode release documented in
  `project_v6259.md`); renumbered to `V6.2.60` before committing.

## Quality Gates

- `pnpm --filter @swarmx/types typecheck` — passed, zero errors.
- `pnpm --filter @swarmx/api typecheck` — passed (via focused + full suite runs).
- `pnpm --filter @swarmx/api exec vitest run __tests__/video-runtime-config.test.ts __tests__/template-aware-qc.test.ts __tests__/voice-providers.test.ts` — 41 passed (3 files).
- `pnpm --filter @swarmx/api exec node --import tsx scripts/video-regression-check.ts` — passed.
- `pnpm --filter @swarmx/api test` (full suite) — **353 passed**, 22 test files.
- `pnpm --filter @swarmx/dashboard typecheck` — passed, zero errors.
- `pnpm --filter @swarmx/dashboard exec vitest run` (focused: runtime-guidance, video-dashboard, video-form-presets, video-runtime-messaging) — 15 passed (4 files).
- `pnpm --filter @swarmx/dashboard build` (`next build`) — Turbopack build succeeded, 14 routes, zero errors.
- `git diff --check` — clean, both before and after the version-number correction.

## Host profile

- Restart performed via `bash scripts/startup-enhanced.sh --dashboard`
  (standard_cpu_16gb profile, `TOTAL_MB=15869`, `AVAILABLE_MB≈8984` at boot).
- CPU governor reported `powersave` (no passwordless sudo to fix) — inference
  runs at reduced clock; unchanged pre-existing host condition, not caused by
  this session.
- Ollama reachable, Redis reachable (BullMQ Worker started), API listening on
  `127.0.0.1:3001`, dashboard serving `/video` with `200 OK`.
- `/api/system/health` at verification time showed `warmup.done: false`
  (`coldStartEtaSecs: 6`) and `availableRamMb ≈ 4.3 GB` — expected transient
  state right after restart, not a regression.

## Runtime pivots

- First `git push origin main` attempt failed in-session with
  `ssh: Could not resolve hostname github.com` (local DNS/network outage in
  the tool's shell). The user re-ran `git push origin main` directly in their
  own terminal afterward and it succeeded (`f7be46f..6e1c913 main -> main`),
  confirmed by a follow-up `Everything up-to-date`.
- **Version-numbering collision caught and corrected this session**: the new
  CHANGELOG entry was drafted as `V6.2.59` by only reading `CHANGELOG.md`'s
  most recent heading, without cross-checking `.serena/memories/MEMORY.md`
  or `git log` for the actual last-shipped version. `V6.2.59` was already
  used by a shipped, committed release (`fc91a40`/`4975caa`,
  `project_v6259.md`, 2026-08-03). Renumbered to `V6.2.60` and this note was
  written to close the gap before pushing again.

## New invariants discovered

- **Version-number sourcing rule**: before writing a new `CHANGELOG.md`
  heading, cross-check both `.serena/memories/MEMORY.md` (tail) and
  `git log --oneline -5` for the actual last-shipped version — the top
  heading in `CHANGELOG.md` alone is not sufficient evidence of the next
  free version number, especially across same-week sessions.

## TONE_RULES state

- Unchanged this session; all 8 variants (`contrarian`, `urgent`,
  `educational`, `cinematic`, `warm`, `minimal`, `faceless_broll`,
  `kinetic_text`) still present in `video-orchestrator.ts` (not touched).

## Voice benchmark state

- Not re-run this session (no TTS provider install/upgrade). Last known
  state per `project_v6255.md`: refreshed, Kokoro recommended.

## Remaining work / next session starting point

- Milestone queue unchanged: next is **Priority 13 — S5: Golden-Path
  Re-Cert** per `CLAUDE.md`.
- `CLAUDE.md` header still states `Baseline: V6.2.53` — stale relative to
  shipped `V6.2.55`–`V6.2.60` work. Flagged but intentionally not rewritten
  this session (out of scope for a docs/voice-routing slice); recommend a
  dedicated baseline-reconciliation pass.
- `project_v6254.md` exists on disk but has no corresponding line in
  `.serena/memories/MEMORY.md`'s index — pre-existing gap, not introduced
  this session; worth a small cleanup pass later.
- Commit + push this session's changes (CHANGELOG.md renumber, this memory
  note, `MEMORY.md` index update) — pending in this same session.
