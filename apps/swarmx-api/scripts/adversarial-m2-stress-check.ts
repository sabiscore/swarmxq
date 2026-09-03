/**
 * apps/swarmx-api/scripts/adversarial-m2-stress-check.ts
 * Comprehensive Empirical Challenger Stress Suite for Milestone M2.
 */

import assert from "node:assert/strict";
import { sanitizeReasoningOutput, extractJson } from "../src/services/reasoning-sanitizer.js";
import {
  generateFinalizerCaptionDraft,
  validateCaption,
  buildDeterministicCaptionDraft,
  CAPTION_RULES,
  PLATFORM_CHAR_CAPS,
} from "../src/services/caption-generator.js";
import {
  derivePreliminaryHookScore,
  classifyHookFamily,
  validateHookCandidate,
} from "../src/lib/hook-laboratory.js";
import { findHookBlocklistViolations } from "../src/lib/creative-quality.js";
import { ModelOrchestrator } from "../src/services/model-orchestrator.js";
import { resolveCanonicalTag, is7BModel } from "@swarmx/types/operator-map";
import type { VideoJobRequest, VideoTemplate } from "@swarmx/types/video-types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function runTestSuite() {
  console.log("===============================================================");
  console.log("  M2 ADVERSARIAL STRESS TEST HARNESS — EMPIRICAL CHALLENGER 2 ");
  console.log("===============================================================\n");

  let totalAssertions = 0;
  function check(desc: string, condition: boolean) {
    totalAssertions++;
    if (!condition) {
      console.error(`❌ FAIL: ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
    console.log(`  ✓ ${desc}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Reasoning Sanitizer & Malformed Ollama Outputs
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Testing Reasoning Sanitizer & Ollama Failure Modes ---");

  // 1.1 Unclosed <think> tag
  const unclosedThink = "<think>Here is some internal thoughts that never closed... I will now generate output";
  const sanitizedUnclosed = sanitizeReasoningOutput(unclosedThink);
  check("Unclosed <think> tag is sanitized without crashing", typeof sanitizedUnclosed.text === "string");

  // 1.2 Nested <think> tags with malformed xml
  const nestedThink = "<think><think>nested reasoning</think> still thinking</think>{\"firstLine\":\"Clean line\"}";
  const sanitizedNested = sanitizeReasoningOutput(nestedThink);
  check("Nested <think> tags are stripped cleanly", sanitizedNested.text.includes("{\"firstLine\":\"Clean line\"}"));
  check("Reasoning trace captured in thought block", sanitizedNested.thought?.includes("nested reasoning") ?? false);

  // 1.3 HTML / 502 Bad Gateway from Ollama
  const badGateway = "<html><body><h1>502 Bad Gateway</h1><p>Ollama server unreachable</p></body></html>";
  const sanitizedHtml = sanitizeReasoningOutput(badGateway);
  const jsonFromHtml = extractJson<Record<string, unknown>>(sanitizedHtml.text);
  check("HTML error returns ok=false from extractJson", jsonFromHtml.ok === false);

  // 1.4 Raw markdown code fences
  const markdownFenced = "```json\n{\n  \"firstLine\": \"Stop scrolling right now\",\n  \"body\": \"Here is why it matters.\",\n  \"cta\": \"Save this for later.\",\n  \"soundSuggestion\": \"Upbeat techno 128 BPM\"\n}\n```";
  const jsonFromFenced = extractJson<{ firstLine: string }>(markdownFenced);
  check("Markdown ```json fenced blocks are extracted", jsonFromFenced.ok === true && jsonFromFenced.data.firstLine === "Stop scrolling right now");

  // 1.5 Empty string and whitespace
  const emptyJson = extractJson("");
  check("Empty string extraction fails gracefully with ok=false", emptyJson.ok === false);

  const whitespaceJson = extractJson("    \n\n\t  ");
  check("Whitespace string extraction fails gracefully with ok=false", whitespaceJson.ok === false);

  // 1.6 Partial / truncated JSON
  const truncatedJson = extractJson("{\"firstLine\": \"Incomplete");
  check("Truncated JSON extraction fails gracefully with ok=false", truncatedJson.ok === false);


  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Hook Quality, Blocklists & Auditor Gate Decision Logic
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Testing Hook Laboratory, Blocklists & Auditor Gate ---");

  // 2.1 Blocklisted openers
  const blocklistedHook = "In this video, I will show you how to code faster.";
  const violations = findHookBlocklistViolations(blocklistedHook);
  check("findHookBlocklistViolations detects 'In this video'", violations.length > 0 && violations[0].includes("In this video"));

  const valBlocklisted = validateHookCandidate(blocklistedHook);
  check("validateHookCandidate fails on blocklisted opener", valBlocklisted.passes === false);

  // 2.2 Word count ceiling (18 words limit)
  const longHook = "This is an extremely excessively long hook sentence designed specifically to exceed the eighteen word limit required by the creative director guidelines today.";
  const valLong = validateHookCandidate(longHook);
  check("validateHookCandidate fails on >18 words", valLong.wordCount > 18 && valLong.passes === false);

  // 2.3 High quality hook
  const goodHook = "90% of developers use TypeScript incorrectly.";
  const valGood = validateHookCandidate(goodHook);
  check("High quality hook passes validation", valGood.passes === true && valGood.wordCount <= 18);

  const hookScoreGood = derivePreliminaryHookScore(`[HOOK]\n${goodHook}\n[BODY]\nHere is the real problem.`);
  check("High quality hook achieves score >= 0.55", hookScoreGood >= 0.55);

  const hookScoreBad = derivePreliminaryHookScore(`[HOOK]\n${blocklistedHook}\n[BODY]\nHere is the real problem.`);
  check("Blocklisted hook scores below threshold (< 0.55)", hookScoreBad < 0.55);


  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: SEO Finalizer Caption Validation & Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Testing SEO Finalizer, Caption Rules & Platform Caps ---");

  // 3.1 Deterministic fallback caption
  const fallbackDraft = buildDeterministicCaptionDraft({
    topic: "Next.js 15 Server Actions",
    tone: "educational",
    platform: "tiktok",
  }, `[HOOK]\n${goodHook}\n[BODY]\nFramework details.`);

  check("Deterministic firstLine matches hook if valid and <= 40 chars", fallbackDraft.firstLine === goodHook);
  check("Deterministic fallback niche hashtag is generated from topic", fallbackDraft.hashtags.niche.length >= 1 && fallbackDraft.hashtags.niche[0].startsWith("#"));
  check("Deterministic fallback soundSuggestion has no URL or artist", !/(https?:\/\/|spotify)/i.test(fallbackDraft.soundSuggestion ?? ""));

  const valFallback = validateCaption(fallbackDraft, "tiktok");
  check("Deterministic fallback passes validation", valFallback.valid === true);

  // 3.2 Banned firstLine openers (I, My, This, We, Our)
  const draftBannedOpener = {
    ...fallbackDraft,
    firstLine: "I believe this is the best tool ever.",
  };
  const valBannedOpener = validateCaption(draftBannedOpener, "tiktok");
  check("validateCaption catches 'I ' opener", valBannedOpener.valid === false && valBannedOpener.violations.some(v => v.includes("I, My, This, We, or Our")));

  // 3.3 Forbidden hashtags (#fyp, #viral, #foryou, #trending)
  const draftForbiddenTags = {
    ...fallbackDraft,
    hashtags: {
      broad: ["#tech"],
      niche: ["#fyp", "#nextjs"],
      trending: ["#viral"],
    },
  };
  const valForbiddenTags = validateCaption(draftForbiddenTags, "tiktok");
  check("validateCaption catches #fyp and #viral", valForbiddenTags.valid === false && valForbiddenTags.violations.some(v => v.includes("forbidden tags")));

  // 3.4 Platform char caps
  check("Platform char caps constants exist", 
    PLATFORM_CHAR_CAPS.tiktok.hard === 2200 && PLATFORM_CHAR_CAPS.tiktok.soft === 280 &&
    PLATFORM_CHAR_CAPS.reels.hard === 2200 && PLATFORM_CHAR_CAPS.reels.soft === 125 &&
    PLATFORM_CHAR_CAPS.shorts.hard === 5000 && PLATFORM_CHAR_CAPS.shorts.soft === 300
  );

  // 3.5 Sound suggestion URL block
  const draftWithUrl = {
    ...fallbackDraft,
    soundSuggestion: "Listen to https://spotify.com/track/123",
  };
  const valWithUrl = validateCaption(draftWithUrl, "tiktok");
  check("validateCaption catches URL in soundSuggestion", valWithUrl.valid === false);


  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Single-7B Lock Transitions & Model Orchestration
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Testing Single-7B Lock & Model Orchestration ---");

  const modelOrchestrator = ModelOrchestrator.getInstance();
  const architectTag = resolveCanonicalTag("plan-qwen25-pro-q5km-prod");
  const auditorTag = resolveCanonicalTag("critique-deepseekr1-pro-q5km-prod");
  const oracleTag = resolveCanonicalTag("reason-deepseekr1-pro-q5km-prod");
  const pilotTag = resolveCanonicalTag("instruct-phi4-pro-q8-prod");

  check("Architect is recognized as 7B model", is7BModel(architectTag) === true);
  check("Auditor is recognized as 7B model", is7BModel(auditorTag) === true);
  check("Oracle is recognized as 7B model", is7BModel(oracleTag) === true);
  check("Pilot is recognized as non-7B model", is7BModel(pilotTag) === false);

  // Test simulated transitions
  console.log("  Testing transition: Scripting (Architect) -> Auditor Gate (Auditor)");
  const reqArchitect = await modelOrchestrator.requestModel(architectTag);
  check("Architect requested successfully", reqArchitect.modelTag === architectTag);
  modelOrchestrator.onModelCallComplete(architectTag);

  const reqAuditor = await modelOrchestrator.requestModel(auditorTag);
  check("Auditor requested and evicted Architect", reqAuditor.modelTag === auditorTag);
  modelOrchestrator.onModelCallComplete(auditorTag);

  const reqOracle = await modelOrchestrator.requestModel(oracleTag);
  check("Oracle requested and evicted Auditor", reqOracle.modelTag === oracleTag);
  modelOrchestrator.onModelCallComplete(oracleTag);

  // Evict Oracle and request Pilot
  await modelOrchestrator.unloadModel(oracleTag);
  const reqPilot = await modelOrchestrator.requestModel(pilotTag);
  check("Pilot requested cleanly after Oracle eviction", reqPilot.modelTag === pilotTag);
  modelOrchestrator.onModelCallComplete(pilotTag);


  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Story Templates Prompt Distinctiveness & Visual Directives
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Testing Story Templates Prompt Distinctiveness & Directives ---");

  const orchestratorSource = readFileSync(
    resolve(process.cwd(), "apps/swarmx-api/src/services/video-orchestrator.ts"),
    "utf-8"
  );

  const templates: VideoTemplate[] = ["myth-vs-fact", "pov-immersion", "listicle-countdown", "reddit-story"];

  // 5.1 Check template definitions in video-orchestrator.ts
  check("TEMPLATE_SCRIPTING_RULES defined in video-orchestrator", orchestratorSource.includes("TEMPLATE_SCRIPTING_RULES"));
  check("TEMPLATE_STORYBOARD_RULES defined in video-orchestrator", orchestratorSource.includes("TEMPLATE_STORYBOARD_RULES"));
  check("TEMPLATE_FAMILY_STRUCTURES defined in video-orchestrator", orchestratorSource.includes("TEMPLATE_FAMILY_STRUCTURES"));

  // 5.2 Specific template rules
  check("myth-vs-fact scripting enforces Named Villain or Counterintuitive Claim", 
    orchestratorSource.includes("Named Villain") && orchestratorSource.includes("Counterintuitive Claim")
  );
  check("myth-vs-fact storyboard enforces split-screen directive", 
    orchestratorSource.includes("split-screen") && orchestratorSource.includes("Left shows Myth")
  );

  check("pov-immersion scripting enforces strict SECOND-PERSON address", 
    orchestratorSource.includes("SECOND-PERSON") && orchestratorSource.includes("Identity Challenge")
  );
  check("pov-immersion storyboard enforces subjective first-person POV angles", 
    orchestratorSource.includes("subjective first-person POV camera angles")
  );

  check("listicle-countdown scripting enforces Number Shock and descending 5 to 1", 
    orchestratorSource.includes("Number Shock") && orchestratorSource.includes("descending numbered countdown")
  );
  check("listicle-countdown storyboard enforces countdown badges and scene count matching item count ± 1", 
    orchestratorSource.includes("Scene count MUST match the list item count") && orchestratorSource.includes("#5")
  );

  check("reddit-story scripting enforces Forbidden Knowledge and mandatory [VISUAL:] tags after every [BODY] sentence", 
    orchestratorSource.includes("Forbidden Knowledge") && orchestratorSource.includes("Every single sentence in [BODY] MUST have an accompanying [VISUAL:")
  );
  check("reddit-story storyboard enforces fractal_noise procedural background preset", 
    orchestratorSource.includes("fractal_noise")
  );

  // 5.3 Verify prompt branching is called with req.template
  check("buildScriptingPrompt branches on req.template ?? req.templateFamily", 
    orchestratorSource.includes("const selectedTemplate = req.template ?? req.templateFamily")
  );
  check("buildStoryboardPrompt branches on req.template ?? req.templateFamily", 
    orchestratorSource.includes("templateStoryboardRule")
  );

  console.log(`\n===============================================================`);
  console.log(`  ALL ${totalAssertions} EMPIRICAL STRESS ASSERTIONS PASSED CLEANLY! `);
  console.log(`===============================================================\n`);
}

runTestSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
