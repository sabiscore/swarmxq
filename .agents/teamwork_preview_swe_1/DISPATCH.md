# Dispatch History

## 2026-08-31T21:28:08Z

<USER_REQUEST>
Requested team: small focused team

This is a single self-contained update; keep it small and focused.
Update CLAUDE.md and NEXUS.md to reconcile their baselines with the shipped V6.2.60 reality and strictly apply the v3.1.0 Core Execution Directive's 16GB hardware assumptions (INV-09, CPU floor, etc.).

Integrity mode: demo
Working directory: /home/scar/Documents/SwarmXQ

## Requirements

### R1. Reconcile Baseline Versions
Update headers and references in both `CLAUDE.md` and `NEXUS.md` to reflect the shipped `V6.2.60` reality, replacing outdated `V6.2.53`/`V6.2.63` references where appropriate based on the memory notes.

### R2. Apply 16GB Hardware Assumptions
Integrate the v3.1.0 Core Execution Directive. Replace all 8GB-degraded assumptions with the new 16GB baseline (INV-09). Explicitly state that `OLLAMA_MAX_LOADED_MODELS=1` (or 2 for Pilot+7B) and `MAX_CONCURRENT_JOBS=1` remain strictly enforced, as CPU inference is strictly serial (`OLLAMA_NUM_PARALLEL=1`).

### R3. Update Pressure and Taxonomy Reasoning
Update the documentation to reflect that the binding constraint is now the CPU pressure floor (INV-06) (`loadAvg1m / coreCount < 0.85`), not RAM exhaustion. Ensure the 7-operator taxonomy fits within the new constraints without relaxing the SINGLE-7B LOCK.

## Acceptance Criteria

### Documentation Accuracy
- [ ] Both `CLAUDE.md` and `NEXUS.md` accurately state the 16GB RAM baseline.
- [ ] The SINGLE-7B LOCK and `MAX_CONCURRENT_JOBS=1` are explicitly preserved and not relaxed.
- [ ] The CPU pressure floor (INV-06) is documented as the primary stalling constraint.

### Verification (Programmatic & Agent-as-judge)
- [ ] `git diff --check` passes with zero whitespace violations.
- [ ] `grep -rn '\-scar'` across the updated files returns zero hits (no legacy aliases reintroduced).
- [ ] An independent reviewer agent verifies that all V3.1.0 directive invariants (INV-06, INV-08, INV-09) are present in the updated markdown files and that no existing invariants (like INV-01 through INV-05) were accidentally removed.
</USER_REQUEST>
