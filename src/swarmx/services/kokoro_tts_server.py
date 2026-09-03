"""
SwarmXQ Kokoro TTS Microservice
================================
Version: V1.0.0 · 2026.07 · APEX-17 r8
Hardware target: HP EliteBook 850 G3 · 16 GB RAM · CPU-only · WSL2

Free, locally-runnable TTS using Kokoro-82M (Apache 2.0).
Replaces espeak-ng as the primary voice engine with MOS ~4.1 quality.

Prerequisites:
  sudo apt-get install espeak-ng   # required by Kokoro phonemizer
  pip install kokoro soundfile fastapi uvicorn

Start:
  python -m swarmx.services.kokoro_tts_server --port 8888

API:
  POST /tts
  Body: {"text": "...", "voice": "am_michael", "speed": 1.0}
  Returns: {"wav_b64": "...", "duration_ms": 4200, "engine": "kokoro"}

  GET /voices
  Returns: list of available voice IDs

  GET /health
  Returns: {"status": "ok", "engine": "kokoro", "version": "82m"}

Integration with ffmpeg-video-renderer.ts:
  Set SWARMX_TTS_URL=http://localhost:8888 in env.
  The renderer will POST to /tts and use the returned wav_b64.
"""

from __future__ import annotations

import argparse
import base64
import io
import sys
import time
from pathlib import Path
from typing import TYPE_CHECKING

_SRC_DIR = str(Path(__file__).resolve().parent.parent.parent)
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from kokoro import KPipeline

# ── Logging ───────────────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger("swarmx.kokoro_tts")

try:
    import soundfile as sf
    SOUNDFILE_AVAILABLE = True
except ImportError:
    sf = None  # type: ignore[assignment]
    SOUNDFILE_AVAILABLE = False
    log.warning("soundfile_unavailable", hint="pip install soundfile")

# ── Kokoro availability check ─────────────────────────────────────────────────
try:
    from kokoro import KPipeline  # type: ignore
    KOKORO_AVAILABLE = True
    log.info("kokoro_available", version="82m")
except ImportError:
    KOKORO_AVAILABLE = False
    log.warning(
        "kokoro_unavailable",
        hint="pip install kokoro soundfile",
        fallback="espeak-ng",
    )

# ── Voice registry ────────────────────────────────────────────────────────────
# Maps tone variant → Kokoro voice ID
# These are the voices confirmed to be available in kokoro-82m.
TONE_VOICE_MAP: dict[str, str] = {
    "warm":          "af_sarah",    # American female, warm, approachable
    "narrator":      "am_michael",  # American male, authoritative, clear
    "educational":   "bm_george",   # British male, crisp, measured
    "cinematic":     "bm_lewis",    # British male, deep, dramatic
    "urgent":        "am_adam",     # American male, punchy, direct
    "contrarian":    "af_nicole",   # American female, confident, assertive
    "faceless_broll":"am_michael",  # Calm background narration
    "default":       "am_michael",
}

# Speed multipliers per tone (relative to 1.0 baseline)
TONE_SPEED_MAP: dict[str, float] = {
    "warm":          0.95,
    "narrator":      1.00,
    "educational":   0.92,
    "cinematic":     0.90,
    "urgent":        1.10,
    "contrarian":    1.02,
    "faceless_broll":1.00,
    "default":       1.00,
}

AVAILABLE_VOICES = list(set(TONE_VOICE_MAP.values()))

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="SwarmXQ Kokoro TTS",
    description="High-quality local TTS microservice for the SwarmXQ video pipeline.",
    version="1.0.0",
)

# Lazy-loaded pipeline (avoids 400 MB memory cost on health-check-only hosts)
_pipeline: KPipeline | None = None


def get_pipeline() -> KPipeline:
    global _pipeline
    if _pipeline is None:
        if not KOKORO_AVAILABLE:
            raise RuntimeError("Kokoro not installed. Run: pip install kokoro soundfile")
        log.info("kokoro_pipeline_init")
        _pipeline = KPipeline(lang_code="a")  # 'a' = American English
        log.info("kokoro_pipeline_ready")
    return _pipeline


# ── Request/response models ───────────────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str = Field(..., description="Narration text to synthesize")
    voice: str = Field("am_michael", description="Kokoro voice ID or tone name")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="Speed multiplier (0.5–2.0)")
    split_pattern: str = Field(r"\n+", description="Pattern to split text into segments")


class TTSResponse(BaseModel):
    wav_b64: str = Field(..., description="Base64-encoded WAV audio")
    duration_ms: int = Field(..., description="Audio duration in milliseconds")
    engine: str = Field("kokoro", description="TTS engine used")
    voice: str = Field(..., description="Voice ID actually used")
    sample_rate: int = Field(24000, description="Sample rate of the output WAV")


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engine": "kokoro" if KOKORO_AVAILABLE and SOUNDFILE_AVAILABLE else "unavailable",
        "version": "82m",
        "voices": AVAILABLE_VOICES,
        "hardware": "cpu-only",
        "dependencies": {
            "kokoro": KOKORO_AVAILABLE,
            "soundfile": SOUNDFILE_AVAILABLE,
        },
    }


@app.get("/voices")
async def voices():
    return {"voices": AVAILABLE_VOICES, "tone_map": TONE_VOICE_MAP}


@app.post("/tts", response_model=TTSResponse)
async def synthesize(req: TTSRequest):
    t0 = time.perf_counter()

    if not KOKORO_AVAILABLE or not SOUNDFILE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Kokoro TTS dependencies are not installed. Install with: pip install kokoro soundfile",
        )

    # Resolve voice ID — accept either a voice ID directly or a tone name
    voice_id = TONE_VOICE_MAP.get(req.voice, req.voice)
    # Apply tone-aware speed if caller didn't explicitly set a non-default speed
    effective_speed = (
        req.speed if req.speed != 1.0
        else TONE_SPEED_MAP.get(req.voice, 1.0)
    )

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text field must not be empty")

    try:
        pipeline = get_pipeline()
        segments: list[bytes] = []
        sample_rate = 24000

        log.info(
            "tts_start",
            voice=voice_id,
            speed=effective_speed,
            text_len=len(req.text),
        )

        # Generate audio segments
        for _gs, _ps, audio in pipeline(
            req.text,
            voice=voice_id,
            speed=effective_speed,
            split_pattern=req.split_pattern,
        ):
            # Convert numpy array to WAV bytes
            buf = io.BytesIO()
            sf.write(buf, audio, sample_rate, format="WAV")  # type: ignore[union-attr]
            segments.append(buf.getvalue())

        if not segments:
            raise ValueError("Kokoro produced no audio segments")

        # Concatenate segments into a single WAV
        # Re-read all segment buffers as numpy arrays and concatenate
        import numpy as np  # type: ignore

        arrays = []
        for seg_bytes in segments:
            buf = io.BytesIO(seg_bytes)
            data, _ = sf.read(buf, dtype="float32")  # type: ignore[union-attr]
            arrays.append(data)

        combined = np.concatenate(arrays)
        out_buf = io.BytesIO()
        sf.write(out_buf, combined, sample_rate, format="WAV")  # type: ignore[union-attr]
        wav_bytes = out_buf.getvalue()

        duration_ms = int(len(combined) / sample_rate * 1000)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        log.info(
            "tts_complete",
            voice=voice_id,
            duration_ms=duration_ms,
            elapsed_ms=elapsed_ms,
            rtf=f"{duration_ms / max(elapsed_ms, 1):.2f}x",
        )

        return TTSResponse(
            wav_b64=base64.b64encode(wav_bytes).decode(),
            duration_ms=duration_ms,
            engine="kokoro",
            voice=voice_id,
            sample_rate=sample_rate,
        )

    except Exception as exc:
        log.error("tts_error", error=str(exc), voice=voice_id)
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc


# ── CLI entrypoint ────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="SwarmXQ Kokoro TTS microservice")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8888, help="Bind port (default: 8888)")
    parser.add_argument("--workers", type=int, default=1, help="Worker count (CPU-only: 1)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (dev mode)")
    args = parser.parse_args()

    if not KOKORO_AVAILABLE or not SOUNDFILE_AVAILABLE:
        log.error(
            "kokoro_start_blocked",
            reason="Kokoro TTS dependencies are not installed",
            install="pip install kokoro soundfile",
            retry="python -m swarmx.services.kokoro_tts_server",
        )
        raise SystemExit(1)

    log.info(
        "kokoro_server_start",
        url=f"http://{args.host}:{args.port}",
        engine="kokoro-82m",
        workers=args.workers,
        hardware="cpu-only",
        voices=AVAILABLE_VOICES,
    )

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
