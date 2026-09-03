from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

import modal
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse

APP_NAME = os.getenv("SWARMX_MODAL_APP", "swarmxq-video-renderer")
VOLUME_NAME = os.getenv("SWARMX_MODAL_VOLUME", "swarmxq-video-artifacts")
MODEL_ID = os.getenv("SWARMX_VIDEO_MODEL_ID", "Wan-AI/Wan2.2-TI2V-5B-Diffusers")
SECRET_NAME = os.getenv("SWARMX_MODAL_SECRET_NAME", "swarmxq-video-renderer")
OUTPUT_ROOT = Path("/outputs")

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
modal_secret = modal.Secret.from_name(SECRET_NAME)

render_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "diffusers>=0.35.0",
        "transformers>=4.53.0",
        "accelerate>=1.8.0",
        "safetensors>=0.5.3",
        "imageio>=2.37.0",
        "imageio-ffmpeg>=0.6.0",
        "fastapi>=0.115.0",
    )
)


def _output_path(job_id: str, segment_id: str) -> Path:
    safe_job = "".join(c for c in job_id if c.isalnum() or c in "-_")
    safe_segment = "".join(c for c in segment_id if c.isalnum() or c in "-_")
    path = OUTPUT_ROOT / safe_job / f"{safe_segment}.mp4"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@app.function(
    image=render_image,
    gpu="L4",
    volumes={"/outputs": volume},
    secrets=[modal_secret],
    min_containers=0,
    max_containers=4,
    timeout=600,
    startup_timeout=180,
    retries=modal.Retries(max_retries=3, initial_delay=5.0, backoff_coefficient=2.0),
)
def render_one(task: dict[str, Any]) -> dict[str, Any]:
    import torch
    from diffusers import WanPipeline
    from diffusers.utils import export_to_video

    device = "cuda"
    dtype = torch.bfloat16
    pipe = WanPipeline.from_pretrained(MODEL_ID, torch_dtype=dtype)
    pipe.to(device)

    frames = max(8, int(round(float(task["durationSeconds"]) * int(task["fps"]))))
    result = pipe(
        prompt=str(task["prompt"]),
        negative_prompt=str(task.get("negativePrompt") or "low quality, blurry, watermark, distorted"),
        height=int(task["height"]),
        width=int(task["width"]),
        num_frames=frames,
        guidance_scale=5.0,
        num_inference_steps=int(task.get("steps", 28)),
        generator=torch.Generator(device=device).manual_seed(int(task["seed"])),
    )

    output = _output_path(str(task["jobId"]), str(task["segmentId"]))
    export_to_video(result.frames[0], str(output), fps=int(task["fps"]))
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    volume.commit()
    return {
        "segmentId": task["segmentId"],
        "path": str(output),
        "durationSeconds": float(task["durationSeconds"]),
        "width": int(task["width"]),
        "height": int(task["height"]),
        "fps": int(task["fps"]),
        "checksum": digest,
    }


@app.function(
    image=render_image,
    volumes={"/outputs": volume},
    secrets=[modal_secret],
    min_containers=0,
    max_containers=1,
    timeout=900,
    startup_timeout=60,
    retries=modal.Retries(max_retries=1, initial_delay=2.0, backoff_coefficient=2.0),
)
def render_segments(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Native Modal fan-out. Do not replace this with sequential .remote() calls.
    return list(render_one.map(tasks))


web = FastAPI(title="SwarmXQ Modal Video Renderer")


def _check_auth(authorization: str | None) -> None:
    expected = os.getenv("SWARMX_MODAL_RENDER_TOKEN", "").strip()
    if expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="invalid renderer token")


@web.get("/health")
async def health(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _check_auth(authorization)
    return {
        "ok": True,
        "app": APP_NAME,
        "model": MODEL_ID,
        "gpu": "L4",
        "min_containers": 0,
        "max_containers": 4,
    }


@web.post("/v1/render")
async def submit(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, str]:
    _check_auth(authorization)
    tasks = payload.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        raise HTTPException(status_code=422, detail="tasks must be a non-empty list")
    if len(tasks) > 8:
        raise HTTPException(status_code=422, detail="too many segment tasks")
    call = render_segments.spawn(tasks)
    return {"call_id": call.object_id}


@web.get("/v1/render/file/{job_id}/{segment_id}")
async def file(job_id: str, segment_id: str, authorization: str | None = Header(default=None)) -> FileResponse:
    _check_auth(authorization)
    path = _output_path(job_id, segment_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="segment artifact not found")
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@app.function(
    image=render_image,
    volumes={"/outputs": volume},
    secrets=[modal_secret],
    min_containers=0,
    max_containers=1,
    timeout=120,
)
@modal.asgi_app()
def fastapi_app() -> FastAPI:
    return web
