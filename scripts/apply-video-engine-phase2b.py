from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:100]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")

replace(
    "apps/swarmx-api/src/services/renderer-certification.ts",
    '  ffmpeg_faceless_broll: "PUBLISHED_VERIFIED",\n  ffmpeg_cinematic_explainer: "PUBLISHED_VERIFIED",\n  optional_adapter: "PRODUCTION_PACK_VALID",\n',
    '  ffmpeg_faceless_broll: "PUBLISHED_VERIFIED",\n  ffmpeg_cinematic_explainer: "PUBLISHED_VERIFIED",\n  modal_wan22_l4: "READY_TO_POST",\n  modal_ltx_video: "READY_TO_POST",\n  optional_adapter: "PRODUCTION_PACK_VALID",\n',
)

replace(
    "apps/swarmx-api/src/services/template-aware-qc.ts",
    '  optional_adapter: {\n    // Optional adapters (ComfyUI etc.) get no template-specific rules.\n    // All findings pass through at raw severity.\n  },\n};\n',
    '  optional_adapter: {\n    // Optional adapters (ComfyUI etc.) get no template-specific rules.\n    // All findings pass through at raw severity.\n  },\n  modal_wan22_l4: {},\n  modal_ltx_video: {},\n};\n\nObject.assign(TIER_RULES.modal_wan22_l4!, TIER_RULES.ffmpeg_faceless_broll);\nObject.assign(TIER_RULES.modal_ltx_video!, TIER_RULES.ffmpeg_faceless_broll);\n',
)

replace(
    "apps/swarmx-api/src/services/video-orchestrator.ts",
    '    const modalConfigured = Boolean(process.env["SWARMX_MODAL_RENDER_URL"]?.trim());\n',
    '    const modalConfigured = Boolean(_renv.SWARMX_MODAL_RENDER_URL?.trim());\n',
)

replace(
    "apps/swarmx-api/src/services/video-orchestrator.ts",
    '          seed: index + 1 + Math.floor(Date.now() / 1000),\n',
    '          seed: index + 1 + Math.floor(Date.now() / 1000),\n',
)

replace(
    "pyproject.toml",
    'video = [\n  "faster-whisper>=1.1.0",\n  "modal>=1.5.0",\n]',
    'video = [\n  "faster-whisper>=1.1.0",\n  "modal>=1.5.0",\n  "pydantic>=2.9.0",\n]',
)

# Narrow TS/Python alignment boundary. Existing FFmpeg card captions remain
# untouched until word alignment is explicitly enabled for kinetic-text.
alignment_client = ROOT / "apps/swarmx-api/src/services/video-caption-alignment-client.ts"
alignment_client.write_text(
    '''import { execFile } from "node:child_process";\nimport { mkdir } from "node:fs/promises";\nimport { join } from "node:path";\nimport { loadEnv } from "../lib/env.js";\n\nexport interface CaptionAlignmentArtifacts {\n  assPath: string;\n  srtPath: string;\n  vttPath: string;\n  wordTimingPath: string;\n}\n\nfunction run(command: string, args: string[], timeoutMs: number): Promise<void> {\n  return new Promise((resolve, reject) => {\n    const child = execFile(command, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, _stdout, stderr) => {\n      if (error) {\n        reject(Object.assign(error, { stderr }));\n        return;\n      }\n      resolve();\n    });\n    child.on("error", reject);\n  });\n}\n\nexport async function alignNarrationAudio(jobId: string, audioPath: string): Promise<CaptionAlignmentArtifacts> {\n  const env = loadEnv();\n  const packageDir = join(env.SWARMX_VIDEO_ARTIFACT_DIR, jobId, "alignment");\n  await mkdir(packageDir, { recursive: true });\n  const paths = {\n    assPath: join(packageDir, "captions.ass"),\n    srtPath: join(packageDir, "captions.aligned.srt"),\n    vttPath: join(packageDir, "captions.aligned.vtt"),\n    wordTimingPath: join(packageDir, "word-timings.json"),\n  };\n  await run(env.SWARMX_PYTHON, [\n    "-m", "swarmx.services.video_caption_aligner", audioPath,\n    paths.assPath, paths.srtPath, paths.vttPath, paths.wordTimingPath,\n  ], Math.max(60_000, env.SWARMX_VIDEO_FFMPEG_TIMEOUT_MS));\n  return paths;\n}\n''',
    encoding="utf-8",
)

# CPU-safe alignment defaults. The service can be switched to CUDA explicitly.
replace(
    "src/swarmx/services/video_caption_aligner.py",
    'import argparse\nimport json\nimport re\n',
    'import argparse\nimport json\nimport os\nimport re\n',
)
replace(
    "src/swarmx/services/video_caption_aligner.py",
    '    model = WhisperModel(model_size, device="cuda", compute_type="float16")\n',
    '    device = os.getenv("SWARMX_WHISPER_DEVICE", "cpu")\n    compute_type = os.getenv("SWARMX_WHISPER_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")\n    model = WhisperModel(model_size, device=device, compute_type=compute_type)\n',
)

print("Phase 2b migration completed successfully")
