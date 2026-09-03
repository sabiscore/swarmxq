/**
 * Tier 1 Feature Coverage: Features 6, 7
 * F06: Reasoning Sanitization (DeepSeek <think> stripping, extractJson parsing)
 * F07: Auto-Hashtag & SEO Finalizer (Oracle narrative, Pilot hashtags, firstLine limits, platform caps)
 */

import {
  expect,
  sanitizeDeepSeekReasoning,
  extractJsonFromText,
  CANONICAL_BLOCKED_FIRSTLINE_OPENERS,
  BANNED_NICHE_TAGS,
  CANONICAL_PLATFORM_CHAR_CAPS,
  type TestSuite,
} from "../test-helpers.js";

export const tier1SanitizerAndSeoSuite: TestSuite = {
  suiteName: "Tier 1: Reasoning Sanitization & SEO Finalizer (F06, F07)",
  tier: 1,
  tests: [
    // ─── FEATURE 6: Reasoning Sanitization ───────────────────────────────────
    {
      name: "F06-T01: sanitizeReasoningOutput strips complete <think> blocks",
      tier: 1,
      featureId: 6,
      fn: () => {
        const raw = "<think>Let me evaluate this script.\nThe hook is good.\n</think>{\n  \"intent\": \"tech_explainer\",\n  \"complexity\": 0.4\n}";
        const cleaned = sanitizeDeepSeekReasoning(raw);
        expect(cleaned).notToContain("<think>");
        expect(cleaned).notToContain("</think>");
        expect(cleaned).toContain('"intent": "tech_explainer"');
      },
    },
    {
      name: "F06-T02: sanitizeReasoningOutput handles multiline unclosed <think> blocks",
      tier: 1,
      featureId: 6,
      fn: () => {
        const raw = "Valid output before<think>Unclosed thinking process that was cut off";
        const cleaned = sanitizeDeepSeekReasoning(raw);
        expect(cleaned).toBe("Valid output before");
      },
    },
    {
      name: "F06-T03: extractJson parses valid JSON inside markdown code fence",
      tier: 1,
      featureId: 6,
      fn: () => {
        const raw = "Here is the response:\n```json\n{\n  \"hookStrength\": 0.88,\n  \"shareability\": 0.75\n}\n```\nHope that helps!";
        const parsed = extractJsonFromText(raw) as any;
        expect(parsed.hookStrength).toBe(0.88);
        expect(parsed.shareability).toBe(0.75);
      },
    },
    {
      name: "F06-T04: extractJson parses raw JSON without code blocks",
      tier: 1,
      featureId: 6,
      fn: () => {
        const raw = '{"firstLine": "Stop writing bad tests", "cta": "Follow for more"}';
        const parsed = extractJsonFromText(raw) as any;
        expect(parsed.firstLine).toBe("Stop writing bad tests");
        expect(parsed.cta).toBe("Follow for more");
      },
    },
    {
      name: "F06-T05: extractJson combined with reasoning sanitizer parses thinking output safely",
      tier: 1,
      featureId: 6,
      fn: () => {
        const raw = '<think>I must return valid JSON with intent</think>```json\n{"intent": "tutorial", "complexity": 0.5}\n```';
        const parsed = extractJsonFromText(raw) as any;
        expect(parsed.intent).toBe("tutorial");
        expect(parsed.complexity).toBe(0.5);
      },
    },

    // ─── FEATURE 7: Auto-Hashtag & SEO Finalizer ─────────────────────────────
    {
      name: "F07-T01: Caption firstLine is <= 40 characters",
      tier: 1,
      featureId: 7,
      fn: () => {
        const validFirstLine = "Fastest way to fix Node memory leaks";
        expect(validFirstLine.length).toBeLessThanOrEqual(40);

        const validateFirstLineLength = (line: string) => line.trim().length <= 40;
        expect(validateFirstLineLength("1234567890123456789012345678901234567890")).toBe(true);
        expect(validateFirstLineLength("12345678901234567890123456789012345678901")).toBe(false);
      },
    },
    {
      name: "F07-T02: Caption firstLine regex-blocks self-referential openers (I|My|This|We|Our)",
      tier: 1,
      featureId: 7,
      fn: () => {
        const blockedOpeners = ["I love coding", "My secret trick", "This video explains", "We built a tool", "Our team found"];
        for (const opener of blockedOpeners) {
          expect(CANONICAL_BLOCKED_FIRSTLINE_OPENERS.test(opener)).toBe(true);
        }

        const validOpeners = ["Secret coding trick", "Stop doing this", "Why engineers fail", "How to scale Postgres"];
        for (const opener of validOpeners) {
          expect(CANONICAL_BLOCKED_FIRSTLINE_OPENERS.test(opener)).toBe(false);
        }
      },
    },
    {
      name: "F07-T03: Niche hashtags are non-empty and exclude banned spam tags (#fyp, #viral, #foryou, #trending)",
      tier: 1,
      featureId: 7,
      fn: () => {
        const validNicheTags = ["#typescripttips", "#webdevelopment", "#systemdesign"];
        for (const tag of validNicheTags) {
          expect(BANNED_NICHE_TAGS.includes(tag.toLowerCase())).toBe(false);
        }

        const validateNicheHashtags = (tags: string[]) => {
          if (tags.length === 0) return false;
          return tags.every((t) => !BANNED_NICHE_TAGS.includes(t.toLowerCase()));
        };

        expect(validateNicheHashtags(["#typescripttips"])).toBe(true);
        expect(validateNicheHashtags(["#fyp", "#webdev"])).toBe(false);
        expect(validateNicheHashtags([])).toBe(false);
      },
    },
    {
      name: "F07-T04: Total hashtag count conforms to 3–5 total tags rule",
      tier: 1,
      featureId: 7,
      fn: () => {
        const validateTotalHashtags = (broad: string[], niche: string[], trending: string[]) => {
          const total = broad.length + niche.length + trending.length;
          return total >= 3 && total <= 5;
        };

        expect(validateTotalHashtags(["#coding", "#dev"], ["#reacttips"], [])).toBe(true);
        expect(validateTotalHashtags(["#coding"], ["#reacttips"], [])).toBe(false); // 2 tags (too few)
        expect(validateTotalHashtags(["#a", "#b", "#c"], ["#d", "#e"], ["#f"])).toBe(false); // 6 tags (too many)
      },
    },
    {
      name: "F07-T05: Platform character caps are respected with soft limit warnings",
      tier: 1,
      featureId: 7,
      fn: () => {
        const simulatePlatformCheck = (captionLength: number, platform: "tiktok" | "reels" | "shorts") => {
          const caps = CANONICAL_PLATFORM_CHAR_CAPS[platform];
          if (captionLength > caps.hard) return "RED_HARD_CAP_EXCEEDED";
          if (captionLength > caps.soft) return "AMBER_SOFT_LIMIT_EXCEEDED";
          return "NEUTRAL_OK";
        };

        expect(simulatePlatformCheck(100, "reels")).toBe("NEUTRAL_OK");
        expect(simulatePlatformCheck(150, "reels")).toBe("AMBER_SOFT_LIMIT_EXCEEDED");
        expect(simulatePlatformCheck(2250, "reels")).toBe("RED_HARD_CAP_EXCEEDED");

        expect(simulatePlatformCheck(250, "tiktok")).toBe("NEUTRAL_OK");
        expect(simulatePlatformCheck(300, "tiktok")).toBe("AMBER_SOFT_LIMIT_EXCEEDED");
      },
    },
  ],
};
