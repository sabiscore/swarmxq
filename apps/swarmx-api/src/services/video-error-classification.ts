import type { VideoErrorCode, VideoJobError } from "../types/video.js";

const KNOWN_VIDEO_ERROR_CODES: ReadonlySet<string> = new Set<VideoErrorCode>([
  "PRESSURE_CRITICAL",
  "TIMEOUT",
  "OLLAMA_UNAVAILABLE",
  "COMFY_UNAVAILABLE",
  "COMFY_OUTPUT_DIR_MISSING",
  "COMFY_OUTPUT_PATH_TRAVERSAL",
  "COMFY_PROTOCOL_ERROR",
  "SCRIPTING_FAILED",
  "STORYBOARD_FAILED",
  "RENDER_FAILED",
  "RENDER_BACKEND_INVALID",
  "MODAL_RENDER_REQUEST_FAILED",
  "MODAL_RENDER_UNAVAILABLE",
  "WORD_ALIGNMENT_UNAVAILABLE",
  "WORD_ALIGNMENT_FAILED",
  "ASSET_WRITE_FAILED",
  "ARTIFACT_PATH_TRAVERSAL",
  "ARTIFACT_MISSING",
  "ARTIFACT_EMPTY",
  "ARTIFACT_INVALID",
  "STUB_RENDER_DISABLED",
  "FFMPEG_UNAVAILABLE",
  "FFPROBE_UNAVAILABLE",
  "ESPEAK_UNAVAILABLE",
  "VOICE_PROVIDER_UNAVAILABLE",
  "FONT_UNAVAILABLE",
  "FRAME_BUDGET_EXCEEDED",
  "comfyui_ram_budget_exceeded",
  "INTENT_VALIDATION_FAILED",
  "SCRIPT_SCHEMA_INVALID",
  "CANCELLED_BY_USER",
  "UNKNOWN",
]);

const RETRYABLE_VIDEO_ERROR_CODES: ReadonlySet<string> = new Set<VideoErrorCode>([
  "TIMEOUT",
  "OLLAMA_UNAVAILABLE",
  "COMFY_UNAVAILABLE",
]);

function errorCode(error: unknown): VideoErrorCode {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "UNKNOWN";
  }

  const code = String((error as { code?: unknown }).code);
  return KNOWN_VIDEO_ERROR_CODES.has(code) ? (code as VideoErrorCode) : "UNKNOWN";
}

export function isRetryableVideoErrorCode(code: string): boolean {
  return RETRYABLE_VIDEO_ERROR_CODES.has(code);
}

export function toVideoJobError(error: unknown): VideoJobError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "CANCELLED_BY_USER",
      message: "Stage was aborted",
      retryable: false,
    };
  }

  const code = errorCode(error);
  const message = error instanceof Error ? error.message : "An unknown error occurred";
  return {
    code,
    message,
    retryable: isRetryableVideoErrorCode(code),
  };
}
