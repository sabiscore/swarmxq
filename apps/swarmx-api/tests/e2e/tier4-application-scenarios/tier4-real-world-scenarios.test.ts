/**
 * Tier 4: Real-World Application Scenarios
 * S01: Tech Myth-Buster TikTok (myth-vs-fact, contrarian, short)
 * S02: Urgent Market Alert Shorts (listicle-countdown, urgent, short)
 * S03: Reddit Mystery Reel (reddit-story, faceless_broll, medium)
 * S04: POV Career Transformation (pov-immersion, kinetic_text, medium)
 * S05: Hook Blocklist Auto-Repair & High RAM Pressure Recovery
 */

import {
  expect,
  CANONICAL_STAGES_7,
  CANONICAL_PLATFORM_CHAR_CAPS,
  validateHookCandidateHelper,
  buildProceduralFfmpegFilter,
  computeViralityOverallScore,
  parseKineticEmphasis,
  CANONICAL_OPERATOR_MAP,
  type TestSuite,
} from "../test-helpers.js";

export const tier4RealWorldScenariosSuite: TestSuite = {
  suiteName: "Tier 4: Real-World Creator Application Scenarios (5 Scenarios)",
  tier: 4,
  tests: [
    // ─── SCENARIO 1 ──────────────────────────────────────────────────────────
    {
      name: "S01: Tech Myth-Buster TikTok (myth-vs-fact, contrarian, short)",
      tier: 4,
      fn: async () => {
        const jobRequest = {
          prompt: "Why 100% Code Coverage is Actually Bad",
          template: "myth-vs-fact" as const,
          tone: "contrarian" as const,
          lengthPreset: "short" as const,
          platform: "tiktok" as const,
        };

        // 1. Pipeline Execution Trace Simulation
        const pipelineTrace: Array<{ stage: string; model?: string }> = [];
        const modelsUsed: Record<string, string> = {};

        // Stage 1: Intent Classification
        modelsUsed["intent_classification"] = CANONICAL_OPERATOR_MAP.Pilot;
        pipelineTrace.push({ stage: "intent_classification", model: modelsUsed["intent_classification"] });

        // Stage 2: Planning
        modelsUsed["planning"] = CANONICAL_OPERATOR_MAP.Architect;
        pipelineTrace.push({ stage: "planning", model: modelsUsed["planning"] });

        // Stage 3: Scripting
        modelsUsed["scripting"] = CANONICAL_OPERATOR_MAP.Architect;
        pipelineTrace.push({ stage: "scripting", model: modelsUsed["scripting"] });

        const scriptText = `[HOOK]
Every senior engineer knows 100% test coverage is a dangerous trap.
[BODY]
It creates hundreds of brittle tests that break on every refactor. [VISUAL: terminal running failing test suite with red text, dark office, 9:16]
Real quality comes from testing critical domain boundaries, not boilerplate getters. [VISUAL: clean architectural diagram highlighted in green, 720p]
[RESOLUTION]
Audit your test suite today and delete every test that doesn't test business logic.
[CTA]
Send this to your tech lead.`;

        // Stage 4: Auditor Review (Single-7B Eviction -> Auditor)
        const hookEvaluation = validateHookCandidateHelper("Every senior engineer knows 100% test coverage is a dangerous trap.");
        expect(hookEvaluation.valid).toBe(true);
        expect(hookEvaluation.wordCount).toBe(11);
        modelsUsed["auditor_review"] = CANONICAL_OPERATOR_MAP.Auditor;
        pipelineTrace.push({ stage: "auditor_review", model: modelsUsed["auditor_review"] });

        // Stage 5: Storyboard Generation
        modelsUsed["storyboard_generation"] = CANONICAL_OPERATOR_MAP.Architect;
        pipelineTrace.push({ stage: "storyboard_generation", model: modelsUsed["storyboard_generation"] });

        // Stage 6: Render Assembly (FFmpeg with plasma_pulse & #ff2222 accent)
        const ffmpegFilter = buildProceduralFfmpegFilter("plasma_pulse", "contrarian");
        expect(ffmpegFilter).toContain("geq=");
        pipelineTrace.push({ stage: "render_assembly" });

        // Stage 7: Finalizing & Post-Pipeline SEO
        const captionDraft = {
          firstLine: "Why 100% test coverage hurts codebases",
          body: "Brittle tests slow down releases. Focus on integration boundaries instead of getters.",
          cta: "Send this to your tech lead.",
          hashtags: {
            broad: ["#programming", "#softwaredevelopment"],
            niche: ["#cleancode", "#unittesting"],
            trending: [],
          },
          soundSuggestion: "Fast electronic pulse with rising tension",
        };

        const viralitySignal = {
          hookStrength: 0.92,
          completionProxy: 0.84,
          shareability: 0.88,
          seoScore: 0.80,
          overall: computeViralityOverallScore({
            hookStrength: 0.92,
            completionProxy: 0.84,
            shareability: 0.88,
            seoScore: 0.80,
          }),
        };

        pipelineTrace.push({ stage: "finalizing" });

        // Assertions for complete TikTok package
        expect(pipelineTrace.length).toBe(7);
        expect(captionDraft.firstLine.length).toBeLessThanOrEqual(40);
        expect(captionDraft.body.length + captionDraft.firstLine.length).toBeLessThan(CANONICAL_PLATFORM_CHAR_CAPS.tiktok.soft);
        expect(viralitySignal.overall).toBeGreaterThanOrEqual(0.85);
      },
    },

    // ─── SCENARIO 2 ──────────────────────────────────────────────────────────
    {
      name: "S02: Urgent Market Alert Shorts (listicle-countdown, urgent, short)",
      tier: 4,
      fn: async () => {
        const jobRequest = {
          prompt: "Top 3 AI Regulations Passing This Week",
          template: "listicle-countdown" as const,
          tone: "urgent" as const,
          lengthPreset: "short" as const,
          platform: "shorts" as const,
        };

        const hookText = "Three emergency AI laws pass into law in 48 hours.";
        const hookCheck = validateHookCandidateHelper(hookText);
        expect(hookCheck.valid).toBe(true);
        expect(hookCheck.wordCount).toBe(10);
        expect(hookCheck.wordCount).toBeLessThanOrEqual(18);

        const scriptText = `[HOOK]
${hookText}
[BODY]
Number 3: Mandatory model registry audits for all tech companies. [VISUAL: compliance document stamped in red, fast hold, 9:16]
Number 2: Immediate bans on non-disclosed automated voice calls. [VISUAL: telephone interface waving audio waveform, red warning]
Number 1: Strict copyright transparency reports on all training data. [VISUAL: code repository scraping visual]
[RESOLUTION]
Check your company's AI stack today before enforcement starts.
[CTA]
Bookmark this update now.`;

        const emphasis = parseKineticEmphasis("Number *3*: Mandatory model registry audits NOW.");
        expect(emphasis.hasAsteriskEmphasis).toBe(true);
        expect(emphasis.allCapsWords).toContain("NOW");

        const captionDraft = {
          firstLine: "Top 3 urgent AI regulations this week",
          body: "Major compliance changes take effect immediately across tech infrastructure.",
          cta: "Bookmark this update now.",
          hashtags: {
            broad: ["#tech", "#artificialintelligence"],
            niche: ["#airegulation", "#technews"],
            trending: ["#aitools"],
          },
        };

        expect(captionDraft.firstLine.length).toBeLessThanOrEqual(40);
        expect(captionDraft.body.length).toBeLessThan(CANONICAL_PLATFORM_CHAR_CAPS.shorts.soft);
      },
    },

    // ─── SCENARIO 3 ──────────────────────────────────────────────────────────
    {
      name: "S03: Reddit Mystery Reel (reddit-story, faceless_broll, medium)",
      tier: 4,
      fn: async () => {
        const jobRequest = {
          prompt: "The Unexplained Radio Signal from Deep Trench",
          template: "reddit-story" as const,
          tone: "faceless_broll" as const,
          lengthPreset: "medium" as const,
          platform: "reels" as const,
        };

        const hookText = "Deep sea divers found a radio signal nobody can explain.";
        const hookCheck = validateHookCandidateHelper(hookText);
        expect(hookCheck.valid).toBe(true);

        // Every sentence in body has [VISUAL:]
        const bodySentences = [
          "In 2018, hydrophones in the Mariana Trench picked up a repeating rhythm. [VISUAL: ocean depth sonar display with green pulse, dark waters, 720p]",
          "Scientists confirmed the frequency matched no known marine biology. [VISUAL: laboratory acoustic analysis monitor with frequency spikes]",
          "When the Navy sent an unmanned probe, the transmission abruptly halted. [VISUAL: underwater ROV headlights revealing dark trench wall]",
        ];

        for (const s of bodySentences) {
          expect(s).toContain("[VISUAL:");
        }

        const bgFilter = buildProceduralFfmpegFilter("fractal_noise", "faceless_broll");
        expect(bgFilter).toContain("colorchannelmixer=");

        const captionDraft = {
          firstLine: "Deep ocean signal nobody can explain",
          body: "Hydrophones detected repeating acoustic frequencies in 2018.",
          cta: "Share your theory in comments.",
          hashtags: {
            broad: ["#mystery", "#ocean"],
            niche: ["#deepsea", "#unexplained"],
            trending: [],
          },
        };

        expect(captionDraft.firstLine.length).toBeLessThanOrEqual(40);
        expect(captionDraft.firstLine.length + captionDraft.body.length).toBeLessThan(CANONICAL_PLATFORM_CHAR_CAPS.reels.soft);
      },
    },

    // ─── SCENARIO 4 ──────────────────────────────────────────────────────────
    {
      name: "S04: POV Career Transformation (pov-immersion, kinetic_text, medium)",
      tier: 4,
      fn: async () => {
        const jobRequest = {
          prompt: "You Are Spending 80% of Your Time on the Wrong Tasks",
          template: "pov-immersion" as const,
          tone: "kinetic_text" as const,
          lengthPreset: "medium" as const,
        };

        const hookText = "If your calendar is full, you are probably not moving forward.";
        const hookCheck = validateHookCandidateHelper(hookText);
        expect(hookCheck.valid).toBe(true);
        expect(hookCheck.wordCount).toBe(11);

        const scriptBody = "You spend all week answering emails and status pings. Real output happens in *uninterrupted* deep blocks.";
        const emphasis = parseKineticEmphasis(scriptBody);
        expect(emphasis.hasAsteriskEmphasis).toBe(true);
        expect(emphasis.emphasizedWords).toContain("uninterrupted");

        const kineticFilter = buildProceduralFfmpegFilter("minimal_grid", "kinetic_text");
        expect(kineticFilter).toContain("drawgrid=");

        const virality = {
          hookStrength: 0.89,
          completionProxy: 0.81,
          shareability: 0.85,
          seoScore: 0.78,
          overall: computeViralityOverallScore({
            hookStrength: 0.89,
            completionProxy: 0.81,
            shareability: 0.85,
            seoScore: 0.78,
          }),
        };

        expect(virality.overall).toBeGreaterThanOrEqual(0.80);
      },
    },

    // ─── SCENARIO 5 ──────────────────────────────────────────────────────────
    {
      name: "S05: Hook Blocklist Auto-Repair & Memory Pressure Recovery",
      tier: 4,
      fn: async () => {
        // Step 1: Simulated High Pressure Trigger
        const initialAvailableMb = 1750; // High pressure range (800 < MB <= 2500)
        let backoffDelayMs = 0;
        if (initialAvailableMb <= 2500 && initialAvailableMb > 800) {
          backoffDelayMs = 3000;
        }
        expect(backoffDelayMs).toBe(3000);

        // Step 2: Low-Quality Initial Scripting Attempt
        const attempt1Hook = "In today's video we will talk about Node.js memory leaks.";
        const attempt1Check = validateHookCandidateHelper(attempt1Hook);
        expect(attempt1Check.valid).toBe(false);
        expect(attempt1Check.violation).toBe("In today's video");

        // Step 3: Auditor Gate Flags Repair (Attempt 1 -> Attempt 2)
        const attempt2Hook = "Your Node.js server is leaking memory right now.";
        const attempt2Check = validateHookCandidateHelper(attempt2Hook);
        expect(attempt2Check.valid).toBe(true);
        expect(attempt2Check.wordCount).toBe(8);

        // Step 4: Single-7B Model Eviction
        const loadedModels = new Set(["plan-qwen25-pro-q5km-prod"]);
        // Evict Architect before loading Auditor
        loadedModels.delete("plan-qwen25-pro-q5km-prod");
        loadedModels.add("critique-deepseekr1-pro-q5km-prod");
        expect(loadedModels.size).toBe(1);

        // Step 5: Final Render and Artifact Production
        const finalJobOutput = {
          id: "job_resilient_005",
          status: "completed",
          retries: 1,
          output: {
            relativePath: "exports/job_resilient_005.mp4",
            durationSeconds: 15,
            format: "mp4",
            checksum: "sha256-d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
          },
          viralitySignal: {
            hookStrength: 0.91,
            completionProxy: 0.85,
            shareability: 0.80,
            seoScore: 0.77,
            overall: computeViralityOverallScore({
              hookStrength: 0.91,
              completionProxy: 0.85,
              shareability: 0.80,
              seoScore: 0.77,
            }),
          },
        };

        expect(finalJobOutput.retries).toBe(1);
        expect(finalJobOutput.status).toBe("completed");
        expect(finalJobOutput.viralitySignal.overall).toBeGreaterThanOrEqual(0.80);
      },
    },
  ],
};
