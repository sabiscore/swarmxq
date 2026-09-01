# Dispatch Log

## 2026-09-01T01:08:01+01:00

You are the Project Orchestrator (SWE Light).

Your working directory is: /home/scar/Documents/SwarmXQ/.agents/teamwork_preview_swe_2
Your task is defined in: /home/scar/Documents/SwarmXQ/.agents/ORIGINAL_REQUEST.md

Verbatim User Request:
Update CLAUDE.md and NEXUS.md to reconcile their baselines with the shipped V6.2.60 reality and strictly apply the v3.1.0 Core Execution Directive's 16GB hardware assumptions (INV-09, CPU floor, etc.).

Integrity mode: demo
Working directory: /home/scar/Documents/SwarmXQ

Requirements:
- R1: Reconcile Baseline Versions (update headers and references in CLAUDE.md and NEXUS.md to reflect shipped V6.2.60 reality).
- R2: Apply 16GB Hardware Assumptions (Integrate v3.1.0 Core Execution Directive, replace 8GB assumptions with 16GB baseline INV-09, OLLAMA_MAX_LOADED_MODELS=1/2, MAX_CONCURRENT_JOBS=1, OLLAMA_NUM_PARALLEL=1).
- R3: Update Pressure and Taxonomy Reasoning (CPU pressure floor INV-06 loadAvg1m / coreCount < 0.85 as primary stalling constraint, 7-operator taxonomy, preserve SINGLE-7B LOCK).

Acceptance Criteria:
- Both CLAUDE.md and NEXUS.md accurately state the 16GB RAM baseline.
- The SINGLE-7B LOCK and MAX_CONCURRENT_JOBS=1 are explicitly preserved and not relaxed.
- The CPU pressure floor (INV-06) is documented as the primary stalling constraint.
- git diff --check passes with zero whitespace violations.
- grep -rn '\-scar' across updated files returns zero hits.
- Independent reviewer agent verifies all V3.1.0 directive invariants (INV-06, INV-08, INV-09) are present and no existing invariants (INV-01 through INV-05) were removed.

Follow the SWE Light execution loop:
1. Maintain open-issues ledger in your progress.md and BRIEFING.md.
2. Dispatch teamwork_preview_implementer to apply / finalize changes.
3. Dispatch multiple teamwork_preview_reviewer rounds to verify all acceptance criteria and run verification commands.
4. Report completion back to parent when all acceptance criteria are verified.
