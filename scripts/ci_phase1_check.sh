#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# scripts/ci_phase1_check.sh — Phase 1 Canonical Runtime Boundary Invariant Check
#
# Verifies that all Phase 1 structural invariants hold without requiring a full
# test suite run. Can run in any environment with bash + python3.
#
# Exit codes:
#   0 — all invariants satisfied
#   1 — one or more invariants violated (details printed to stderr)
#
# Usage:
#   bash scripts/ci_phase1_check.sh
#   SWARM_ROOT=/path/to/repo bash scripts/ci_phase1_check.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -Eeuo pipefail

SCRIPT_ROOT="$(CDPATH= cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# A user-level SWARM_ROOT may point at a legacy checkout or be malformed by a
# shell profile. Use it only when it identifies a SwarmX repository; otherwise
# validate the repository that contains this script.
if [[ -n "${SWARM_ROOT:-}" && -d "${SWARM_ROOT}" && -f "${SWARM_ROOT}/swarm.sh" ]]; then
    ROOT="$(CDPATH= cd -- "${SWARM_ROOT}" && pwd -P)"
else
    ROOT="${SCRIPT_ROOT}"
fi

PASS=0
FAIL=0
ERRORS=()

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
header() { printf '\n\033[1m%s\033[0m\n' "$*"; }

ok()   { PASS=$((PASS + 1)); green "  [PASS] $*"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+=("$*"); red "  [FAIL] $*"; }
skip() { yellow "  [SKIP] $*"; }

# ── Check 1: Shell syntax validation ──────────────────────────────────────────
header "1. Shell Script Syntax (bash -n)"

for script in "${ROOT}"/swarm.sh "${ROOT}"/swarm-*.sh; do
    name="$(basename "$script")"
    if bash -n "$script" 2>/dev/null; then
        ok "${name}: valid bash syntax"
    else
        fail "${name}: bash syntax error"
    fi
done

# ── Check 2: All wrappers delegate to swarm.sh ────────────────────────────────
header "2. Wrapper Delegation Invariant"

declare -A EXPECTED_COMMANDS=(
    ["swarm-run.sh"]="run"
    ["swarm-evolve.sh"]="evolve"
    ["swarm-doctor.sh"]="doctor"
    ["swarm-status.sh"]="status"
    ["swarm-init.sh"]="init"
    ["swarm-plan.sh"]="plan"
    ["swarm-audit.sh"]="audit"
    ["swarm-skills.sh"]="skills"
    ["swarm-workflows.sh"]="workflows"
    ["swarm-models.sh"]="models"
    ["swarm-inspect.sh"]="inspect"
    ["swarm-dashboard.sh"]="dashboard"
    ["swarm-config.sh"]="config"
    ["swarm-frameworks.sh"]="frameworks"
)

for script_name in "${!EXPECTED_COMMANDS[@]}"; do
    script="${ROOT}/${script_name}"
    cmd="${EXPECTED_COMMANDS[$script_name]}"

    if [[ ! -f "$script" ]]; then
        fail "${script_name}: file not found"
        continue
    fi

    content="$(cat "$script")"

    # Must delegate to swarm.sh via bash
    if echo "$content" | grep -qF 'bash "$ROOT/swarm.sh"'; then
        ok "${script_name}: delegates to swarm.sh"
    else
        fail "${script_name}: does NOT contain 'bash \"\$ROOT/swarm.sh\"'"
    fi

    # Must NOT have direct -m swarmx or -m cli dispatch
    if echo "$content" | grep -qE -- '-m swarmx|-m cli'; then
        fail "${script_name}: contains legacy direct -m dispatch (should delegate to swarm.sh)"
    fi
done

# ── Check 3: swarm.sh selects cli before swarmx ────────────────────────────────
header "3. swarm.sh Module Selection Order"

swarm_sh="${ROOT}/swarm.sh"
if [[ ! -f "$swarm_sh" ]]; then
    fail "swarm.sh not found at ${swarm_sh}"
else
    content="$(cat "$swarm_sh")"

    # has_module cli must come before has_module swarmx
    cli_line=$(grep -n 'has_module cli' "$swarm_sh" | head -1 | cut -d: -f1)
    swarmx_line=$(grep -n 'has_module swarmx' "$swarm_sh" | head -1 | cut -d: -f1)

    if [[ -n "$cli_line" && -n "$swarmx_line" && "$cli_line" -lt "$swarmx_line" ]]; then
        ok "swarm.sh: 'cli' probed before 'swarmx' (lines ${cli_line} < ${swarmx_line})"
    else
        fail "swarm.sh: 'cli' must be probed before 'swarmx'"
    fi

    # Must have legacy fallback warning
    if echo "$content" | grep -qF 'Falling back to legacy module'; then
        ok "swarm.sh: legacy fallback warning present"
    else
        fail "swarm.sh: missing legacy fallback warning message"
    fi

    # Must use importlib for module detection (not just find_spec)
    if echo "$content" | grep -qF 'importlib.import_module'; then
        ok "swarm.sh: uses importlib.import_module for module detection"
    else
        fail "swarm.sh: must use importlib.import_module (not just find_spec)"
    fi
fi

# ── Check 4: CLI command shims registered ──────────────────────────────────────
header "4. CLI Command Shim Coverage"

EXPECTED_SHIMS=(doctor status init run evolve inspect audit dashboard mission plan skills workflows models config frameworks)

for cmd in "${EXPECTED_SHIMS[@]}"; do
    shim="${ROOT}/cli/commands/${cmd}.py"
    if [[ -f "$shim" ]]; then
        ok "cli/commands/${cmd}.py: exists"
    else
        fail "cli/commands/${cmd}.py: MISSING"
    fi
done

# Also verify cli/main.py registers each shim
main_py="${ROOT}/cli/main.py"
if [[ -f "$main_py" ]]; then
    for cmd in "${EXPECTED_SHIMS[@]}"; do
        if grep -qF "$cmd" "$main_py"; then
            ok "cli/main.py: registers '${cmd}'"
        else
            fail "cli/main.py: does NOT register '${cmd}'"
        fi
    done
else
    fail "cli/main.py not found"
fi

# ── Check 5: Python syntax validation ──────────────────────────────────────────
header "5. Python Compile Check"

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
    skip "python3 not found — skipping Python compile checks"
else
    PY_FILES=()

    # brain/ adapters
    while IFS= read -r -d '' f; do
        PY_FILES+=("$f")
    done < <(find "${ROOT}/brain" -name "*.py" -print0 2>/dev/null)

    # cli/commands/ shims
    while IFS= read -r -d '' f; do
        PY_FILES+=("$f")
    done < <(find "${ROOT}/cli" -name "*.py" -print0 2>/dev/null)

    for pyfile in "${PY_FILES[@]}"; do
        rel="${pyfile#"${ROOT}/"}"
        if "$PYTHON" -m py_compile "$pyfile" 2>/dev/null; then
            ok "${rel}: valid Python syntax"
        else
            fail "${rel}: Python syntax error"
        fi
    done
fi

# ── Check 6: Brain adapter deprecation warnings present ────────────────────────
header "6. Brain Adapter Deprecation Signals"

BRAIN_ADAPTERS=(orchestrator planner dispatcher router loop)
for mod in "${BRAIN_ADAPTERS[@]}"; do
    f="${ROOT}/brain/${mod}.py"
    if [[ ! -f "$f" ]]; then
        fail "brain/${mod}.py: not found"
        continue
    fi
    if grep -qF 'DeprecationWarning' "$f"; then
        ok "brain/${mod}.py: DeprecationWarning present"
    else
        fail "brain/${mod}.py: missing DeprecationWarning"
    fi
done

# ── Check 7: pytest regression tests (optional, runs if pytest available) ──────
header "7. Phase 1 Regression Tests (pytest)"

if "$PYTHON" -m pytest --version >/dev/null 2>&1; then
    PHASE1_TESTS=(
        "${ROOT}/tests/cli/test_phase1_launchers.py"
        "${ROOT}/tests/cli/test_phase1_command_shims.py"
        "${ROOT}/tests/brain/test_phase1_deprecation_warnings.py"
    )
    existing_tests=()
    for t in "${PHASE1_TESTS[@]}"; do
        [[ -f "$t" ]] && existing_tests+=("$t")
    done

    if [[ ${#existing_tests[@]} -gt 0 ]]; then
        if "$PYTHON" -m pytest "${existing_tests[@]}" -q --tb=short 2>&1; then
            ok "pytest: Phase 1 regression tests passed"
        else
            fail "pytest: Phase 1 regression tests FAILED"
        fi
    else
        skip "No Phase 1 test files found"
    fi
else
    skip "pytest not installed — install with: pip install pytest"
fi

# ── Check 8: Phase 2 config fields present in SwarmConfig ─────────────────────
header "8. Phase 2 Config — SwarmConfig Fields"

SWARMCONFIG="${ROOT}/src/swarmx/config.py"
if [[ ! -f "$SWARMCONFIG" ]]; then
    fail "src/swarmx/config.py not found"
else
    REQUIRED_FIELDS=(
        "ollama_url"
        "ollama_timeout_s"
        "tool_hard_timeout_s"
        "memory_ttl_seconds"
        "rag_top_k"
        "retain_recent_runs"
        "retain_recent_memories"
    )
    for field in "${REQUIRED_FIELDS[@]}"; do
        if grep -qF "$field" "$SWARMCONFIG"; then
            ok "SwarmConfig.${field}: defined"
        else
            fail "SwarmConfig.${field}: MISSING from src/swarmx/config.py"
        fi
    done
fi

# ── Check 9: brain/roles.py has canonical role delegation ─────────────────────
header "9. Phase 2 Config — brain/roles.py Canonical Role Delegation"

ROLES_PY="${ROOT}/brain/roles.py"
if [[ ! -f "$ROLES_PY" ]]; then
    fail "brain/roles.py not found"
else
    if grep -qF '_CANONICAL_ROLE_MAP' "$ROLES_PY"; then
        ok "brain/roles.py: canonical role delegation map present"
    else
        fail "brain/roles.py: missing _CANONICAL_ROLE_MAP"
    fi
    if grep -qF 'SWARM_MODEL_FAST' "$ROLES_PY"; then
        ok "brain/roles.py: SWARM_MODEL_FAST env-var delegation present"
    else
        fail "brain/roles.py: missing SWARM_MODEL_FAST env-var delegation"
    fi
fi

# ── Check 10: Phase 3 cancel endpoint present in workflows.ts ─────────────────
header "10. Phase 3 — Workflow Cancel Endpoint"

WORKFLOWS_TS="${ROOT}/apps/swarmx-api/src/routes/workflows.ts"
if [[ ! -f "$WORKFLOWS_TS" ]]; then
    fail "apps/swarmx-api/src/routes/workflows.ts not found"
else
    if grep -qF 'server.delete' "$WORKFLOWS_TS"; then
        ok "workflows.ts: DELETE cancel endpoint registered"
    else
        fail "workflows.ts: missing DELETE cancel endpoint"
    fi
    if grep -qF '"cancelled"' "$WORKFLOWS_TS"; then
        ok "workflows.ts: 'cancelled' status handled"
    else
        fail "workflows.ts: missing 'cancelled' status"
    fi
fi

# ── Check 11: Phase 4 legacy dashboard deprecation markers ─────────────────────
header "11. Phase 4 — Legacy Dashboard Retirement Markers"

LEGACY_HTML="${ROOT}/dashboard/index.html"
LEGACY_JS="${ROOT}/dashboard/app.js"
LEGACY_README="${ROOT}/docs/archive/dashboard-legacy/README.md"

for f_check in "$LEGACY_HTML:DEPRECATED" "$LEGACY_JS:DEPRECATED" "$LEGACY_README:DEPRECATED"; do
    f="${f_check%%:*}"
    marker="${f_check##*:}"
    fname="${f#"${ROOT}/"}"
    if [[ ! -f "$f" ]]; then
        skip "${fname}: file not found"
    elif grep -qi "$marker" "$f"; then
        ok "${fname}: deprecation marker present"
    else
        fail "${fname}: missing deprecation marker"
    fi
done

# ── Check 12: Phase 5 workflow event contracts ───────────────────────────────
header "12. Phase 5 — Workflow Event Contracts"

API_EVENTS_TS="${ROOT}/apps/swarmx-api/src/types/events.ts"
SHARED_TYPES_TS="${ROOT}/packages/swarmx-types/src/index.ts"

for contract_file in "$API_EVENTS_TS" "$SHARED_TYPES_TS"; do
    label="${contract_file#"${ROOT}/"}"
    if [[ ! -f "$contract_file" ]]; then
        fail "${label}: file not found"
        continue
    fi

    if grep -qF 'WorkflowEventData' "$contract_file"; then
        ok "${label}: WorkflowEventData contract present"
    else
        fail "${label}: missing WorkflowEventData contract"
    fi

    if grep -qF 'workflow:cancelled' "$contract_file"; then
        ok "${label}: workflow:cancelled event present"
    else
        fail "${label}: missing workflow:cancelled event"
    fi

    if grep -qF 'correlationId' "$contract_file"; then
        ok "${label}: correlationId field present"
    else
        fail "${label}: missing correlationId field"
    fi
done

# ── Check 13: Phase 5 dashboard workflow runtime surface ─────────────────────
header "13. Phase 5 — Dashboard Workflow Runtime Surface"

DASHBOARD_STORE="${ROOT}/apps/swarmx-dashboard/src/stores/events.ts"
DASHBOARD_WORKFLOWS="${ROOT}/apps/swarmx-dashboard/src/app/(dashboard)/workflows/page.tsx"

if [[ ! -f "$DASHBOARD_STORE" ]]; then
    fail "apps/swarmx-dashboard/src/stores/events.ts not found"
else
    if grep -qF 'workflowRuns' "$DASHBOARD_STORE"; then
        ok "events store: workflowRuns state present"
    else
        fail "events store: missing workflowRuns state"
    fi
    if grep -qF 'workflow:cancelled' "$DASHBOARD_STORE"; then
        ok "events store: workflow:cancelled handled"
    else
        fail "events store: missing workflow:cancelled handler"
    fi
fi

if [[ ! -f "$DASHBOARD_WORKFLOWS" ]]; then
    fail "apps/swarmx-dashboard/src/app/(dashboard)/workflows/page.tsx not found"
else
    if grep -qF 'Cancel' "$DASHBOARD_WORKFLOWS"; then
        ok "workflows page: cancel control present"
    else
        fail "workflows page: missing cancel control"
    fi
    if grep -qF 'correlationId' "$DASHBOARD_WORKFLOWS"; then
        ok "workflows page: correlation trace rendered"
    else
        fail "workflows page: missing correlation trace rendering"
    fi
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
    green "Phase 1 CI Check: ALL ${PASS} checks PASSED"
    echo "══════════════════════════════════════════════════════════"
    exit 0
else
    red "Phase 1 CI Check: ${FAIL} FAILED, ${PASS} passed"
    echo ""
    red "Failed invariants:"
    for e in "${ERRORS[@]}"; do
        red "  ✗ ${e}"
    done
    echo "══════════════════════════════════════════════════════════"
    exit 1
fi
