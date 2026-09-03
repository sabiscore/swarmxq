/**
 * Canonical render-backend contract.
 *
 * The six-stage video orchestrator remains the lifecycle owner; concrete
 * backends only execute rendering work. This keeps ComfyUI, Modal and future
 * providers behind one audited capability boundary.
 */
import type { RendererCapabilityTier } from "@swarmx/types/video-types";
import type { VideoJobRequest } from "../types/video.js";

export interface RenderSegmentTask {
  jobId: string;
  segmentId: string;
  prompt: string;
  negativePrompt?: string;
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  seed: number;
  referenceImagePath?: string;
}

export interface RenderSegmentArtifact {
  segmentId: string;
  path: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  checksum?: string;
}

export interface RenderBackendCapabilities {
  tier: RendererCapabilityTier;
  remote: boolean;
  supportsSegmentFanout: boolean;
  maxConcurrentSegments: number;
  supportedAspectRatios: Array<"9:16" | "1:1" | "16:9">;
}

export interface RenderBackend {
  readonly capabilities: RenderBackendCapabilities;
  isAvailable(signal?: AbortSignal): Promise<boolean>;
  renderSegments(
    request: VideoJobRequest,
    tasks: RenderSegmentTask[],
    signal?: AbortSignal,
  ): Promise<RenderSegmentArtifact[]>;
  cancel?(jobId: string): Promise<void>;
}
