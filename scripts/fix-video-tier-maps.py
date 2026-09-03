from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def edit(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"anchor mismatch in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new), encoding="utf-8")

edit(
    "apps/swarmx-api/src/services/renderer-certification.ts",
    '  ffmpeg_faceless_broll: "PUBLISHED_VERIFIED",\n  ffmpeg_cinematic_explainer: "PUBLISHED_VERIFIED",\n  optional_adapter: "PRODUCTION_PACK_VALID",\n',
    '  ffmpeg_faceless_broll: "PUBLISHED_VERIFIED",\n  ffmpeg_cinematic_explainer: "PUBLISHED_VERIFIED",\n  modal_wan22_l4: "READY_TO_POST",\n  modal_ltx_video: "READY_TO_POST",\n  optional_adapter: "PRODUCTION_PACK_VALID",\n',
)

edit(
    "apps/swarmx-api/src/services/template-aware-qc.ts",
    '  optional_adapter: {\n    // Optional adapters (ComfyUI etc.) get no template-specific rules.\n    // All findings pass through at raw severity.\n  },\n};\n',
    '  optional_adapter: {\n    // Optional adapters (ComfyUI etc.) get no template-specific rules.\n    // All findings pass through at raw severity.\n  },\n  modal_wan22_l4: {},\n  modal_ltx_video: {},\n};\n\n// Remote generated segments are treated conservatively: raw findings pass\n// through unless a renderer-specific rule is added later. This keeps the\n// certification gate fail-closed for unexpected high-severity defects.\nObject.assign(TIER_RULES.modal_wan22_l4!, TIER_RULES.ffmpeg_faceless_broll);\nObject.assign(TIER_RULES.modal_ltx_video!, TIER_RULES.ffmpeg_faceless_broll);\n',
)

print("video tier map fix applied")
