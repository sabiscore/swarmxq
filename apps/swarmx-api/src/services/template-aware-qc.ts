/**
 * Template-aware QC interpreter — maps raw frame/audio detector findings to
 * renderer-tier-specific interpretations.
 *
 * Raw detectors (blank frame count, freeze frame count) are not aware of template intent.
 * This module provides the context layer: a finding that is a blocker in one template
 * may be planned behaviour in another (e.g. dark backgrounds in kinetic_text).
 *
 * Records separately: raw finding · planned template event · interpreted result.
 * Template context never overrides MISSING_AUDIO or FIRST_FRAME_EMPTY — those are
 * unconditional blockers regardless of renderer tier.
 */
import type {
  RawQcFinding,
  QcFindingInterpretation,
  TemplateQcResult,
  RendererCapabilityTier,
} from "@swarmx/types/video-types";

type FindingType = RawQcFinding["type"];

interface TierRule {
  isExpected: (f: RawQcFinding) => boolean;
  plannedEvent: (f: RawQcFinding) => string | null;
  interpretedSeverity: (f: RawQcFinding) => QcFindingInterpretation["interpretedSeverity"];
  notes: (f: RawQcFinding) => string;
}

// Unconditional blockers — no template tier can override these
const UNCONDITIONAL_BLOCKERS: ReadonlySet<FindingType> = new Set([
  "MISSING_AUDIO",
  "FIRST_FRAME_EMPTY",
]);

const KINETIC_TEXT_HOLD_BUDGET_SEC = 6;

const TIER_RULES: Record<RendererCapabilityTier, Partial<Record<FindingType, TierRule>>> = {
  ffmpeg_text_smoke: {
    BLACK_FRAME: {
      isExpected: (f) => f.durationSec <= 5,
      plannedEvent: (f) => f.durationSec <= 5 ? "text card background" : null,
      interpretedSeverity: (f) => f.durationSec <= 5 ? "NONE" : "MEDIUM",
      notes: () => "Text smoke renderer uses solid card background; short dark frames are expected",
    },
    FREEZE_FRAME: {
      isExpected: () => true,
      plannedEvent: () => "static text card — no motion expected",
      interpretedSeverity: () => "NONE",
      notes: () => "Smoke renderer produces a static card; freeze is expected throughout",
    },
  },

  ffmpeg_kinetic_text: {
    BLACK_FRAME: {
      isExpected: () => true,
      plannedEvent: () => "intentional dark background for kinetic text",
      interpretedSeverity: () => "NONE",
      notes: () => "Kinetic text templates use dark backgrounds for contrast; black frames are by design",
    },
    FREEZE_FRAME: {
      isExpected: (f) => f.durationSec <= KINETIC_TEXT_HOLD_BUDGET_SEC,
      plannedEvent: (f) => f.durationSec <= KINETIC_TEXT_HOLD_BUDGET_SEC ? "text hold — deliberate static moment" : null,
      interpretedSeverity: (f) => f.durationSec <= KINETIC_TEXT_HOLD_BUDGET_SEC ? "NONE" : "MEDIUM",
      notes: (f) =>
        f.durationSec <= KINETIC_TEXT_HOLD_BUDGET_SEC
          ? "Kinetic text on the CPU renderer uses longer deliberate text holds while narration catches up"
          : `Freeze of ${f.durationSec}s exceeds kinetic text hold budget (${KINETIC_TEXT_HOLD_BUDGET_SEC}s) — may indicate missing animation`,
    },
  },

  ffmpeg_faceless_broll: {
    BLACK_FRAME: {
      isExpected: (f) => f.durationSec <= 2,
      plannedEvent: (f) => f.durationSec <= 2 ? "scene transition" : null,
      interpretedSeverity: (f) => f.durationSec <= 2 ? "NONE" : "HIGH",
      notes: (f) =>
        f.durationSec <= 2
          ? "Short black frames between b-roll clips are expected transitions"
          : `Black frame of ${f.durationSec}s exceeds transition budget — may indicate missing asset`,
    },
    FREEZE_FRAME: {
      isExpected: (f) => f.durationSec <= 10,
      plannedEvent: (f) => f.durationSec <= 10 ? "static b-roll during narration" : null,
      interpretedSeverity: (f) => f.durationSec <= 10 ? "NONE" : "HIGH",
      notes: (f) =>
        f.durationSec <= 10
          ? "Static b-roll clips are expected while narration plays"
          : `Freeze of ${f.durationSec}s exceeds b-roll hold budget (10s) — likely corrupt or missing asset`,
    },
  },

  ffmpeg_cinematic_explainer: {
    BLACK_FRAME: {
      isExpected: (f) => f.durationSec <= 2,
      plannedEvent: (f) => f.durationSec <= 2 ? "cinematic scene transition" : null,
      interpretedSeverity: (f) => f.durationSec <= 2 ? "NONE" : "MEDIUM",
      notes: (f) =>
        f.durationSec <= 2
          ? "Short black frames are cinematic cut-to-black transitions"
          : `Black frame of ${f.durationSec}s may indicate a missing scene asset`,
    },
    FREEZE_FRAME: {
      isExpected: (f) => f.durationSec <= 3,
      plannedEvent: (f) => f.durationSec <= 3 ? "cinematic hold" : null,
      interpretedSeverity: (f) => {
        if (f.durationSec <= 3) return "NONE";
        if (f.durationSec <= 8) return "MEDIUM";
        return "HIGH";
      },
      notes: (f) =>
        f.durationSec <= 3
          ? "Short freeze within cinematic explainer is a planned hold"
          : `Freeze of ${f.durationSec}s is unexpectedly long for a cinematic explainer`,
    },
  },

  optional_adapter: {
    // Optional adapters (ComfyUI etc.) get no template-specific rules.
    // All findings pass through at raw severity.
  },
  modal_wan22_l4: {},
  modal_ltx_video: {},
};

// Remote generated segments are treated conservatively: raw findings pass
// through unless a renderer-specific rule is added later. This keeps the
// certification gate fail-closed for unexpected high-severity defects.
Object.assign(TIER_RULES.modal_wan22_l4!, TIER_RULES.ffmpeg_faceless_broll);
Object.assign(TIER_RULES.modal_ltx_video!, TIER_RULES.ffmpeg_faceless_broll);

export function interpretFinding(
  finding: RawQcFinding,
  tier: RendererCapabilityTier,
): QcFindingInterpretation {
  // Unconditional blockers are never expected — no template overrides them
  if (UNCONDITIONAL_BLOCKERS.has(finding.type)) {
    return {
      raw: finding,
      rendererTier: tier,
      plannedEvent: null,
      isExpected: false,
      interpretedSeverity: "HIGH",
      notes: `${finding.type} is an unconditional blocker regardless of renderer tier`,
    };
  }

  const rule = TIER_RULES[tier]?.[finding.type];

  if (!rule) {
    // No tier-specific rule — pass through raw severity
    return {
      raw: finding,
      rendererTier: tier,
      plannedEvent: null,
      isExpected: false,
      interpretedSeverity: finding.severity,
      notes: `No template rule for ${finding.type} in ${tier} — using raw severity`,
    };
  }

  const isExpected = rule.isExpected(finding);
  const interpretedSeverity = rule.interpretedSeverity(finding);

  return {
    raw: finding,
    rendererTier: tier,
    plannedEvent: rule.plannedEvent(finding),
    isExpected,
    interpretedSeverity,
    notes: rule.notes(finding),
  };
}

export function runTemplateQc(
  findings: RawQcFinding[],
  tier: RendererCapabilityTier,
): TemplateQcResult {
  const interpretations = findings.map((f) => interpretFinding(f, tier));

  const blockers = interpretations.filter(
    (i) => i.interpretedSeverity === "HIGH" && !i.isExpected,
  );
  const warnings = interpretations.filter(
    (i) => i.interpretedSeverity === "MEDIUM" && !i.isExpected,
  );

  return {
    pass: blockers.length === 0,
    rendererTier: tier,
    rawFindings: findings,
    interpretations,
    blockers,
    warnings,
  };
}
