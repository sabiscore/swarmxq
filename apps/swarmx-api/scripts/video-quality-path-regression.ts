import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("../src/services/ffmpeg-video-renderer.ts", import.meta.url), "utf8");
const alignment = await readFile(new URL("../../../src/swarmx/services/video_caption_aligner.py", import.meta.url), "utf8");
const studio = await readFile(new URL("../../swarmx-dashboard/src/app/(dashboard)/video/studio/page.tsx", import.meta.url), "utf8");
assert.ok(renderer.includes("alignNarrationAudio"));
assert.ok(renderer.includes("SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT"));
assert.ok(renderer.includes("subtitles="));
assert.ok(alignment.includes("word_timestamps=True"));
assert.ok(alignment.includes("SWARMX_WHISPER_DEVICE"));
assert.ok(studio.includes("/api/video/jobs"));
console.log("video-quality-path-regression: PASS");
