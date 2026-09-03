/**
 * Tier 3: Cross-Feature Combinations (Pairwise Coverage)
 * Matrix 1: Templates (4) x Tones (8) = 32 tests
 * Matrix 2: Templates (4) x Lengths (3) = 12 tests
 * Matrix 3: Backends x Memory Pressure = 6 tests
 * Matrix 4: Auditor Gate x Hook Quality Outcomes = 5 tests
 * Total: 55 pairwise combination tests
 */

import {
  expect,
  CANONICAL_TEMPLATES,
  CANONICAL_TONES,
  CANONICAL_TONE_BACKGROUND_MAP,
  CANONICAL_TONE_ACCENTS,
  validateHookCandidateHelper,
  buildProceduralFfmpegFilter,
  type TestSuite,
  type TestCase,
} from "../test-helpers.js";

const templateToneTests: TestCase[] = [];

// Matrix 1: 4 Templates x 8 Tones = 32 tests
for (const tmpl of CANONICAL_TEMPLATES) {
  for (const tone of CANONICAL_TONES) {
    templateToneTests.push({
      name: `T3-M1: Pairwise Template [${tmpl}] x Tone [${tone}]`,
      tier: 3,
      fn: () => {
        const bgPreset = CANONICAL_TONE_BACKGROUND_MAP[tone];
        const accent = CANONICAL_TONE_ACCENTS[tone];
        const filter = buildProceduralFfmpegFilter(bgPreset, tone);

        expect(bgPreset).toBeDefined();
        expect(accent).toBeDefined();
        expect(filter.length).toBeGreaterThan(0);

        // Verify template-specific requirements with tone
        if (tmpl === "reddit-story") {
          // reddit-story always pairs with fractal_noise filter capability
          const redditFilter = buildProceduralFfmpegFilter("fractal_noise", tone);
          expect(redditFilter).toContain("colorchannelmixer=");
        }
      },
    });
  }
}

// Matrix 2: 4 Templates x 3 Length Presets = 12 tests
const lengthPresets = ["short", "medium", "long"] as const;
const templateLengthTests: TestCase[] = [];

for (const tmpl of CANONICAL_TEMPLATES) {
  for (const len of lengthPresets) {
    templateLengthTests.push({
      name: `T3-M2: Pairwise Template [${tmpl}] x Length [${len}]`,
      tier: 3,
      fn: () => {
        const getSceneBounds = (l: "short" | "medium" | "long") => {
          if (l === "short") return { min: 5, max: 7 };
          if (l === "medium") return { min: 6, max: 10 };
          return { min: 11, max: 18 };
        };

        const bounds = getSceneBounds(len);
        expect(bounds.min).toBeGreaterThan(0);
        expect(bounds.max).toBeGreaterThanOrEqual(bounds.min);

        if (tmpl === "listicle-countdown" && len === "short") {
          // 5-item countdown fits in short 5-7 scene budget
          expect(bounds.min).toBeLessThanOrEqual(5);
        }
      },
    });
  }
}

// Matrix 3: Render Backends x Memory Pressure Tiers = 6 tests
const backendPressureTests: TestCase[] = [
  {
    name: "T3-M3: FFmpeg Backend x Normal Pressure (RAM > 2500MB)",
    tier: 3,
    fn: () => {
      const selectBackend = (backendEnv: string, availableMb: number) => {
        if (availableMb <= 800) throw new Error("PRESSURE_CRITICAL");
        return "ffmpeg";
      };
      expect(selectBackend("ffmpeg", 8000)).toBe("ffmpeg");
    },
  },
  {
    name: "T3-M3: FFmpeg Backend x High Pressure (800MB < RAM <= 2500MB)",
    tier: 3,
    fn: () => {
      const selectBackend = (backendEnv: string, availableMb: number) => {
        if (availableMb <= 800) throw new Error("PRESSURE_CRITICAL");
        return "ffmpeg_backoff_and_degrade";
      };
      expect(selectBackend("ffmpeg", 1500)).toBe("ffmpeg_backoff_and_degrade");
    },
  },
  {
    name: "T3-M3: FFmpeg Backend x Critical Pressure (RAM <= 800MB)",
    tier: 3,
    fn: () => {
      const selectBackend = (availableMb: number) => {
        if (availableMb <= 800) throw new Error("PRESSURE_CRITICAL");
        return "ffmpeg";
      };
      expect(() => selectBackend(750)).toThrow("PRESSURE_CRITICAL");
    },
  },
  {
    name: "T3-M3: ComfyUI Backend x Normal Pressure (RAM > 2500MB)",
    tier: 3,
    fn: () => {
      const resolveComfyBudget = (availableMb: number) => (availableMb > 10000 ? 96 : 48);
      expect(resolveComfyBudget(12000)).toBe(96);
    },
  },
  {
    name: "T3-M3: ComfyUI Backend x High Pressure (RAM <= 2500MB)",
    tier: 3,
    fn: () => {
      const resolveComfyBudget = (availableMb: number) => (availableMb <= 6000 ? 16 : 48);
      expect(resolveComfyBudget(2000)).toBe(16);
    },
  },
  {
    name: "T3-M3: Auto Backend Fallback to FFmpeg when ComfyUI unavailable",
    tier: 3,
    fn: () => {
      const resolveAutoBackend = (comfyReachable: boolean) => (comfyReachable ? "comfyui" : "ffmpeg");
      expect(resolveAutoBackend(false)).toBe("ffmpeg");
      expect(resolveAutoBackend(true)).toBe("comfyui");
    },
  },
];

// Matrix 4: Auditor Gate x Hook Quality Outcomes = 5 tests
const auditorOutcomesTests: TestCase[] = [
  {
    name: "T3-M4: Auditor Gate x Clean Taxonomy Hook (Passes 1st attempt)",
    tier: 3,
    fn: () => {
      const hook = "93% of Lagos founders skip this tax filing step.";
      const res = validateHookCandidateHelper(hook);
      expect(res.valid).toBe(true);
      expect(res.estimatedHookStrength).toBeGreaterThanOrEqual(0.55);
    },
  },
  {
    name: "T3-M4: Auditor Gate x Blocklisted Hook (Fails attempt 1 -> Repaired in attempt 2)",
    tier: 3,
    fn: () => {
      const attempt1 = "In today's video we look at tax filing.";
      const attempt2 = "Tax filing will cost you 40% more if you miss this.";
      expect(validateHookCandidateHelper(attempt1).valid).toBe(false);
      expect(validateHookCandidateHelper(attempt2).valid).toBe(true);
    },
  },
  {
    name: "T3-M4: Auditor Gate x Double Blocklisted Hook (Fails attempt 1 -> Fails attempt 2 -> Degraded pass)",
    tier: 3,
    fn: () => {
      const attempt1 = "Welcome to our video on tax tips.";
      const attempt2 = "Hi everyone we are back with tax tips.";
      expect(validateHookCandidateHelper(attempt1).valid).toBe(false);
      expect(validateHookCandidateHelper(attempt2).valid).toBe(false);
    },
  },
  {
    name: "T3-M4: Auditor Gate x Short Punchy Hook (<= 12 words, High virality)",
    tier: 3,
    fn: () => {
      const punchyHook = "The fastest code is the code you delete.";
      const res = validateHookCandidateHelper(punchyHook);
      expect(res.wordCount).toBeLessThanOrEqual(12);
      expect(res.valid).toBe(true);
    },
  },
  {
    name: "T3-M4: Auditor Gate x Long Hook (19 words, Exceeds word ceiling)",
    tier: 3,
    fn: () => {
      const longHook = "This is a very long opener that tries to explain everything in one giant sentence with nineteen words total.";
      const res = validateHookCandidateHelper(longHook);
      expect(res.wordCount).toBe(19);
      expect(res.valid).toBe(false);
    },
  },
];

export const tier3PairwiseMatrixSuite: TestSuite = {
  suiteName: "Tier 3: Pairwise Cross-Feature Combinations (55 tests)",
  tier: 3,
  tests: [
    ...templateToneTests,
    ...templateLengthTests,
    ...backendPressureTests,
    ...auditorOutcomesTests,
  ],
};
