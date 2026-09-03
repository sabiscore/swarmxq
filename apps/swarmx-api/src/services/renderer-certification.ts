import type {
  CertificationTier,
  CreativeFactoryExecutionMode,
  RendererCapabilityTier,
} from "@swarmx/types/video-types";
import { log } from "../lib/logger.js";

const SUCCESS_CHAIN_RANK: Partial<Record<CertificationTier, number>> = {
  TECHNICALLY_VALID: 1,
  CREATIVE_REVIEW_REQUIRED: 2,
  PRODUCTION_PACK_VALID: 3,
  READY_TO_POST: 4,
  PUBLISHING: 5,
  PUBLISHED_VERIFIED: 6,
};

const CERTIFICATION_CEILING: Record<RendererCapabilityTier, CertificationTier> = {
  ffmpeg_text_smoke: "TECHNICALLY_VALID",
  ffmpeg_kinetic_text: "PUBLISHED_VERIFIED",
  ffmpeg_faceless_broll: "PUBLISHED_VERIFIED",
  ffmpeg_cinematic_explainer: "PUBLISHED_VERIFIED",
  modal_wan22_l4: "READY_TO_POST",
  modal_ltx_video: "READY_TO_POST",
  optional_adapter: "PRODUCTION_PACK_VALID",
};

// Per-mode cert ceiling. QUICK_DRAFT tops out at TECHNICALLY_VALID by design
// (proxy render, no production polish). Higher modes let the renderer ceiling
// dominate.
const MODE_CERT_CEILING: Record<CreativeFactoryExecutionMode, CertificationTier> = {
  QUICK_DRAFT: "TECHNICALLY_VALID",
  PLAN_ONLY: "CREATIVE_REVIEW_REQUIRED",
  PRODUCTION_PACK: "PRODUCTION_PACK_VALID",
  FULL_RENDER: "READY_TO_POST",
  PUBLISH_BUNDLE: "READY_TO_POST",
  PUBLISH_AND_LEARN: "PUBLISHED_VERIFIED",
};

export function getRendererCertificationCeiling(tier: RendererCapabilityTier): CertificationTier {
  return CERTIFICATION_CEILING[tier];
}

export function getModeCertificationCeiling(mode: CreativeFactoryExecutionMode): CertificationTier {
  return MODE_CERT_CEILING[mode];
}

export function clampCertificationTier(
  desired: CertificationTier,
  tier: RendererCapabilityTier,
): CertificationTier {
  const desiredRank = SUCCESS_CHAIN_RANK[desired];
  if (desiredRank === undefined) return desired;
  const ceiling = CERTIFICATION_CEILING[tier];
  const ceilingRank = SUCCESS_CHAIN_RANK[ceiling] ?? 0;
  if (desiredRank <= ceilingRank) return desired;
  log.warn({
    code: "CERT_TIER_CLAMPED_BY_RENDERER",
    renderer: tier,
    requested: desired,
    clampedTo: ceiling,
  }, "certification tier clamped to renderer ceiling");
  return ceiling;
}

export function canPromoteTo(
  current: CertificationTier,
  target: CertificationTier,
  tier: RendererCapabilityTier,
): boolean {
  const currentRank = SUCCESS_CHAIN_RANK[current];
  const targetRank = SUCCESS_CHAIN_RANK[target];
  if (currentRank === undefined || targetRank === undefined) return false;
  if (targetRank <= currentRank) return false;
  const ceilingRank = SUCCESS_CHAIN_RANK[CERTIFICATION_CEILING[tier]] ?? 0;
  return targetRank <= ceilingRank;
}

// ─── INV-18: lateral cert-tier transitions ───────────────────────────────────
// PUBLISH_FAILED / BLOCKED / NEEDS_REVISION are off-ladder tiers — they are not
// part of the SUCCESS_CHAIN_RANK monotone success ladder because modeling them
// as ranks would corrupt clampCertificationTier() semantics (a "BLOCKED clamp
// against a renderer ceiling" is meaningless). Instead, entering these tiers
// requires calling an explicit transition function that validates the source
// tier + captures an audit reason.
//
// PUBLISHING is on the success chain (rank 5) but is fenced behind
// transitionToPublishing() so upload attempts are logged consistently.
//
// Callers MUST NOT write these four tiers via direct assignment — the plan
// gate `grep -rn 'certificationTier\s*=' ... | grep -v transitionTo|clamp...`
// enforces this by convention. A lint rule is a future P2 item.

const LATERAL_TERMINAL_TIERS = new Set<CertificationTier>([
  "PUBLISHED_VERIFIED",
  "PUBLISH_FAILED",
  "BLOCKED",
  "RENDER_FAILED",
]);

export type CertTierTransition = { ok: true } | { ok: false; reason: string };

function accept(from: CertificationTier, to: CertificationTier, reason?: string): CertTierTransition {
  log.info({
    code: "CERT_TIER_TRANSITION",
    from,
    to,
    ...(reason ? { transitionReason: reason } : {}),
  }, "certification tier transition accepted");
  return { ok: true };
}

function reject(from: CertificationTier, to: CertificationTier, reason: string): CertTierTransition {
  log.warn({
    code: "CERT_TIER_TRANSITION_REJECTED",
    from,
    to,
    reason,
  }, "certification tier transition rejected");
  return { ok: false, reason };
}

export function transitionToPublishing(current: CertificationTier): CertTierTransition {
  if (current !== "READY_TO_POST") {
    return reject(current, "PUBLISHING", `publish requires READY_TO_POST, was ${current}`);
  }
  return accept(current, "PUBLISHING");
}

export function transitionToPublishFailed(current: CertificationTier): CertTierTransition {
  if (current !== "PUBLISHING") {
    return reject(current, "PUBLISH_FAILED", `publish-failed requires PUBLISHING, was ${current}`);
  }
  return accept(current, "PUBLISH_FAILED");
}

export function transitionToBlocked(
  current: CertificationTier,
  reason: string,
): CertTierTransition {
  if (!reason || reason.trim().length === 0) {
    return reject(current, "BLOCKED", "block reason is required");
  }
  if (LATERAL_TERMINAL_TIERS.has(current)) {
    return reject(current, "BLOCKED", `cannot block from terminal tier ${current}`);
  }
  return accept(current, "BLOCKED", reason);
}

export function transitionToNeedsRevision(
  current: CertificationTier,
  failedDomain: string,
): CertTierTransition {
  if (!failedDomain || failedDomain.trim().length === 0) {
    return reject(current, "NEEDS_REVISION", "failedDomain is required");
  }
  const currentRank = SUCCESS_CHAIN_RANK[current];
  const threshold = SUCCESS_CHAIN_RANK["CREATIVE_REVIEW_REQUIRED"] ?? 2;
  if (currentRank === undefined || currentRank < threshold) {
    return reject(
      current,
      "NEEDS_REVISION",
      `needs-revision requires >=CREATIVE_REVIEW_REQUIRED, was ${current}`,
    );
  }
  return accept(current, "NEEDS_REVISION", `failedDomain=${failedDomain}`);
}
