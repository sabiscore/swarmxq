/**
 * apps/swarmx-api/src/services/caption-generator.ts
 * VIDEO-ALPHA / M2 dual-model caption and SEO finalizer.
 */

import type {
  CaptionDraft,
  CaptionValidation,
  HashtagSet,
  VideoExportPlatform,
} from "@swarmx/types/video-types";
import { PLATFORM_CHAR_CAPS } from "@swarmx/types/video-types";
import { resolveCanonicalTag } from "@swarmx/types/operator-map";
import { ModelOrchestrator } from "./model-orchestrator.js";
import {
  getAdaptiveCallConfig,
  recordFailure,
  recordSuccess,
  withTimeout,
} from "./adaptive-timeout-config.js";
import { extractJson, sanitizeReasoningOutput } from "./reasoning-sanitizer.js";
import { generateOllamaText } from "./ollama.js";
import { loadEnv } from "../lib/env.js";
import { log } from "../lib/logger.js";
import { isLowRamVideoMode, LOW_RAM_VIDEO_MODEL } from "./video-runtime-config.js";

export const CAPTION_RULES = {
  firstLineMaxChars: 40,
  disallowedOpenerRegex: /^(I|My|This|We|Our)\b/i,
  forbiddenHashtags: new Set(["#fyp", "#viral", "#foryou", "#trending", "fyp", "viral", "foryou", "trending"]),
  hashtagMin: 3,
  hashtagMax: 5,
  trendingHashtagMax: 1,
  hashtagsInBodyProhibited: true,
  soundSuggestionNoUrl: true,
  soundSuggestionNoArtist: true,
  maxEmojiInFullCaption: 3,
} as const;

export { PLATFORM_CHAR_CAPS };

export interface CaptionGenerationInput {
  topic: string;
  tone: string;
  platform: VideoExportPlatform;
  scriptText?: string;
  viralitySummary?: string;
  signal?: AbortSignal;
  onModelAcquired?: (stage: "finalizing", modelTag: string) => void;
}

export interface CaptionGenerationResult {
  draft: CaptionDraft;
  validation: CaptionValidation;
}

interface OracleNarrativeOutput {
  firstLine: string;
  body: string;
  cta: string;
  soundSuggestion: string;
}

interface PilotHashtagOutput {
  broad: string[];
  niche: string[];
  trending: string[];
}

// ─── Oracle Narrative Generator ───────────────────────────────────────────────

async function callOracleNarrative(
  input: CaptionGenerationInput,
  signal?: AbortSignal,
): Promise<OracleNarrativeOutput | null> {
  const orchestrator = ModelOrchestrator.getInstance();
  const oracleTag = isLowRamVideoMode()
    ? LOW_RAM_VIDEO_MODEL
    : resolveCanonicalTag(loadEnv().SWARMX_MODEL_REASON);
  const callConfig = getAdaptiveCallConfig(oracleTag, "deep_reasoning");

  if (callConfig.circuitOpen) {
    log.warn({ modelTag: oracleTag }, "Oracle circuit open — skipping narrative generation");
    return null;
  }

  let modelRequest;
  try {
    modelRequest = await orchestrator.requestModel(callConfig.modelTag);
  } catch (err) {
    log.warn({ modelTag: callConfig.modelTag, error: err }, "Failed to request Oracle model");
    return null;
  }

  input.onModelAcquired?.("finalizing", modelRequest.modelTag);

  const prompt = [
    `Platform: ${input.platform}`,
    `Topic: ${input.topic}`,
    `Tone: ${input.tone}`,
    input.scriptText ? `Script:\n${input.scriptText}` : "",
    input.viralitySummary ? `Virality Context: ${input.viralitySummary}` : "",
    "Generate the narrative component of a short-form video caption.",
    "Output strict JSON only with keys: firstLine, body, cta, soundSuggestion.",
    "Rules:",
    "- firstLine must be <= 40 characters.",
    "- firstLine must NOT begin with 'I', 'My', 'This', 'We', or 'Our'.",
    "- body must be high-converting context without any hashtags.",
    "- cta must be 5 to 8 words specific call to action.",
    "- soundSuggestion must describe audio tempo, BPM, energy, and instruments ONLY (no URLs, no artist names, no track titles).",
  ].filter(Boolean).join("\n\n");

  try {
    const { text: raw } = await withTimeout(
      generateOllamaText({
        model: modelRequest.modelTag,
        prompt: [
          "Respond with valid JSON only. Do not include markdown, prose, or reasoning blocks.",
          prompt,
        ].join("\n\n"),
        ...(signal ? { signal } : {}),
        maxTokens: modelRequest.overrides.num_predict ?? callConfig.overrides.num_predict ?? 512,
        overrides: {
          ...callConfig.overrides,
          ...modelRequest.overrides,
          temperature: 0.2,
        },
      }),
      callConfig.timeoutMs,
      "seo_finalizer_oracle_narrative",
    );
    recordSuccess(modelRequest.modelTag);

    const sanitized = sanitizeReasoningOutput(raw);
    const extracted = extractJson<OracleNarrativeOutput>(sanitized.text);
    return extracted.ok ? extracted.data : null;
  } catch (error) {
    recordFailure(modelRequest.modelTag);
    log.warn({ modelTag: modelRequest.modelTag, error }, "Oracle caption narrative generation failed");
    return null;
  } finally {
    orchestrator.onModelCallComplete(modelRequest.modelTag);
    // SINGLE-7B LOCK: Evict Oracle before loading Pilot
    await orchestrator.unloadModel(modelRequest.modelTag).catch(() => {});
  }
}

// ─── Pilot Hashtag Generator ──────────────────────────────────────────────────

async function callPilotHashtags(
  input: CaptionGenerationInput,
  narrativeContext: string,
  signal?: AbortSignal,
): Promise<PilotHashtagOutput | null> {
  const orchestrator = ModelOrchestrator.getInstance();
  const pilotTag = isLowRamVideoMode()
    ? LOW_RAM_VIDEO_MODEL
    : resolveCanonicalTag(loadEnv().SWARMX_MODEL_FAST);
  const callConfig = getAdaptiveCallConfig(pilotTag, "fast_chat");

  if (callConfig.circuitOpen) {
    log.warn({ modelTag: pilotTag }, "Pilot circuit open — skipping hashtag generation");
    return null;
  }

  let modelRequest;
  try {
    modelRequest = await orchestrator.requestModel(callConfig.modelTag);
  } catch (err) {
    log.warn({ modelTag: callConfig.modelTag, error: err }, "Failed to request Pilot model");
    return null;
  }

  const prompt = [
    `Platform: ${input.platform}`,
    `Topic: ${input.topic}`,
    `Caption Narrative: ${narrativeContext}`,
    "Generate a structured hashtag set for SEO discoverability.",
    "Output strict JSON only with keys: broad, niche, trending.",
    "Rules:",
    "- broad: 1 to 2 wide-reach discovery hashtags (e.g., #buildinpublic, #tech)",
    "- niche: at least 1 highly specific community hashtag (e.g., #nextjs14, #fintech)",
    "- NEVER include #fyp, #viral, #foryou, or #trending in any category",
    "- trending: at most 1 trending hashtag (or empty array [] if none)",
    "- Total hashtags across all 3 categories must sum to 3, 4, or 5.",
  ].join("\n\n");

  try {
    const { text: raw } = await withTimeout(
      generateOllamaText({
        model: modelRequest.modelTag,
        prompt: [
          "You generate high-performing short-form video hashtags.",
          "Output JSON only with keys: broad, niche, trending.",
          prompt,
        ].join("\n\n"),
        ...(signal ? { signal } : {}),
        maxTokens: modelRequest.overrides.num_predict ?? callConfig.overrides.num_predict ?? 256,
        overrides: {
          ...callConfig.overrides,
          ...modelRequest.overrides,
          temperature: 0.2,
        },
      }),
      callConfig.timeoutMs,
      "seo_finalizer_pilot_hashtags",
    );
    recordSuccess(modelRequest.modelTag);

    const sanitized = sanitizeReasoningOutput(raw);
    const extracted = extractJson<PilotHashtagOutput>(sanitized.text);
    return extracted.ok ? extracted.data : null;
  } catch (error) {
    recordFailure(modelRequest.modelTag);
    log.warn({ modelTag: modelRequest.modelTag, error }, "Pilot hashtag generation failed");
    return null;
  } finally {
    orchestrator.onModelCallComplete(modelRequest.modelTag);
  }
}

// ─── Normalization & Validation ───────────────────────────────────────────────

function normalizeHashtag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function validateCaption(
  draft: CaptionDraft,
  platform: VideoExportPlatform,
): CaptionValidation {
  const violations: string[] = [];

  if (draft.firstLine.length > CAPTION_RULES.firstLineMaxChars) {
    violations.push(`firstLine must be <= ${CAPTION_RULES.firstLineMaxChars} characters`);
  }

  if (CAPTION_RULES.disallowedOpenerRegex.test(draft.firstLine.trim())) {
    violations.push("firstLine cannot start with I, My, This, We, or Our");
  }

  if (draft.hashtags.niche.length === 0) {
    violations.push("hashtags.niche must contain at least 1 community tag");
  }

  const allTags = [
    ...draft.hashtags.broad,
    ...draft.hashtags.niche,
    ...draft.hashtags.trending,
  ];

  const forbiddenFound = allTags.filter((t) =>
    CAPTION_RULES.forbiddenHashtags.has(t.toLowerCase())
  );
  if (forbiddenFound.length > 0) {
    violations.push(`hashtags cannot contain forbidden tags (${forbiddenFound.join(", ")})`);
  }

  if (allTags.length < CAPTION_RULES.hashtagMin || allTags.length > CAPTION_RULES.hashtagMax) {
    violations.push(`total hashtag count must be between ${CAPTION_RULES.hashtagMin} and ${CAPTION_RULES.hashtagMax}`);
  }

  if (draft.hashtags.trending.length > CAPTION_RULES.trendingHashtagMax) {
    violations.push(`hashtags.trending must contain at most ${CAPTION_RULES.trendingHashtagMax} tag`);
  }

  if (CAPTION_RULES.hashtagsInBodyProhibited && (/#\w+/.test(draft.firstLine) || /#\w+/.test(draft.body))) {
    violations.push("hashtags must not appear in firstLine or body");
  }

  if (CAPTION_RULES.soundSuggestionNoUrl && draft.soundSuggestion && /(https?:\/\/|www\.|spotify|soundcloud|apple\s*music)/i.test(draft.soundSuggestion)) {
    violations.push("soundSuggestion must be descriptive text and cannot include a URL");
  }

  if (
    CAPTION_RULES.soundSuggestionNoArtist &&
    draft.soundSuggestion &&
    /\b(feat\.?|ft\.?|by\s+[A-Z][a-z]+|\"[^\"]+\"|song|track|album)\b/i.test(draft.soundSuggestion)
  ) {
    violations.push("soundSuggestion must describe tempo, energy, and instruments only");
  }

  const fullCaption = `${draft.firstLine}\n\n${draft.body}\n\n${draft.cta}\n\n${allTags.join(" ")}`.trim();
  const platformKey = platform === "shorts" ? "shorts" : platform === "reels" ? "reels" : "tiktok";
  const caps = PLATFORM_CHAR_CAPS[platformKey];

  if (fullCaption.length > caps.hard) {
    violations.push(`full caption (${fullCaption.length} chars) exceeds ${platformKey} hard cap of ${caps.hard} chars`);
  }

  const emojiCount = (fullCaption.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  if (emojiCount > CAPTION_RULES.maxEmojiInFullCaption) {
    violations.push(`caption must contain <= ${CAPTION_RULES.maxEmojiInFullCaption} emojis`);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function buildDeterministicCaptionDraft(
  input: CaptionGenerationInput,
  scriptText?: string,
): CaptionDraft {
  let firstLine = "The crucial shift you cannot ignore.";
  if (scriptText) {
    const hookMatch = scriptText.match(/\[HOOK\]([\s\S]*?)(?=\[BODY\]|\[RESOLUTION\]|\[CTA\]|$)/i);
    const hookLine = hookMatch && hookMatch[1] ? hookMatch[1].trim() : "";
    if (hookLine && hookLine.length <= 40 && !CAPTION_RULES.disallowedOpenerRegex.test(hookLine)) {
      firstLine = hookLine;
    }
  }

  const cleanNiche = (input.topic.toLowerCase().replace(/[^a-z0-9]/g, "") || "techtips").slice(0, 15);
  const nicheTag = `#${cleanNiche}`;

  return {
    firstLine,
    body: "Breakdown of the core framework and how to apply it immediately.",
    cta: "Save this before your next build.",
    hashtags: {
      broad: ["#buildinpublic", "#creator"],
      niche: [nicheTag],
      trending: [],
    },
    soundSuggestion: "Upbeat electronic with rising tension, 120-130 BPM, fast-cut bass",
  };
}

export async function generateFinalizerCaptionDraft(
  input: CaptionGenerationInput,
): Promise<CaptionGenerationResult> {
  const narrative = await callOracleNarrative(input, input.signal);
  const narrativeText = narrative ? `${narrative.firstLine} ${narrative.body}` : input.topic;
  const hashtagSet = await callPilotHashtags(input, narrativeText, input.signal);

  const fallback = buildDeterministicCaptionDraft(input, input.scriptText);

  // Assemble and repair
  let firstLine = (narrative?.firstLine || fallback.firstLine).trim();
  if (firstLine.length > CAPTION_RULES.firstLineMaxChars) {
    firstLine = firstLine.slice(0, CAPTION_RULES.firstLineMaxChars).trim();
  }
  if (CAPTION_RULES.disallowedOpenerRegex.test(firstLine)) {
    firstLine = fallback.firstLine;
  }

  const body = (narrative?.body || fallback.body).replace(/#\w+/g, "").trim();
  const cta = (narrative?.cta || fallback.cta).trim();
  let soundSuggestion = narrative?.soundSuggestion || fallback.soundSuggestion;
  if (
    soundSuggestion &&
    (/(https?:\/\/|www\.|spotify|soundcloud|apple\s*music)/i.test(soundSuggestion) ||
      /\b(feat\.?|ft\.?|by\s+[A-Z][a-z]+|\"[^\"]+\"|song|track|album)\b/i.test(soundSuggestion))
  ) {
    soundSuggestion = fallback.soundSuggestion;
  }

  const rawBroad = (hashtagSet?.broad ?? fallback.hashtags.broad).map(normalizeHashtag).filter(Boolean);
  const rawNiche = (hashtagSet?.niche ?? fallback.hashtags.niche)
    .map(normalizeHashtag)
    .filter((t) => Boolean(t) && !CAPTION_RULES.forbiddenHashtags.has(t.toLowerCase()));
  const rawTrending = (hashtagSet?.trending ?? fallback.hashtags.trending)
    .map(normalizeHashtag)
    .filter((t) => Boolean(t) && !CAPTION_RULES.forbiddenHashtags.has(t.toLowerCase()))
    .slice(0, 1);

  const niche = rawNiche.length > 0 ? rawNiche : fallback.hashtags.niche;
  const broad = rawBroad.length > 0 ? rawBroad.slice(0, 2) : fallback.hashtags.broad;
  const trending = rawTrending;

  const draft: CaptionDraft = {
    firstLine,
    body,
    cta,
    hashtags: { broad, niche, trending },
    ...(soundSuggestion ? { soundSuggestion } : {}),
  };

  const validation = validateCaption(draft, input.platform);
  return { draft, validation };
}

export async function generateCaptionDraft(input: CaptionGenerationInput): Promise<CaptionDraft> {
  const result = await generateFinalizerCaptionDraft(input);
  return result.draft;
}

export async function generateCaptionDraftWithValidation(
  input: CaptionGenerationInput,
): Promise<CaptionGenerationResult> {
  return generateFinalizerCaptionDraft(input);
}
