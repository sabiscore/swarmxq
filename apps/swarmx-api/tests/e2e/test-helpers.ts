/**
 * apps/swarmx-api/tests/e2e/test-helpers.ts
 * Shared assertion engine, mock fixtures, and test utilities for SwarmXQ E2E Test Suite.
 */

export interface TestContext {
  name: string;
  tier: 1 | 2 | 3 | 4;
  featureId?: number;
  passed: boolean;
  error?: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export type TestFn = () => Promise<void> | void;

export interface TestCase {
  name: string;
  tier: 1 | 2 | 3 | 4;
  featureId?: number;
  fn: TestFn;
}

export interface TestSuite {
  suiteName: string;
  tier: 1 | 2 | 3 | 4;
  tests: TestCase[];
}

export class AssertionError extends Error {
  constructor(message: string, public actual?: unknown, public expected?: unknown) {
    super(message);
    this.name = "AssertionError";
  }
}

export function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`, actual, expected);
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`, actual, expected);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be truthy`, actual, true);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be falsy`, actual, false);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError(`Expected value to be defined`, actual, "defined");
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be undefined`, actual, undefined);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new AssertionError(`Expected ${actual} to be > ${expected}`, actual, expected);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) {
        throw new AssertionError(`Expected ${actual} to be >= ${expected}`, actual, expected);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== "number" || actual >= expected) {
        throw new AssertionError(`Expected ${actual} to be < ${expected}`, actual, expected);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual > expected) {
        throw new AssertionError(`Expected ${actual} to be <= ${expected}`, actual, expected);
      }
    },
    toBeCloseTo(expected: number, precision = 4) {
      if (typeof actual !== "number" || Math.abs(actual - expected) > Math.pow(10, -precision) / 2) {
        throw new AssertionError(`Expected ${actual} to be close to ${expected} (precision ${precision})`, actual, expected);
      }
    },
    toContain(item: unknown) {
      if (typeof actual === "string" && typeof item === "string") {
        if (!actual.includes(item)) {
          throw new AssertionError(`Expected string "${actual}" to contain "${item}"`, actual, item);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new AssertionError(`Expected array ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`, actual, item);
        }
      } else {
        throw new AssertionError(`toContain not supported for type ${typeof actual}`);
      }
    },
    notToContain(item: unknown) {
      if (typeof actual === "string" && typeof item === "string") {
        if (actual.includes(item)) {
          throw new AssertionError(`Expected string "${actual}" NOT to contain "${item}"`, actual, item);
        }
      } else if (Array.isArray(actual)) {
        if (actual.includes(item)) {
          throw new AssertionError(`Expected array ${JSON.stringify(actual)} NOT to contain ${JSON.stringify(item)}`, actual, item);
        }
      }
    },
    toMatch(regex: RegExp) {
      if (typeof actual !== "string" || !regex.test(actual)) {
        throw new AssertionError(`Expected "${actual}" to match regex ${regex}`, actual, regex.toString());
      }
    },
    toThrow(expectedMessage?: string | RegExp) {
      if (typeof actual !== "function") {
        throw new AssertionError(`Expected target to be a function`);
      }
      let threw = false;
      let errorThrown: any;
      try {
        (actual as any)();
      } catch (err: any) {
        threw = true;
        errorThrown = err;
      }
      if (!threw) {
        throw new AssertionError(`Expected function to throw, but it did not`);
      }
      if (expectedMessage) {
        const msg = errorThrown?.message || String(errorThrown);
        if (typeof expectedMessage === "string" && !msg.includes(expectedMessage)) {
          throw new AssertionError(`Expected error message "${msg}" to contain "${expectedMessage}"`);
        } else if (expectedMessage instanceof RegExp && !expectedMessage.test(msg)) {
          throw new AssertionError(`Expected error message "${msg}" to match ${expectedMessage}`);
        }
      }
    },
  };
}

// ─── CANONICAL REFERENCE CONSTANTS FOR CONTRACT VERIFICATION ─────────────────

export const CANONICAL_TEMPLATES = [
  "myth-vs-fact",
  "pov-immersion",
  "listicle-countdown",
  "reddit-story",
] as const;

export const CANONICAL_TONES = [
  "educational",
  "urgent",
  "warm",
  "contrarian",
  "cinematic",
  "minimal",
  "faceless_broll",
  "kinetic_text",
] as const;

export const CANONICAL_STAGES_7 = [
  "intent_classification",
  "planning",
  "scripting",
  "auditor_review",
  "storyboard_generation",
  "render_assembly",
  "finalizing",
] as const;

export const CANONICAL_STAGE_PROGRESS_RANGES = {
  intent_classification: { start: 0, end: 15 },
  planning:              { start: 15, end: 25 },
  scripting:             { start: 25, end: 40 },
  auditor_review:        { start: 40, end: 50 },
  storyboard_generation: { start: 50, end: 70 },
  render_assembly:       { start: 70, end: 90 },
  finalizing:            { start: 90, end: 100 },
};

export const CANONICAL_PLATFORM_CHAR_CAPS = {
  tiktok: { hard: 2200, soft: 280 },
  reels:  { hard: 2200, soft: 125 },
  shorts: { hard: 5000, soft: 300 },
} as const;

export const CANONICAL_PROCEDURAL_PRESETS = [
  "gradient_flow",
  "fractal_noise",
  "plasma_pulse",
  "minimal_grid",
] as const;

export const CANONICAL_TONE_BACKGROUND_MAP: Record<string, string> = {
  cinematic:      "gradient_flow",
  warm:           "gradient_flow",
  educational:    "fractal_noise",
  faceless_broll: "fractal_noise",
  urgent:         "plasma_pulse",
  contrarian:     "plasma_pulse",
  minimal:        "minimal_grid",
  kinetic_text:   "minimal_grid",
};

export const CANONICAL_TONE_ACCENTS: Record<string, string> = {
  contrarian:     "#ff2222",
  urgent:         "#ff6600",
  educational:    "#3399ff",
  cinematic:      "#ddaa44",
  warm:           "#ff9966",
  minimal:        "#ffffff",
  faceless_broll: "#cccccc",
  kinetic_text:   "#39ff14",
};

export const CANONICAL_HOOK_BLOCKLIST = [
  "In today's video",
  "Welcome to",
  "Hi everyone",
  "Today we're going to",
  "Let's talk about",
  "In this video",
  "My name is",
  "Before we start",
  "Don't forget to",
  "Make sure to subscribe",
];

export const CANONICAL_BLOCKED_FIRSTLINE_OPENERS = /^(I|My|This|We|Our)\b/i;

export const BANNED_NICHE_TAGS = ["#fyp", "#viral", "#foryou", "#trending"];

export const CANONICAL_OPERATOR_MAP = {
  Relay: "route-phi4-lite-q4km-prod",
  Pilot: "instruct-phi4-pro-q8-prod",
  PilotLite: "instruct-phi4-lite-q4km-prod",
  Architect: "plan-qwen25-pro-q5km-prod",
  ArchitectDeep: "plan-deepseekr1-pro-q5km-prod",
  Oracle: "reason-deepseekr1-pro-q5km-prod",
  Forge: "code-qwen25-pro-q5km-prod",
  Auditor: "critique-deepseekr1-pro-q5km-prod",
  Lab: "synth-qwen25-exp-q4km-dev",
};

// ─── PURE SIMULATION & LOGIC ORACLES ──────────────────────────────────────────

export function computeViralityOverallScore(signal: {
  hookStrength: number;
  completionProxy: number;
  shareability: number;
  seoScore: number;
}): number {
  return Number(
    (
      signal.hookStrength * 0.35 +
      signal.completionProxy * 0.25 +
      signal.shareability * 0.25 +
      signal.seoScore * 0.15
    ).toFixed(4)
  );
}

export function validateHookCandidateHelper(hookText: string): {
  valid: boolean;
  wordCount: number;
  violation?: string;
  estimatedHookStrength: number;
} {
  const trimmed = hookText.trim();
  const words = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
  const wordCount = words.length;

  const violation = CANONICAL_HOOK_BLOCKLIST.find((phrase) =>
    trimmed.toLowerCase().startsWith(phrase.toLowerCase())
  );

  let hookStrength = 0.85;
  if (violation) {
    hookStrength = 0.25;
  } else if (wordCount > 18) {
    hookStrength = 0.45;
  } else if (CANONICAL_BLOCKED_FIRSTLINE_OPENERS.test(trimmed)) {
    hookStrength = 0.40;
  }

  const valid = !violation && wordCount <= 18 && hookStrength >= 0.55;

  return {
    valid,
    wordCount,
    violation,
    estimatedHookStrength: hookStrength,
  };
}

export function sanitizeDeepSeekReasoning(rawText: string): string {
  // Remove all <think>...</think> blocks including multiline and incomplete tags
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, "");
  return cleaned.trim();
}

export function extractJsonFromText(rawText: string): Record<string, unknown> | unknown[] {
  const sanitized = sanitizeDeepSeekReasoning(rawText);
  // Match JSON code blocks or raw JSON object/array
  const jsonBlockMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const target = jsonBlockMatch ? jsonBlockMatch[1] : sanitized;
  
  // Find outermost { } or [ ]
  const firstBrace = target.indexOf("{");
  const firstBracket = target.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = target.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = target.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonSub = target.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonSub);
  }

  return JSON.parse(target);
}

export function parseKineticEmphasis(text: string): {
  raw: string;
  hasAsteriskEmphasis: boolean;
  emphasizedWords: string[];
  allCapsWords: string[];
} {
  const asteriskMatches = [...text.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]);
  const words = text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
  const allCaps = words.filter((w) => w.length >= 2 && w === w.toUpperCase());

  return {
    raw: text,
    hasAsteriskEmphasis: asteriskMatches.length > 0,
    emphasizedWords: asteriskMatches,
    allCapsWords: allCaps,
  };
}

export function buildProceduralFfmpegFilter(
  preset: string,
  tone: string,
  width = 720,
  height = 1280
): string {
  const accent = CANONICAL_TONE_ACCENTS[tone] || "#3399ff";
  switch (preset) {
    case "gradient_flow":
      return `geq=r='128+64*sin(2*PI*(X/${width}+T*0.5))':g='64+32*cos(2*PI*(Y/${height}+T*0.3))':b='192+32*sin(T*0.4)'`;
    case "fractal_noise":
      return `geq=r='(mod(X*13+Y*17+T*100,255))':g='(mod(X*19+Y*23+T*80,255))':b='(mod(X*29+Y*31+T*60,255))',colorchannelmixer=rr=0.3:gg=0.4:bb=0.3`;
    case "plasma_pulse":
      return `geq=r='128+127*sin(sqrt((X-${width}/2)*(X-${width}/2)+(Y-${height}/2)*(Y-${height}/2))/30-T*3)':g='64+63*sin(T*2)':b='32+31*cos(T*2)'`;
    case "minimal_grid":
      return `drawgrid=w=60:h=60:t=1:c=white@0.15,geq=r='15':g='15':b='18'`;
    default:
      return `color=c=black:s=${width}x${height}`;
  }
}
