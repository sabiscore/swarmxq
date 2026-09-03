"""tests/test_startup.py — targeted regression tests for startup autopilot.

CHANGES V6.1:
  [ENH-01] Covers summary serialisation, persistence, and banner formatting.
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
from pathlib import Path

from swarmx.startup import (
    StartupSummary,
    _warmup_models,
    format_startup_banner,
    load_startup_summary,
    run_startup_autopilot,
)


class _FakeCfg:
    def __init__(self, home: Path) -> None:
        self.home = home
        self.ollama_url = "http://127.0.0.1:11434"
        self.model_fast = "phi4-fast"
        self.pressure_warn_mb = 1500
        self.pressure_critical_mb = 800
        self.pressure_check_interval_s = 5.0


def test_startup_summary_to_dict_uses_camel_case() -> None:
    summary = StartupSummary(
        timestamp="2026-05-05T00:00:00+00:00",
        status="ready",
        narrative="All set.",
        pressure_level="normal",
        available_mb=2048,
        zram_used_pct=0.25,
        concurrency_limit=2,
        ollama_reachable=True,
        warmup_done=True,
        evolver_synced=False,
        evolver_proposals=0,
        duration_ms=1234,
    )

    payload = summary.to_dict()

    assert payload["pressureLevel"] == "normal"
    assert payload["availableMb"] == 2048
    assert payload["ollamaReachable"] is True
    assert "pressure_level" not in payload


def test_run_startup_autopilot_persists_summary(monkeypatch, tmp_path: Path) -> None:
    cfg = _FakeCfg(tmp_path)

    monkeypatch.setattr("swarmx.startup._check_pressure", lambda _cfg: ("high", 1024, 0.6, 1))

    async def _fake_health(_cfg) -> bool:
        return True

    async def _fake_warmup(_cfg) -> bool:
        return False

    async def _fake_evolver(_cfg) -> tuple[bool, int]:
        return True, 2

    monkeypatch.setattr("swarmx.startup._check_health", _fake_health)
    monkeypatch.setattr("swarmx.startup._warmup_models", _fake_warmup)
    monkeypatch.setattr("swarmx.startup._sync_evolver", _fake_evolver)

    summary = asyncio.run(run_startup_autopilot(cfg))
    saved = load_startup_summary(tmp_path)
    saved_path = tmp_path / "state" / "startup_summary.json"

    assert summary.status == "ready"
    assert saved_path.exists()
    assert saved is not None
    assert saved["pressureLevel"] == "high"
    assert saved["warmupDone"] is False
    assert json.loads(saved_path.read_text(encoding="utf-8"))["evolverProposals"] == 2


def test_startup_model_warmup_is_opt_in(monkeypatch, tmp_path: Path) -> None:
    cfg = _FakeCfg(tmp_path)

    monkeypatch.delenv("SWARMX_MODEL_STARTUP_PREWARM", raising=False)

    assert asyncio.run(_warmup_models(cfg)) is False


def test_format_startup_banner_accepts_serialised_dict() -> None:
    banner = format_startup_banner(
        {
            "status": "degraded",
            "narrative": "Booted with caution.",
            "availableMb": 900,
            "zramUsedPct": 0.72,
            "concurrencyLimit": 1,
            "ollamaReachable": True,
            "warmupDone": False,
            "evolverSynced": True,
            "evolverProposals": 1,
            "durationMs": 850,
        }
    )

    assert "Booted with caution." in banner
    assert "900 MB free" in banner
    assert "Evolver staged" in banner


def test_startup_enhanced_clamps_constrained_ollama_env(tmp_path: Path) -> None:
    repo_root = Path(__file__).resolve().parents[1]
    startup_script = repo_root / "scripts" / "startup-enhanced.sh"
    startup_log = tmp_path / "startup-enhanced.log"

    env = os.environ.copy()
    env.update(
        {
            "OLLAMA_MAX_LOADED_MODELS": "2",
            "OLLAMA_KEEP_ALIVE": "3m",
            "SWARMX_HOST_PROFILE": "8gb",
            "SWARMX_START_OLLAMA_IF_DOWN": "0",
            "STARTUP_LOG": str(startup_log),
        }
    )

    result = subprocess.run(
        ["bash", str(startup_script), "--check-only"],
        cwd=repo_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )

    combined_output = f"{result.stdout}\n{result.stderr}"

    assert "Overriding OLLAMA_MAX_LOADED_MODELS=2 to 1" in combined_output
    assert "Overriding OLLAMA_KEEP_ALIVE=3m to 0" in combined_output
    assert "MAX_MODELS=1 KEEP_ALIVE=0" in combined_output


def test_startup_enhanced_keeps_16gb_single_inference_policy(tmp_path: Path) -> None:
    repo_root = Path(__file__).resolve().parents[1]
    startup_script = repo_root / "scripts" / "startup-enhanced.sh"
    startup_log = tmp_path / "startup-enhanced.log"

    env = os.environ.copy()
    env.update(
        {
            "OLLAMA_MAX_LOADED_MODELS": "1",
            "OLLAMA_NUM_PARALLEL": "2",
            "OLLAMA_KEEP_ALIVE": "3m",
            "SWARMX_HOST_PROFILE": "16gb",
            "SWARMX_START_OLLAMA_IF_DOWN": "0",
            "STARTUP_LOG": str(startup_log),
        }
    )

    result = subprocess.run(
        ["bash", str(startup_script), "--check-only"],
        cwd=repo_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )

    combined_output = f"{result.stdout}\n{result.stderr}"

    assert "Overriding OLLAMA_MAX_LOADED_MODELS=1 to 2" in combined_output
    assert "Overriding OLLAMA_NUM_PARALLEL=2 to 1" in combined_output
    assert "Overriding OLLAMA_KEEP_ALIVE=3m to 0" in combined_output
    assert "HOST_PROFILE=standard_cpu_16gb EFFECTIVE_PROFILE=standard_cpu_16gb" in combined_output
    assert "PARALLEL=1 MAX_MODELS=2 KEEP_ALIVE=0" in combined_output


def test_startup_script_owns_kokoro_lifecycle_and_standard_profile_gate() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    startup_source = (repo_root / "scripts" / "startup-enhanced.sh").read_text()

    assert "SWARMX_START_KOKORO_IF_DOWN" in startup_source
    assert "swarmx.services.kokoro_tts_server" in startup_source
    assert '"$KOKORO_URL/health"' in startup_source
    assert '"${SWARMX_EFFECTIVE_HOST_PROFILE:-}" == "standard_cpu_16gb"' in startup_source
    assert "minimum 6220 MB" in startup_source
