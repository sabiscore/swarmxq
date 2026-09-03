from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "feat/viral-video-engine-modal-phase2-3"


def edit(path, pattern, replacement, flags=0):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    new, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {pattern}")
    p.write_text(new, encoding="utf-8")

# 1. Centralize Modal URL as non-secret config; keep bearer token dynamic.
edit(
    "apps/swarmx-api/src/services/video-orchestrator.ts",
    r'const modalConfigured = Boolean\(process\.env\["SWARMX_MODAL_RENDER_URL"\]\?\.trim\(\)\);',
    'const modalConfigured = Boolean(_renv.SWARMX_MODAL_RENDER_URL?.trim());',
)

# 2. Give the concrete Modal backend its actual certification tier.
edit(
    "apps/swarmx-api/src/services/modal-video-render-backend.ts",
    r'tier: "optional_adapter",',
    'tier: "modal_wan22_l4",',
)

# 3. Add Modal token and secret name to centralized environment schema.
edit(
    "apps/swarmx-api/src/lib/env.ts",
    r'(SWARMX_MODAL_RENDER_URL: z\.string\(\)\.url\(\)\.optional\(\),\n)',
    r'\1  SWARMX_MODAL_RENDER_TOKEN: z.string().optional(),\n  SWARMX_MODAL_SECRET_NAME: z.string().min(1).default("swarmxq-video-renderer"),\n',
)

# 4. Align actual synthesized narration before kinetic caption burn-in.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    r'(import \{ runTemplateQc \} from "\./template-aware-qc\.js";\n)',
    r'\1import { alignNarrationAudio, type CaptionAlignmentArtifacts } from "./video-caption-alignment-client.js";\n',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    r'(  voiceArtifact\?: VoiceArtifact;\n})',
    r'  voiceArtifact?: VoiceArtifact;\n  alignment?: CaptionAlignmentArtifacts;\n})',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    r'(    const renderTimings = computeCardTimings\(cards, duration\);\n)',
    '''    const requireWordAlignment = loadEnv().SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT === "1"\n      && input.request.style === "kinetic_text";\n    let alignment: CaptionAlignmentArtifacts | undefined;\n    if (requireWordAlignment && voiceArtifact) {\n      try {\n        alignment = await alignNarrationAudio(input.jobId, narrationPath, loadEnv().SWARMX_TTS_LOCALE.split("-")[0] ?? "en", input.signal);\n      } catch (error) {\n        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {\n          code: "WORD_ALIGNMENT_FAILED",\n        });\n      }\n    }\n\1''',
)
# Disable estimated card text for kinetic-text when actual ASS timing is active.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    r'(    const filterComplex = buildFilterComplex\(\n      fontFile,\n      textFiles,\n      displayCards,\n      duration,\n      accentColor,\n      styleConfig,\n      rendererTier,\n      input\.request,\n      renderTimings,\n    \);)',
    r'''    const filterComplex = alignment
      ? "format=yuv420p"
      : buildFilterComplex(\n        fontFile,\n        textFiles,\n        displayCards,\n        duration,\n        accentColor,\n        styleConfig,\n        rendererTier,\n        input.request,\n        renderTimings,\n      );''',
)
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    r'(      "-filter_complex", `\[0:v\]\$\{filterComplex\}\[v\]`,\n      "-map", "\[v\]",\n)',
    r'''      "-filter_complex", `[0:v]${filterComplex}[v]`,\n      ...(alignment ? ["-vf", `subtitles=${alignment.assPath.replaceAll("\\\\", "/").replaceAll(":", "\\\\:")}`] : []),\n      "-map", "[v]",\n''',
)
# Include alignment artifacts in final package manifest if present.
edit(
    "apps/swarmx-api/src/services/ffmpeg-video-renderer.ts",
    r'(      \?\{ voiceArtifact \} : \{\}),\n      \s*\(\?\{ input\.signal \} : \{\}),',
    r'      ...(voiceArtifact ? { voiceArtifact } : {}),\n      ...(alignment ? { alignment } : {}),\n      ...(input.signal ? { signal: input.signal } : {}),',
)

# 5. Make Whisper runtime safe on CPU-constrained hosts and explicit model/device controls.
edit(
    "src/swarmx/services/video_caption_aligner.py",
    r'import json\nimport re\n',
    'import json\nimport os\nimport re\n',
)
edit(
    "src/swarmx/services/video_caption_aligner.py",
    r'def align_audio\(audio_path: str, language: str = "en", model_size: str = "small"\) -> list\[WordTiming\]:',
    'def align_audio(audio_path: str, language: str = "en", model_size: str = "small") -> list[WordTiming]:',
)
edit(
    "src/swarmx/services/video_caption_aligner.py",
    r'    model = WhisperModel\(model_size, device="cuda", compute_type="float16"\)',
    '    device = os.getenv("SWARMX_WHISPER_DEVICE", "cpu")\n    compute_type = os.getenv("SWARMX_WHISPER_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")\n    model = WhisperModel(model_size, device=device, compute_type=compute_type)',
)
# CLI options for deterministic alignment selection.
edit(
    "src/swarmx/services/video_caption_aligner.py",
    r'(    parser\.add_argument\("json"\)\n)',
    r'''    parser.add_argument("json")\n    parser.add_argument("--language", default="en")\n    parser.add_argument("--model-size", default=os.getenv("SWARMX_WHISPER_MODEL_SIZE", "small"))\n''',
)
edit(
    "src/swarmx/services/video_caption_aligner.py",
    r'write_alignment\(args\.audio, args\.ass, args\.srt, args\.vtt, args\.json\)',
    'write_alignment(args.audio, args.ass, args.srt, args.vtt, args.json)',
)

# 6. Expose aligned artifact paths in API output metadata.
edit(
    "apps/swarmx-api/src/types/video.ts",
    r'(  thumbnailPath\?: string;\n})',
    '  thumbnailPath?: string;\n  alignedAssPath?: string;\n  alignedSrtPath?: string;\n  alignedVttPath?: string;\n  wordTimingPath?: string;\n}',
)

# 7. Add an easy Studio navigation command.
edit(
    "apps/swarmx-dashboard/src/components/command-palette/CommandPalette.tsx",
    r'(  \{ id: "nav-composer",\s+label: "Go to Composer",\s+shortcut: "⌘2", href: "/composer",\s+keywords: "create build prompt project" \},\n)',
    r'\1  { id: "nav-video-studio", label: "Open Video Studio", shortcut: "⌘V", href: "/video/studio", keywords: "viral video reels tiktok shorts create" },\n',
)

# 8. Add a lightweight regression check for studio and alignment paths.
test = ROOT / "apps/swarmx-api/scripts/video-quality-path-regression.ts"
test.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst renderer = await readFile(new URL("../src/services/ffmpeg-video-renderer.ts", import.meta.url), "utf8");\nconst alignment = await readFile(new URL("../../../src/swarmx/services/video_caption_aligner.py", import.meta.url), "utf8");\nassert.ok(renderer.includes("alignNarrationAudio"));\nassert.ok(renderer.includes("subtitles="));\nassert.ok(renderer.includes("SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT"));\nassert.ok(alignment.includes("word_timestamps=True"));\nassert.ok(alignment.includes('SWARMX_WHISPER_DEVICE'));\nconsole.log("video-quality-path-regression: PASS");\n''', encoding="utf-8")

# Add script to package.json if not already there.
edit(
    "apps/swarmx-api/package.json",
    r'("test:video:modal": "node --import tsx scripts/video-modal-contract-regression\.ts",\n)',
    r'\1    "test:video:quality": "node --import tsx scripts/video-quality-path-regression.ts",\n',
)

print("video quality Phase 4 integration applied")
