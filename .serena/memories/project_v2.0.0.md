# SwarmXQ Video Dashboard — Core Execution Directive (v2.0.0)

## Verified Fixes (v2.0.0)
1. **Unclassified Error Retry Gap**: Modified `backend-fetch-errors.ts` to ensure that native network exceptions (e.g. `TypeError: fetch failed`) are properly assigned the `OLLAMA_UNAVAILABLE` or `COMFY_UNAVAILABLE` code rather than falling through to `UNKNOWN`. This allows the retry logic in `video-orchestrator.ts` to correctly handle connection errors.
2. **Telemetry / Governor Panel Abstraction**: Updated `apps/swarmx-dashboard/src/components/layout/TelemetryRail.tsx` to properly format canonical tags using `formatOperatorLabel` in the Governor panel, conforming to the requirement that raw canonical tags must be formatted with `resolveOperatorName()/formatOperatorLabel()`.

## Preserved Invariants
- CPU-pressure gate is active (`CPU_LOAD_CEILING = 0.85` in `apps/swarmx-dashboard/src/lib/runtime-guidance.ts`).
- Ready-to-post surfacing: `VideoJobCard.tsx` properly checks and displays `CertificationTier` along with detailed `certificationBlockers` for jobs failing `PRODUCTION_PACK_VALID`.
- Zod schema validation in `env.ts`.
- `MAX_CONCURRENT_JOBS = 1`.
- `OLLAMA_MAX_LOADED_MODELS = 2` for 16GB profile.
- All testing invariants remain passing.
