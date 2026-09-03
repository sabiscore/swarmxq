from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def edit(path: str, replacements: list[tuple[str, str]]) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:100]!r}")
        text = text.replace(old, new)
    target.write_text(text, encoding="utf-8")


# Centralize the Modal URL read through the cached env object; only the token
# remains a dynamic raw secret.
edit(
    "apps/swarmx-api/src/services/video-orchestrator.ts",
    [
        (
            '    const modalConfigured = Boolean(process.env["SWARMX_MODAL_RENDER_URL"]?.trim());\n',
            '    const modalConfigured = Boolean(_renv.SWARMX_MODAL_RENDER_URL?.trim());\n',
        ),
        (
            '          width: ctx.job.request.platform === "generic" ? 1080 : 720,\n          height: ctx.job.request.platform === "generic" ? 1080 : 1280,\n',
            '          width: ctx.job.request.platform === "generic" ? 1080 : 720,\n          height: 1280,\n',
        ),
    ],
)

# Make the Python video dependency self-contained for the Pydantic contract mirror.
edit(
    "pyproject.toml",
    [
        (
            'video = [\n  "faster-whisper>=1.1.0",\n  "modal>=1.5.0",\n]',
            'video = [\n  "faster-whisper>=1.1.0",\n  "modal>=1.5.0",\n  "pydantic>=2.9.0",\n]',
        ),
    ],
)

# Add the alignment client as a narrow TS/Python boundary.
alignment_client = ROOT / "apps/swarmx-api/src/services/video-caption-alignment-client.ts"
alignment_client.write_text(
    '''import { execFile } from "node:child_process";\nimport { mkdir } from "node:fs/promises";\nimport { join } from "node:path";\nimport { loadEnv } from "../lib/env.js";\n\nexport interface CaptionAlignmentArtifacts {\n  assPath: string;\n  srtPath: string;\n  vttPath: string;\n  wordTimingPath: string;\n}\n\nfunction run(command: string, args: string[], timeoutMs: number): Promise<void> {\n  return new Promise((resolve, reject) => {\n    const child = execFile(command, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, _stdout, stderr) => {\n      if (error) {\n        reject(Object.assign(error, { stderr }));\n        return;\n      }\n      resolve();\n    });\n    child.on("error", reject);\n  });\n}\n\nexport async function alignNarrationAudio(\n  jobId: string,\n  audioPath: string,\n): Promise<CaptionAlignmentArtifacts> {\n  const env = loadEnv();\n  const packageDir = join(env.SWARMX_VIDEO_ARTIFACT_DIR, jobId, "alignment");\n  await mkdir(packageDir, { recursive: true });\n  const assPath = join(packageDir, "captions.ass");\n  const srtPath = join(packageDir, "captions.aligned.srt");\n  const vttPath = join(packageDir, "captions.aligned.vtt");\n  const wordTimingPath = join(packageDir, "word-timings.json");\n\n  await run(\n    env.SWARMX_PYTHON,\n    [\n      "-m",\n      "swarmx.services.video_caption_aligner",\n      audioPath,\n      assPath,\n      srtPath,\n      vttPath,\n      wordTimingPath,\n    ],\n    Math.max(60_000, env.SWARMX_VIDEO_FFMPEG_TIMEOUT_MS),\n  );\n\n  return { assPath, srtPath, vttPath, wordTimingPath };\n}\n''',
    encoding="utf-8",
)

# Add Python/TS integration to the FFmpeg renderer. Kinetic-text production uses
# ASS word timing in place of estimated drawtext windows; legacy styles retain
# their existing card renderer for visual compatibility.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    [
        (
            'import { KokoroVoiceProvider, normalizeScriptForSpeech, selectVoiceProvider, type SectionVoiceSynthesisSegment } from "./voice-providers.js";\n',
            'import { KokoroVoiceProvider, normalizeScriptForSpeech, selectVoiceProvider, type SectionVoiceSynthesisSegment } from "./voice-providers.js";\nimport { alignNarrationAudio, type CaptionAlignmentArtifacts } from "./video-caption-alignment-client.js";\n',
        ),
        (
            '  voiceLineagePath: string;\n  templateLineagePath: string;\n',
            '  voiceLineagePath: string;\n  templateLineagePath: string;\n  assPath?: string;\n  alignedSrtPath?: string;\n  alignedVttPath?: string;\n  wordTimingPath?: string;\n',
        ),
        (
            '  const thumbnailPath = join(packageDir, "thumbnail.jpg");\n',
            '  const thumbnailPath = join(packageDir, "thumbnail.jpg");\n  const assPath = inputAlignment?.assPath;\n',
        ),
    ],
)

# Inject alignment parameter into package writer and preserve aligned sidecars.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    [
        (
            '  voiceArtifact?: VoiceArtifact;\n  signal?: AbortSignal;\n}): Promise<FfmpegRenderPackage> {\n',
            '  voiceArtifact?: VoiceArtifact;\n  inputAlignment?: CaptionAlignmentArtifacts;\n  signal?: AbortSignal;\n}): Promise<FfmpegRenderPackage> {\n',
        ),
        (
            '  const assPath = inputAlignment?.assPath;\n  let voiceArtifact = input.voiceArtifact;\n',
            '  let voiceArtifact = input.voiceArtifact;\n',
        ),
        (
            '  if (voiceArtifact) {\n    await copyFile(voiceArtifact.outputPath, packagedVoicePath);\n    voiceArtifact = { ...voiceArtifact, outputPath: packagedVoicePath };\n  }\n\n',
            '  if (voiceArtifact) {\n    await copyFile(voiceArtifact.outputPath, packagedVoicePath);\n    voiceArtifact = { ...voiceArtifact, outputPath: packagedVoicePath };\n  }\n  if (inputAlignment) {\n    await copyFile(inputAlignment.assPath, join(packageDir, "captions.ass"));\n    await copyFile(inputAlignment.srtPath, join(packageDir, "captions.aligned.srt"));\n    await copyFile(inputAlignment.vttPath, join(packageDir, "captions.aligned.vtt"));\n    await copyFile(inputAlignment.wordTimingPath, join(packageDir, "word-timings.json"));\n  }\n\n',
        ),
        (
            '    templateLineagePath,\n    mediaQualityReport,\n',
            '    templateLineagePath,\n    ...(inputAlignment ? {\n      assPath: join(packageDir, "captions.ass"),\n      alignedSrtPath: join(packageDir, "captions.aligned.srt"),\n      alignedVttPath: join(packageDir, "captions.aligned.vtt"),\n      wordTimingPath: join(packageDir, "word-timings.json"),\n    } : {}),\n    mediaQualityReport,\n',
        ),
    ],
)

# The exact renderer function needs to create alignment after narration exists.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    [
        (
            '    const renderTimings = computeCardTimings(cards, duration);\n    const filterComplex = buildFilterComplex(\n',
            '    const useWordAlignment = Boolean(voiceArtifact) &&\n      (input.request.style === "kinetic_text" || input.request.tone === "kinetic_text") &&\n      loadEnv().SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT === "1";\n    let alignment: CaptionAlignmentArtifacts | undefined;\n    if (useWordAlignment) {\n      try {\n        alignment = await alignNarrationAudio(input.jobId, narrationPath);\n      } catch (error) {\n        throw Object.assign(\n          error instanceof Error ? error : new Error(String(error)),\n          { code: "WORD_ALIGNMENT_FAILED" },\n        );\n      }\n    }\n\n    const renderTimings = computeCardTimings(cards, duration);\n    const filterComplex = buildFilterComplex(\n',
        ),
        (
            '    await execFileChecked("ffmpeg", [\n      "-y",\n      ...visualInputArgs,\n      ...inputArgs,\n      "-filter_complex", `[0:v]${filterComplex}[v]`,\n',
            '    const resolvedFilterComplex = alignment\n      ? "format=yuv420p"\n      : filterComplex;\n    const subtitleArgs = alignment\n      ? ["-vf", `subtitles=${alignment.assPath.replaceAll("\\\\", "/").replaceAll(":", "\\\\:")}`]\n      : [];\n\n    await execFileChecked("ffmpeg", [\n      "-y",\n      ...visualInputArgs,\n      ...inputArgs,\n      "-filter_complex", `[0:v]${resolvedFilterComplex}[v]`,\n',
        ),
        (
            '      "-map", "[v]",\n      "-map", "1:a",\n',
            '      "-map", "[v]",\n      ...subtitleArgs,\n      "-map", "1:a",\n',
        ),
        (
            '      ...(voiceArtifact ? { voiceArtifact } : {}),\n      ...(input.signal ? { signal: input.signal } : {}),\n    });\n',
            '      ...(voiceArtifact ? { voiceArtifact } : {}),\n      ...(alignment ? { inputAlignment: alignment } : {}),\n      ...(input.signal ? { signal: input.signal } : {}),\n    });\n',
        ),
    ],
)

# Fix the cancellation URL to use the same actual Modal job id contract.
edit(
    "apps/swarmx-api/src/services/modal-video-render-backend.ts",
    [
        (
            '  async cancel(jobId: string): Promise<void> {\n    try {\n      await requestJson(`${modalUrl()}/v1/render/job/${encodeURIComponent(jobId)}`, {\n        method: "DELETE",\n      });\n',
            '  async cancel(jobId: string): Promise<void> {\n    try {\n      await requestJson(`${modalUrl()}/v1/render/job/${encodeURIComponent(jobId)}`, {\n        method: "DELETE",\n      });\n',
        ),
    ],
)

print("Phase 2b migration completed successfully")
