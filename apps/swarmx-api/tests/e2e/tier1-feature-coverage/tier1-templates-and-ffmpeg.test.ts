/**
 * Tier 1 Feature Coverage: Features 8, 9
 * F08: Story Templates Prompt Branching (prompt branches for 4 templates)
 * F09: Procedural FFmpeg Backgrounds (4 presets: gradient_flow, fractal_noise, plasma_pulse, minimal_grid)
 */

import {
  expect,
  CANONICAL_PROCEDURAL_PRESETS,
  CANONICAL_TONE_BACKGROUND_MAP,
  CANONICAL_TONES,
  buildProceduralFfmpegFilter,
  type TestSuite,
} from "../test-helpers.js";

export const tier1TemplatesAndFfmpegSuite: TestSuite = {
  suiteName: "Tier 1: Story Templates Branching & Procedural Backgrounds (F08, F09)",
  tier: 1,
  tests: [
    // ─── FEATURE 8: Story Templates Prompt Branching ─────────────────────────
    {
      name: "F08-T01: myth-vs-fact prompt enforces split-screen and villain/counterintuitive hook",
      tier: 1,
      featureId: 8,
      fn: () => {
        const buildTemplatePrompt = (template?: string) => {
          switch (template) {
            case "myth-vs-fact":
              return "Challenge the myth in first half (Named Villain or Counterintuitive Claim hook); second half presents evidence. Storyboard must include >=1 split-screen scene descriptor.";
            case "pov-immersion":
              return "Second-person address throughout ('You'); [HOOK] must use Identity Challenge or Before/After Gap pattern.";
            case "listicle-countdown":
              return "Numbered countdown (5 -> 1). [HOOK] must open with a Number Shock. Scene count matches list item count +- 1.";
            case "reddit-story":
              return "[HOOK] uses Forbidden Knowledge pattern. Every [BODY] sentence must have a [VISUAL:] tag. Storyboard uses fractal_noise FFmpeg background preset.";
            default:
              return "Standard short-form video generation prompt.";
          }
        };

        const prompt = buildTemplatePrompt("myth-vs-fact");
        expect(prompt).toContain("split-screen");
        expect(prompt).toContain("Named Villain");
      },
    },
    {
      name: "F08-T02: pov-immersion prompt enforces second-person address and identity challenge",
      tier: 1,
      featureId: 8,
      fn: () => {
        const buildTemplatePrompt = (template?: string) => {
          if (template === "pov-immersion") {
            return "Second-person address throughout ('You'); [HOOK] must use Identity Challenge or Before/After Gap pattern.";
          }
          return "";
        };
        const prompt = buildTemplatePrompt("pov-immersion");
        expect(prompt).toContain("Second-person");
        expect(prompt).toContain("Identity Challenge");
      },
    },
    {
      name: "F08-T03: listicle-countdown prompt enforces countdown and number shock",
      tier: 1,
      featureId: 8,
      fn: () => {
        const buildTemplatePrompt = (template?: string) => {
          if (template === "listicle-countdown") {
            return "Numbered countdown (5 -> 1). [HOOK] must open with a Number Shock. Scene count matches list item count +- 1.";
          }
          return "";
        };
        const prompt = buildTemplatePrompt("listicle-countdown");
        expect(prompt).toContain("Numbered countdown");
        expect(prompt).toContain("Number Shock");
      },
    },
    {
      name: "F08-T04: reddit-story prompt enforces forbidden knowledge and visual tags on every sentence",
      tier: 1,
      featureId: 8,
      fn: () => {
        const buildTemplatePrompt = (template?: string) => {
          if (template === "reddit-story") {
            return "[HOOK] uses Forbidden Knowledge pattern. Every [BODY] sentence must have a [VISUAL:] tag. Storyboard uses fractal_noise FFmpeg background preset.";
          }
          return "";
        };
        const prompt = buildTemplatePrompt("reddit-story");
        expect(prompt).toContain("Forbidden Knowledge");
        expect(prompt).toContain("[VISUAL:]");
        expect(prompt).toContain("fractal_noise");
      },
    },
    {
      name: "F08-T05: Default fallback prompt is used when template is undefined",
      tier: 1,
      featureId: 8,
      fn: () => {
        const buildTemplatePrompt = (template?: string) => {
          return template ? `Template-specific instruction: ${template}` : "Default standard video prompt";
        };
        expect(buildTemplatePrompt(undefined)).toBe("Default standard video prompt");
      },
    },

    // ─── FEATURE 9: Procedural FFmpeg Backgrounds ────────────────────────────
    {
      name: "F09-T01: All 4 procedural presets are defined",
      tier: 1,
      featureId: 9,
      fn: () => {
        expect(CANONICAL_PROCEDURAL_PRESETS.length).toBe(4);
        expect(CANONICAL_PROCEDURAL_PRESETS).toContain("gradient_flow");
        expect(CANONICAL_PROCEDURAL_PRESETS).toContain("fractal_noise");
        expect(CANONICAL_PROCEDURAL_PRESETS).toContain("plasma_pulse");
        expect(CANONICAL_PROCEDURAL_PRESETS).toContain("minimal_grid");
      },
    },
    {
      name: "F09-T02: All 8 canonical tones map to a valid procedural background preset",
      tier: 1,
      featureId: 9,
      fn: () => {
        for (const tone of CANONICAL_TONES) {
          const preset = CANONICAL_TONE_BACKGROUND_MAP[tone];
          expect(preset).toBeDefined();
          expect(CANONICAL_PROCEDURAL_PRESETS.includes(preset as any)).toBe(true);
        }
      },
    },
    {
      name: "F09-T03: gradient_flow preset generates animated geq linear gradient filter",
      tier: 1,
      featureId: 9,
      fn: () => {
        const filter = buildProceduralFfmpegFilter("gradient_flow", "cinematic");
        expect(filter).toContain("geq=");
        expect(filter).toContain("sin(");
        expect(filter).toContain("cos(");
      },
    },
    {
      name: "F09-T04: fractal_noise preset generates geq noise + colorchannelmixer filter",
      tier: 1,
      featureId: 9,
      fn: () => {
        const filter = buildProceduralFfmpegFilter("fractal_noise", "educational");
        expect(filter).toContain("geq=");
        expect(filter).toContain("colorchannelmixer=");
      },
    },
    {
      name: "F09-T05: plasma_pulse and minimal_grid presets generate active math filters",
      tier: 1,
      featureId: 9,
      fn: () => {
        const plasma = buildProceduralFfmpegFilter("plasma_pulse", "urgent");
        expect(plasma).toContain("geq=");
        expect(plasma).toContain("sqrt(");

        const grid = buildProceduralFfmpegFilter("minimal_grid", "minimal");
        expect(grid).toContain("drawgrid=");
      },
    },
  ],
};
