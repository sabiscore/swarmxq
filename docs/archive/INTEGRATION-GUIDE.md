# Seamless Integration Guide
# Version: 2026.04 · IEP-ELITE-MAX · v2.0
# Zero-disruption deployment into your existing ecosystem.

---

## 1 · System Prompt

Replace your current system prompt with the contents of `SYSTEM-PROMPT.md`.

This is a **drop-in swap** — all existing behaviors are preserved. The Internal
Enhancement Engine runs silently. No new instructions visible to your users.
Immediate uplift from first use.

**What's new in APEX.15 vs prior versions:**
- Dual-axis Adversarial Self-Check (§4): Causal Chain Trace + Mutation Pressure.
- Blast-radius delta scoring in §6 Downstream Simulation.
- Island α/β/γ multi-island model with cross-island crossover signal (§8).
- Handoff Contract Validator now type-level AND range-level (§13).
- Multi-Island Tournament Signal: Fix Log patterns seed session bias (§16).
- Fix Log extended: CROSSOVER entries track inter-strategy hybridization.
- **Halt over hallucinate** added as explicit tie-breaker in Foundational Rules.

---

## 2 · Agent Files

Replace every `.md` file in your `agents/` directory:

```bash
cp agents/*.md your-project/agents/
cp agents/catalog.yaml your-project/agents/catalog.yaml
```

No agent mission, outputs, or authority boundaries changed. 100% backward-compatible.

---

## 3 · Skill Files

Replace every `.md` file in your `skills/` directory:

```bash
cp skills/*.md your-project/skills/
cp skills/catalog.yaml your-project/skills/catalog.yaml
```

Three core IEP-ELITE skills present in catalog:
- `handoff-contract.md` — validates stage-to-stage output contracts.
- `swarm-coherence-audit.md` — four-boundary check in one pass.
- `predictive-downstream-simulation.md` — 2–3 hop risk simulation with blast-radius delta.

---

## 4 · Templates

```bash
cp templates/*.md templates/*.yaml your-project/templates/
```

All six templates upgraded with IEP-ELITE APEX.15 execution contracts and quality gates.

---

## 5 · Configs

```bash
cp configs/*.yaml your-project/configs/
```

All three upgraded configs are backward-compatible. New keys are additive only.

---

## 6 · Dashboard

```bash
cp -R dashboard/ your-project/dashboard/
```

The primary dashboard (`dashboard/`) is the design-forward APEX.15 version:
- Syne / DM Mono / Instrument Serif type system.
- Ambient particle canvas — living node-edge graph of swarm activity.
- IEP-ELITE status bar: Signal Triage · Ensemble · Critic · Confidence · Quality Gate · Fix Log.
- Island tournament badges (α · β · γ) with winner highlighting.
- Exploration/Exploitation mode pill + PromptBreeder status.
- Vital stats (Agents · Runs · Proposals · Memories) with animated counters.
- Island fitness telemetry card with PromptBreeder win history.
- Keyboard shortcuts: R = refresh, E = evolve.
- Visibility API: pauses polling when tab is hidden.

The legacy dashboard is preserved in `docs/archive/dashboard-legacy/` for reference.

---

## 7 · Source (Python runtime)

```bash
cp -R src/ your-project/src/
```

`evaluator.py` — upgraded with multi-island tournament scoring:
- `score_island_candidate()` — scores against 5 IEP-ELITE axes with island-specific bias.
- `island_tournament()` — runs the full tournament; applies crossover when no island clears 0.80.

`evolver.py` — upgraded with multi-island scoring and PromptBreeder feedback:
- All proposals scored via `_score_multi_island()` with island winner recorded.
- `_record_island_result()` — updates PromptBreeder win/loss counters.
- `get_dominant_island()` — returns the island that reached the promotion threshold.
- Island convergence proposal added when 3+ consecutive same-island wins detected.

---

## 8 · Micro-Utilities (optional)

Copy `MICRO-UTILITIES.md` into your docs or agent reference folder.

Five utilities, all copy-paste inline checks — zero external dependencies:
- **μ-1** Stop-Condition Enforcer — includes Fix Log critical ceiling check.
- **μ-2** Output Contract Diff — type-level AND range-level validation.
- **μ-3** Confidence Calibration Check — includes "halt over hallucinate" rule.
- **μ-4** Island Bias Pulse — seeds island from prior Fix Log patterns (new in APEX.15).
- **μ-5** Fix Log Drain — blocks silent handoff of flawed artifacts.

---

## 9 · Gate Script (optional)

```bash
chmod +x swarm-gate.sh
./swarm-gate.sh --runtime .swarmx --gate all
```

Runs all five micro-utility checks against a live runtime directory. Exit codes:
- `0` — CLEAN (all gates passed)
- `1` — WARN (review flagged items)
- `2` — BLOCK (fix errors before handoff)

---

## 10 · Verification Checklist

After deployment, confirm:

```
□ SYSTEM-PROMPT.md is the active system prompt (version: v2.0)
□ All agent .md files present; catalog.yaml updated
□ All skill .md files present including: handoff-contract, swarm-coherence-audit,
    predictive-downstream-simulation
□ configs/ contains evolution.yaml, guardrails.yaml, swarmx.defaults.yaml
    with version: 2026.04-apex13
□ dashboard/ contains index.html, styles.css, app.js (Syne font variant)
□ src/swarmx/evaluator.py contains island_tournament()
□ src/swarmx/evolver.py contains _score_multi_island()
□ MICRO-UTILITIES.md contains μ-1 through μ-5
□ First test run: decisive, minimal, no visible complexity increase
□ ./swarm-gate.sh --gate all → Result: CLEAN
```

---

## 11 · Rollback (if needed)

All changes are additive. Re-deploy your original `.md` and `.yaml` files to roll back.
The upgrade introduces no new external dependencies, no persistent state, and no
infrastructure changes. Rollback is a file swap.

---

## 12 · What you should notice immediately

- Outputs that previously drifted in multi-agent runs maintain contract fidelity
  at every handoff.
- Agents that previously terminated speculatively now surface a clean stop condition.
- Skills that previously gave generic advice give structured, evidence-anchored results.
- Hallucination-prone paths are now hard-blocked before emission (halt over hallucinate).
- The system behaves as if an invisible council of specialists reviewed every output
  before it was emitted.

Zero visible complexity increase. Maximum intelligence density per token.
