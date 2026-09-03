from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def edit(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")

# Central configuration: non-secret endpoint is cached; token remains an explicit secret escape hatch.
edit(
    "apps/swarmx-api/src/services/video-orchestrator.ts",
    'const modalConfigured = Boolean(process.env["SWARMX_MODAL_RENDER_URL"]?.trim());',
    'const modalConfigured = Boolean(_renv.SWARMX_MODAL_RENDER_URL?.trim());',
)
edit(
    "apps/swarmx-api/src/services/modal-video-render-backend.ts",
    '    tier: "optional_adapter",',
    '    tier: "modal_wan22_l4",',
)
edit(
    "apps/swarmx-api/src/lib/env.ts",
    '  SWARMX_MODAL_RENDER_URL: z.string().url().optional(),\n',
    '  SWARMX_MODAL_RENDER_URL: z.string().url().optional(),\n  SWARMX_MODAL_RENDER_TOKEN: z.string().optional(),\n  SWARMX_MODAL_SECRET_NAME: z.string().min(1).default("swarmxq-video-renderer"),\n',
)

# Add alignment client import and carry alignment metadata through the package result.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    'import { runTemplateQc } from "./template-aware-qc.js";\n',
    'import { runTemplateQc } from "./template-aware-qc.js";\nimport { alignNarrationAudio, type CaptionAlignmentArtifacts } from "./video-caption-alignment-client.js";\n',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    '  voiceArtifact?: VoiceArtifact;\n}\n',
    '  voiceArtifact?: VoiceArtifact;\n  alignment?: CaptionAlignmentArtifacts;\n}\n',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    '    const renderTimings = computeCardTimings(cards, duration);\n',
    '''    const requireWordAlignment = loadEnv().SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT === "1" && input.request.style === "kinetic_text";\n    let alignment: CaptionAlignmentArtifacts | undefined;\n    if (requireWordAlignment && voiceArtifact) {\n      try {\n        alignment = await alignNarrationAudio(\n          input.jobId,\n          narrationPath,\n          loadEnv().SWARMX_TTS_LOCALE.split("-")[0] ?? "en",\n          input.signal,\n        );\n      } catch (error) {\n        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {\n          code: "WORD_ALIGNMENT_FAILED",\n        });\n      }\n    }\n\n    const renderTimings = computeCardTimings(cards, duration);\n''',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    '''    const filterComplex = buildFilterComplex(\n      fontFile,\n      textFiles,\n      displayCards,\n      duration,\n      accentColor,\n      styleConfig,\n      rendererTier,\n      input.request,\n      renderTimings,\n    );\n''',
    '''    const filterComplex = alignment\n      ? "format=yuv420p"\n      : buildFilterComplex(\n        fontFile,\n        textFiles,\n        displayCards,\n        duration,\n        accentColor,\n        styleConfig,\n        rendererTier,\n        input.request,\n        renderTimings,\n      );\n''',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    '''      "-filter_complex", `[0:v]${filterComplex}[v]`,\n      "-map", "[v]",\n''',
    '''      "-filter_complex", `[0:v]${filterComplex}[v]`,\n      ...(alignment ? ["-vf", `subtitles=${alignment.assPath.replaceAll("\\\\", "/").replaceAll(":", "\\\\:")}`] : []),\n      "-map", "[v]",\n''',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    '      ...(voiceArtifact ? { voiceArtifact } : {}),\n      ...(input.signal ? { signal: input.signal } : {}),\n',
    '      ...(voiceArtifact ? { voiceArtifact } : {}),\n      ...(alignment ? { alignment } : {}),\n      ...(input.signal ? { signal: input.signal } : {}),\n',
)

# CPU-safe faster-whisper defaults for this repo; GPU can still be enabled via environment.
edit(
    "src/swarmx/services/video_caption_aligner.py",
    'import json\nimport re\n',
    'import json\nimport os\nimport re\n',
)
edit(
    "src/swarmx/services/video_caption_aligner.py",
    '    model = WhisperModel(model_size, device="cuda", compute_type="float16")\n',
    '    device = os.getenv("SWARMX_WHISPER_DEVICE", "cpu")\n    compute_type = os.getenv("SWARMX_WHISPER_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")\n    model = WhisperModel(model_size, device=device, compute_type=compute_type)\n',
)
edit(
    "src/swarmx/services/video_caption_aligner.py",
    '    parser.add_argument("json")\n',
    '    parser.add_argument("json")\n    parser.add_argument("--language", default="en")\n',
)

# Expose aligned assets to downstream consumers.
edit(
    "apps/swarmx-api/src/types/video.ts",
    '  thumbnailPath?: string;\n}\n',
    '  thumbnailPath?: string;\n  alignedAssPath?: string;\n  alignedSrtPath?: string;\n  alignedVttPath?: string;\n  wordTimingPath?: string;\n}\n',
)

# Consumer-facing entry point: make Video Studio discoverable from the command palette.
edit(
    "apps/swarmx-dashboard/src/components/command-palette/CommandPalette.tsx",
    '  { id: "nav-composer",   label: "Go to Composer",     shortcut: "⌘2", href: "/composer",  keywords: "create build prompt project" },\n',
    '  { id: "nav-composer",   label: "Go to Composer",     shortcut: "⌘2", href: "/composer",  keywords: "create build prompt project" },\n  { id: "nav-video-studio", label: "Open Video Studio", shortcut: "⌘V", href: "/video/studio", keywords: "viral video reels tiktok shorts create" },\n',
)

# Focused regression test for the new quality path.
test_path = ROOT / "apps/swarmx-api/scripts/video-quality-path-regression.ts"
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst renderer = await readFile(new URL("../src/services/ffmpeg-video-renderer.ts", import.meta.url), "utf8");\nconst alignment = await readFile(new URL("../../../src/swarmx/services/video_caption_aligner.py", import.meta.url), "utf8");\nconst studio = await readFile(new URL("../../swarmx-dashboard/src/app/(dashboard)/video/studio/page.tsx", import.meta.url), "utf8");\nassert.ok(renderer.includes("alignNarrationAudio"));\nassert.ok(renderer.includes("SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT"));\nassert.ok(renderer.includes("subtitles="));\nassert.ok(alignment.includes("word_timestamps=True"));\nassert.ok(alignment.includes("SWARMX_WHISPER_DEVICE"));\nassert.ok(studio.includes("/api/video/jobs"));\nconsole.log("video-quality-path-regression: PASS");\n''', encoding="utf-8")
edit(
    "apps/swarmx-api/package.json",
    '    "test:video:modal": "node --import tsx scripts/video-modal-contract-regression.ts",\n',
    '    "test:video:modal": "node --import tsx scripts/video-modal-contract-regression.ts",\n    "test:video:quality": "node --import tsx scripts/video-quality-path-regression.ts",\n',
)

# The model mirror is intentionally kept as generated-ish optional dependency metadata.
edit(
    "pyproject.toml",
    'video = [\n  "faster-whisper>=1.1.0",\n  "modal>=1.5.0",\n]',
    'video = [\n  "faster-whisper>=1.1.0",\n  "modal>=1.5.0",\n  "pydantic>=2.9.0",\n]',
)

print("video quality Phase 4 integration applied")
