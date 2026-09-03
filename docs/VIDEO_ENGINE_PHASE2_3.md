# SwarmXQ Viral Video Engine — Phase 2/3

## Architecture

Stages 1–4 remain local and continue to use the existing `ModelOrchestrator`, SINGLE-7B lock, adaptive timeouts, reasoning sanitizer and local RAM pressure gating. Stage 5 can dispatch render segments to Modal when `SWARMX_MODAL_RENDER_URL` is configured; the resulting MP4 segments are returned to the API's existing FFmpeg composition/finalization path.

The local job execution lock remains `1` because the text-generation control plane is still CPU/RAM constrained. It does not represent a GPU-segment limit. Modal is bounded independently at four concurrent L4 render containers.

## Modal policy

- GPU: NVIDIA L4
- model: `Wan-AI/Wan2.2-TI2V-5B-Diffusers`
- `min_containers=0`
- `max_containers=4`
- retry policy: 3 retries, exponential 5s / 10s / 20s backoff
- execution timeout: 600s
- startup timeout: 180s
- fan-out: native `Function.map()`
- persistent intermediate storage: Modal Volume

Wan2.2 TI2V-5B is currently listed by Hugging Face under Apache-2.0. LTX-Video remains a separately governed renderer because its Open Weights License contains additional terms.

## Environment

Add the Modal web endpoint URL to the existing API environment surface:

```text
SWARMX_MODAL_RENDER_URL=https://<modal-endpoint>
SWARMX_MODAL_RENDER_TOKEN=<shared bearer token>
SWARMX_VIDEO_RENDER_BACKEND=auto
SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT=0
```

The API reads the token dynamically so it is not copied into the cached configuration object. Store the same secret in Modal using `modal.Secret`; never commit the token.

## Deploy the Modal worker

From an environment with the Modal CLI authenticated:

```bash
modal deploy src/swarmx/services/modal_video_renderer.py
```

The Modal worker uses the current SDK idioms: `Function.map()` for fan-out, `Function.spawn()` for the asynchronous job envelope, `FunctionCall.from_id()` for polling, function-level retry policy, explicit startup/execution timeouts, and a zero warm-container floor.

## Word-level captions

`src/swarmx/services/video_caption_aligner.py` is the new alignment boundary. It consumes the actual synthesized WAV, runs `faster-whisper` with `word_timestamps=True`, and emits word-derived ASS plus SRT/VTT sidecars.

The existing `caption-generator.ts` is not repurposed: it continues to generate social post copy/hashtags.

For a production host, install the optional Python video dependencies:

```bash
python -m pip install -e '.[video]'
```

## Certification behavior

The existing renderer certification and template-aware QC remain authoritative. A remote render does not bypass local artifact probes, FFmpeg assembly, metadata, or publication checks.

A Modal segment failure is terminal for the declared render attempt after the bounded retry budget. It must not silently fall back to a different production renderer after GPU work has begun. A manual resume may restart from `render_assembly`.

## Phase 2/3 verification

Run the normal repository gates plus the new focused check:

```bash
pnpm --filter @swarmx/api test:video:modal
pnpm --filter @swarmx/api typecheck
pnpm --filter @swarmx/api test
python -m ruff check src/swarmx/services/modal_video_renderer.py src/swarmx/services/video_caption_aligner.py src/swarmx/services/video_segment_contract.py
```

A live Modal render should only be attempted after the focused contract checks are green. It should use a short fixture (2–3 segments) first to establish cold-start, retry and artifact-transfer behavior before enabling full 5–8 segment production jobs.
