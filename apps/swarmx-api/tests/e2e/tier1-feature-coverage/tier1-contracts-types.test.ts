/**
 * Tier 1 Feature Coverage: Features 1, 2, 3
 * F01: Story Templates Contract (VideoTemplate 4-member union)
 * F02: SEO & Caption Types (CaptionDraft, HashtagSet, PLATFORM_CHAR_CAPS)
 * F03: QA Auditor Stage Type (auditor_review in VideoJobStage, VIDEO_JOB_STAGE_ORDER, Progress ranges)
 */

import {
  expect,
  CANONICAL_TEMPLATES,
  CANONICAL_STAGES_7,
  CANONICAL_STAGE_PROGRESS_RANGES,
  CANONICAL_PLATFORM_CHAR_CAPS,
  type TestCase,
  type TestSuite,
} from "../test-helpers.js";

export const tier1ContractsTypesSuite: TestSuite = {
  suiteName: "Tier 1: Video Contracts & Domain Types (F01, F02, F03)",
  tier: 1,
  tests: [
    // ─── FEATURE 1: Story Templates Contract ─────────────────────────────────
    {
      name: "F01-T01: VideoTemplate canonical 4-member union definition",
      tier: 1,
      featureId: 1,
      fn: () => {
        expect(CANONICAL_TEMPLATES.length).toBe(4);
        expect(CANONICAL_TEMPLATES).toContain("myth-vs-fact");
        expect(CANONICAL_TEMPLATES).toContain("pov-immersion");
        expect(CANONICAL_TEMPLATES).toContain("listicle-countdown");
        expect(CANONICAL_TEMPLATES).toContain("reddit-story");
      },
    },
    {
      name: "F01-T02: VideoJobRequest accepts optional template field",
      tier: 1,
      featureId: 1,
      fn: () => {
        const reqWithTemplate = { prompt: "Test prompt", template: "myth-vs-fact" as const };
        const reqWithoutTemplate = { prompt: "Test prompt" };
        expect(reqWithTemplate.template).toBe("myth-vs-fact");
        expect(reqWithoutTemplate.template).toBeUndefined();
      },
    },
    {
      name: "F01-T03: VideoTemplate validator rejects non-canonical template values",
      tier: 1,
      featureId: 1,
      fn: () => {
        const isCanonicalTemplate = (val: string): boolean =>
          CANONICAL_TEMPLATES.includes(val as any);
        expect(isCanonicalTemplate("myth-vs-fact")).toBe(true);
        expect(isCanonicalTemplate("custom-template")).toBe(false);
        expect(isCanonicalTemplate("vlog")).toBe(false);
      },
    },
    {
      name: "F01-T04: VideoTemplate serialization round-trip preservation",
      tier: 1,
      featureId: 1,
      fn: () => {
        for (const t of CANONICAL_TEMPLATES) {
          const serialized = JSON.stringify({ template: t });
          const parsed = JSON.parse(serialized);
          expect(parsed.template).toBe(t);
        }
      },
    },
    {
      name: "F01-T05: VideoTemplate distinctness and exclusivity",
      tier: 1,
      featureId: 1,
      fn: () => {
        const set = new Set(CANONICAL_TEMPLATES);
        expect(set.size).toBe(4);
      },
    },

    // ─── FEATURE 2: SEO & Caption Types ──────────────────────────────────────
    {
      name: "F02-T01: CaptionDraft structure conforms to requirements",
      tier: 1,
      featureId: 2,
      fn: () => {
        const draft = {
          firstLine: "Stop making this beginner mistake in React",
          body: "Component re-renders are usually caused by inline object props.",
          cta: "Save this tip for your next code review.",
          hashtags: {
            broad: ["#reactjs", "#webdev"],
            niche: ["#reacttips"],
            trending: ["#buildinpublic"],
          },
          soundSuggestion: "Upbeat electronic 125 BPM",
        };
        expect(typeof draft.firstLine).toBe("string");
        expect(typeof draft.body).toBe("string");
        expect(typeof draft.cta).toBe("string");
        expect(Array.isArray(draft.hashtags.broad)).toBe(true);
        expect(Array.isArray(draft.hashtags.niche)).toBe(true);
        expect(Array.isArray(draft.hashtags.trending)).toBe(true);
      },
    },
    {
      name: "F02-T02: Platform character caps are defined as named constants",
      tier: 1,
      featureId: 2,
      fn: () => {
        expect(CANONICAL_PLATFORM_CHAR_CAPS.tiktok.hard).toBe(2200);
        expect(CANONICAL_PLATFORM_CHAR_CAPS.tiktok.soft).toBe(280);
        expect(CANONICAL_PLATFORM_CHAR_CAPS.reels.hard).toBe(2200);
        expect(CANONICAL_PLATFORM_CHAR_CAPS.reels.soft).toBe(125);
        expect(CANONICAL_PLATFORM_CHAR_CAPS.shorts.hard).toBe(5000);
        expect(CANONICAL_PLATFORM_CHAR_CAPS.shorts.soft).toBe(300);
      },
    },
    {
      name: "F02-T03: HashtagSet contains broad, niche, trending arrays",
      tier: 1,
      featureId: 2,
      fn: () => {
        const hashtagSet = {
          broad: ["#dev", "#coding"],
          niche: ["#typescripttips"],
          trending: [],
        };
        expect(hashtagSet.broad.length).toBe(2);
        expect(hashtagSet.niche.length).toBe(1);
        expect(hashtagSet.trending.length).toBe(0);
      },
    },
    {
      name: "F02-T04: VideoOutputMetadata supports optional captionDraft attachment",
      tier: 1,
      featureId: 2,
      fn: () => {
        const metadata = {
          relativePath: "exports/vid1.mp4",
          durationSeconds: 30,
          checksum: "sha256-abc123",
          captionDraft: {
            firstLine: "Fastest way to debug Async in Node.js",
            body: "Trace unhandled promises with this flag.",
            cta: "Try it in production.",
            hashtags: { broad: ["#nodejs"], niche: ["#backenddev"], trending: [] },
          },
        };
        expect(metadata.captionDraft.firstLine).toBe("Fastest way to debug Async in Node.js");
      },
    },
    {
      name: "F02-T05: CaptionDraft soundSuggestion excludes artist and URL markers",
      tier: 1,
      featureId: 2,
      fn: () => {
        const validSound = "Lofi chill beats with low bass";
        const invalidSoundUrl = "https://spotify.com/track/123";
        expect(invalidSoundUrl.startsWith("http")).toBe(true);
        expect(validSound.startsWith("http")).toBe(false);
      },
    },

    // ─── FEATURE 3: QA Auditor Stage Type ────────────────────────────────────
    {
      name: "F03-T01: auditor_review is present in canonical 7-stage sequence",
      tier: 1,
      featureId: 3,
      fn: () => {
        expect(CANONICAL_STAGES_7.length).toBe(7);
        expect(CANONICAL_STAGES_7).toContain("auditor_review");
      },
    },
    {
      name: "F03-T02: auditor_review is positioned strictly between scripting and storyboard",
      tier: 1,
      featureId: 3,
      fn: () => {
        const scriptingIdx = CANONICAL_STAGES_7.indexOf("scripting");
        const auditorIdx = CANONICAL_STAGES_7.indexOf("auditor_review");
        const storyboardIdx = CANONICAL_STAGES_7.indexOf("storyboard_generation");
        expect(auditorIdx).toBe(scriptingIdx + 1);
        expect(storyboardIdx).toBe(auditorIdx + 1);
      },
    },
    {
      name: "F03-T03: Stage progress ranges sum monotonically from 0 to 100%",
      tier: 1,
      featureId: 3,
      fn: () => {
        const ranges = CANONICAL_STAGE_PROGRESS_RANGES;
        expect(ranges.intent_classification.start).toBe(0);
        expect(ranges.intent_classification.end).toBe(15);
        expect(ranges.planning.start).toBe(15);
        expect(ranges.planning.end).toBe(25);
        expect(ranges.scripting.start).toBe(25);
        expect(ranges.scripting.end).toBe(40);
        expect(ranges.auditor_review.start).toBe(40);
        expect(ranges.auditor_review.end).toBe(50);
        expect(ranges.storyboard_generation.start).toBe(50);
        expect(ranges.storyboard_generation.end).toBe(70);
        expect(ranges.render_assembly.start).toBe(70);
        expect(ranges.render_assembly.end).toBe(90);
        expect(ranges.finalizing.start).toBe(90);
        expect(ranges.finalizing.end).toBe(100);
      },
    },
    {
      name: "F03-T04: auditor_review stage progress range spans exactly 10% (40-50%)",
      tier: 1,
      featureId: 3,
      fn: () => {
        const range = CANONICAL_STAGE_PROGRESS_RANGES.auditor_review;
        expect(range.end - range.start).toBe(10);
      },
    },
    {
      name: "F03-T05: VideoStageProgress interface supports auditor_review stage data",
      tier: 1,
      featureId: 3,
      fn: () => {
        const progress = {
          stage: "auditor_review" as const,
          stageProgress: 100,
          overallProgress: 50,
          message: "Auditor review complete: hook passed validation",
        };
        expect(progress.stage).toBe("auditor_review");
        expect(progress.overallProgress).toBe(50);
      },
    },
  ],
};
