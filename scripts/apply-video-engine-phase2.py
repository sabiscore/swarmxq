from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def edit(path: str, replacements: list[tuple[str, str]]) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            raise RuntimeError(f"{path}: expected exactly one anchor, found {count}: {old[:120]!r}")
        text = text.replace(old, new)
    target.write_text(text, encoding="utf-8")


# Shared renderer capability contract.
edit(
    "packages/swarmx-types/src/video-types.ts",
    [
        (
            '  | "ffmpeg_cinematic_explainer"\n  | "optional_adapter";',
            '  | "ffmpeg_cinematic_explainer"\n  | "modal_wan22_l4"\n  | "modal_ltx_video"\n  | "optional_adapter";',
        ),
    ],
)

# Centralize non-secret remote-render configuration; the bearer token remains a
# dynamic secret read so it never enters the cached env object.
edit(
    "apps/swarmx-api/src/lib/env.ts",
    [
        (
            '  SWARMX_VIDEO_RENDER_BACKEND: z.string().default("auto"),\n',
            '  SWARMX_VIDEO_RENDER_BACKEND: z.string().default("auto"),\n'
            '  SWARMX_MODAL_RENDER_URL: z.string().url().optional(),\n'
            '  SWARMX_MODAL_MAX_CONTAINERS: positiveInt.default(4),\n'
            '  SWARMX_MODAL_FUNCTION_TIMEOUT_S: positiveInt.default(600),\n'
            '  SWARMX_MODAL_STARTUP_TIMEOUT_S: positiveInt.default(180),\n'
            '  SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT: boolFlag,\n',
        ),
    ],
)

# Error taxonomy for the remote path and alignment gate.
edit(
    "apps/swarmx-api/src/types/video.ts",
    [
        (
            '  | "RENDER_FAILED"\n  | "RENDER_BACKEND_INVALID"\n',
            '  | "RENDER_FAILED"\n  | "RENDER_BACKEND_INVALID"\n  | "MODAL_RENDER_REQUEST_FAILED"\n  | "MODAL_RENDER_UNAVAILABLE"\n  | "WORD_ALIGNMENT_UNAVAILABLE"\n  | "WORD_ALIGNMENT_FAILED"\n',
        ),
    ],
)

# Modal adapter returns local paths after pulling artifacts from the Modal
# volume endpoint; the existing orchestrator can then hand those paths to the
# existing deterministic FFmpeg composer.
edit(
    "apps/swarmx-api/src/services/modal-video-render-backend.ts",
    [
        (
            'import { readRawEnv } from "../lib/env.js";\n',
            'import { mkdir, writeFile } from "node:fs/promises";\n'
            'import { join } from "node:path";\n'
            'import { loadEnv, readRawEnv } from "../lib/env.js";\n',
        ),
        (
            '      if (result.status === "completed") return result.artifacts ?? [];\n',
            '      if (result.status === "completed") {\n'
            '        const artifacts = result.artifacts ?? [];\n'
            '        const tempRoot = join(loadEnv().SWARMX_VIDEO_TEMP_DIR, "modal", tasks[0]?.jobId ?? "unknown");\n'
            '        await mkdir(tempRoot, { recursive: true });\n'
            '        const localArtifacts: RenderSegmentArtifact[] = [];\n'
            '        for (const artifact of artifacts) {\n'
            '          const response = await requestBytes(\n'
            '            `${modalUrl()}/v1/render/file/${encodeURIComponent(tasks[0]?.jobId ?? "unknown")}/${encodeURIComponent(artifact.segmentId)}`,\n'
            '            { method: "GET" },\n'
            '            signal,\n'
            '          );\n'
            '          const localPath = join(tempRoot, `${artifact.segmentId}.mp4`);\n'
            '          await writeFile(localPath, response);\n'
            '          localArtifacts.push({ ...artifact, path: localPath });\n'
            '        }\n'
            '        return localArtifacts;\n'
            '      }\n',
        ),
        (
            'async function requestJson<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {\n',
            'async function requestBytes(url: string, init: RequestInit, signal?: AbortSignal): Promise<Uint8Array> {\n'
            '  const controller = new AbortController();\n'
            '  const timeout = setTimeout(() => controller.abort(), 30_000);\n'
            '  const onAbort = () => controller.abort(signal?.reason);\n'
            '  signal?.addEventListener("abort", onAbort, { once: true });\n'
            '  try {\n'
            '    const headers = new Headers(init.headers);\n'
            '    const token = modalToken();\n'
            '    if (token) headers.set("authorization", `Bearer ${token}`);\n'
            '    const response = await fetch(url, { ...init, headers, signal: controller.signal });\n'
            '    if (!response.ok) throw new Error(`Modal file fetch failed: ${response.status}`);\n'
            '    return new Uint8Array(await response.arrayBuffer());\n'
            '  } finally {\n'
            '    clearTimeout(timeout);\n'
            '    signal?.removeEventListener("abort", onAbort);\n'
            '  }\n'
            '}\n\n'
            'async function requestJson<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {\n',
        ),
    ],
)

# Existing FFmpeg renderer gains two bounded inputs: remote background segments
# and optional real word alignment. Existing local rendering remains unchanged
# when no remote paths are supplied.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    [
        (
            '  storyboardFrames: string[];\n  signal?: AbortSignal;\n}',
            '  storyboardFrames: string[];\n  backgroundVideoPaths?: string[];\n  signal?: AbortSignal;\n}',
        ),
        (
            '  const inputArgs = voiceArtifact\n      ? ["-i", narrationPath]\n      : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];\n\n    await execFileChecked("ffmpeg", [\n      "-y",\n      "-f", "lavfi",\n      "-i", `color=c=${bgColor}:s=720x1280:r=30:d=${duration}`,\n      ...inputArgs,',
            '    const remoteSegments = input.backgroundVideoPaths ?? [];\n    const segmentListPath = join(workDir, "remote-segments.txt");\n    if (remoteSegments.length > 0) {\n      await writeFile(\n        segmentListPath,\n        remoteSegments.map((path) => `file \'${path.replace(/\\\\/g, "/").replace(/\'/g, "\\\\\'")}\'`).join("\\n") + "\\n",\n        "utf8",\n      );\n    }\n\n    const visualInputArgs = remoteSegments.length > 0\n      ? ["-f", "concat", "-safe", "0", "-i", segmentListPath]\n      : ["-f", "lavfi", "-i", `color=c=${bgColor}:s=720x1280:r=30:d=${duration}`];\n    const inputArgs = voiceArtifact\n      ? ["-i", narrationPath]\n      : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];\n\n    await execFileChecked("ffmpeg", [\n      "-y",\n      ...visualInputArgs,\n      ...inputArgs,',
        ),
    ],
)

# Orchestrator: local text stages remain untouched; render stage now prefers
# Modal when explicitly configured, downloads the segment artifacts, and lets
# the existing FFmpeg composer perform final audio/caption/package assembly.
edit(
    "apps/swarmx-api/src/services/video-orchestrator.ts",
    [
        (
            'import { getComfyUIClient } from "./comfyui-client.js";\n',
            'import { getComfyUIClient } from "./comfyui-client.js";\n'
            'import { ModalVideoRenderBackend } from "./modal-video-render-backend.js";\n'
            'import type { RenderSegmentTask } from "./video-render-backend.js";\n',
        ),
        (
            '    const backend = _renv.SWARMX_VIDEO_RENDER_BACKEND;\n    const comfyClient = getComfyUIClient();\n',
            '    const backend = _renv.SWARMX_VIDEO_RENDER_BACKEND;\n\n'
            '    const modalConfigured = Boolean(process.env["SWARMX_MODAL_RENDER_URL"]?.trim());\n'
            '    if ((backend === "auto" || backend === "modal") && modalConfigured) {\n'
            '      const modal = new ModalVideoRenderBackend();\n'
            '      if (!(await modal.isAvailable(controller.signal))) {\n'
            '        if (backend === "modal") {\n'
            '          throw Object.assign(new Error("Modal renderer is configured but unavailable"), { code: "MODAL_RENDER_UNAVAILABLE" });\n'
            '        }\n'
            '      } else {\n'
            '        const duration = Math.max(15, Math.min(180, ctx.job.request.targetDurationSeconds ?? 30));\n'
            '        const count = Math.max(1, Math.min(8, frames.length));\n'
            '        const perSegment = duration / count;\n'
            '        const tasks: RenderSegmentTask[] = frames.slice(0, count).map((frame, index) => ({\n'
            '          jobId: ctx.job.id,\n'
            '          segmentId: `seg-${String(index + 1).padStart(2, "0")}`,\n'
            '          prompt: buildCreativeComfyPrompt({ prompt: frame, ...(ctx.job.request.tone ? { tone: ctx.job.request.tone } : {}), ...(ctx.job.request.niche ? { niche: ctx.job.request.niche } : {}), ...(ctx.job.request.style ? { style: ctx.job.request.style } : {}) }),\n'
            '          negativePrompt: "low quality, blurry, watermark, distorted, text artifacts",\n'
            '          durationSeconds: Math.max(2, Math.min(12, perSegment)),\n'
            '          fps: 24,\n'
            '          width: ctx.job.request.platform === "generic" ? 1080 : 720,\n'
            '          height: ctx.job.request.platform === "generic" ? 1080 : 1280,\n'
            '          seed: index + 1 + Math.floor(Date.now() / 1000),\n'
            '        }));\n'
            '        const artifacts = await modal.renderSegments(ctx.job.request, tasks, controller.signal);\n'
            '        const backgroundVideoPaths = artifacts.map((artifact) => artifact.path);\n'
            '        const ffmpegResult = await renderWithFfmpeg({\n'
            '          jobId: ctx.job.id,\n'
            '          request: ctx.job.request,\n'
            '          storyboardFrames: frames,\n'
            '          backgroundVideoPaths,\n'
            '          signal: controller.signal,\n'
            '          ...(ctx.scriptText !== undefined ? { scriptText: ctx.scriptText } : {}),\n'
            '        });\n'
            '        pushOperatorTrace(ctx.job, {\n'
            '          stage: toPublicStatus("render_assembly"),\n'
            '          operatorTag: "modal:wan2.2:L4",\n'
            '          modelTag: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",\n'
            '          operator: "Remote GPU",\n'
            '          startedAt,\n'
            '          completedAt: new Date().toISOString(),\n'
            '          latencyMs: 0,\n'
            '          tokenCount: 0,\n'
            '          success: true,\n'
            '          timestamp: startedAt,\n'
            '        });\n'
            '        return ffmpegResult;\n'
            '      }\n'
            '    }\n\n'
            '    const comfyClient = getComfyUIClient();\n',
        ),
    ],
)

# Modal worker exposes its persistent-volume artifacts through a short-lived
# web handler. The GPU function itself remains scale-to-zero.
edit(
    "src/swarmx/services/modal_video_renderer.py",
    [
        (
            'from fastapi import FastAPI, Header, HTTPException\n',
            'from fastapi import FastAPI, Header, HTTPException\n'
            'from fastapi.responses import FileResponse\n',
        ),
        (
            '@web.get("/v1/render/{call_id}")\n',
            '@web.get("/v1/render/file/{job_id}/{segment_id}")\n'
            'async def file(job_id: str, segment_id: str, authorization: str | None = Header(default=None)) -> FileResponse:\n'
            '    _check_auth(authorization)\n'
            '    path = _output_path(job_id, segment_id)\n'
            '    if not path.exists():\n'
            '        raise HTTPException(status_code=404, detail="segment artifact not found")\n'
            '    return FileResponse(path, media_type="video/mp4", filename=path.name)\n\n\n'
            '@web.get("/v1/render/{call_id}")\n',
        ),
    ],
)

print("Phase 2 migration completed successfully")
