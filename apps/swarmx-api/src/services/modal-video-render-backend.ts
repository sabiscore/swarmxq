import type { VideoJobRequest } from "../types/video.js";
import { readRawEnv } from "../lib/env.js";
import type {
  RenderBackend,
  RenderBackendCapabilities,
  RenderSegmentArtifact,
  RenderSegmentTask,
} from "./video-render-backend.js";

interface ModalSubmitResponse {
  call_id: string;
}

interface ModalResultResponse {
  status: "pending" | "completed" | "failed";
  artifacts?: RenderSegmentArtifact[];
  error?: string;
}

function modalUrl(): string {
  const value = readRawEnv("SWARMX_MODAL_RENDER_URL")?.trim();
  if (!value) throw new Error("SWARMX_MODAL_RENDER_URL is not configured");
  return value.replace(/\/+$/, "");
}

function modalToken(): string | undefined {
  const token = readRawEnv("SWARMX_MODAL_RENDER_TOKEN")?.trim();
  return token || undefined;
}

async function requestJson<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    const token = modalToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: text.slice(0, 500) };
    }
    if (!response.ok) {
      const reason = typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error ?? response.status)
        : String(response.status);
      throw Object.assign(new Error(`Modal renderer request failed: ${reason}`), {
        code: "MODAL_RENDER_REQUEST_FAILED",
        status: response.status,
      });
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

function buildTasks(request: VideoJobRequest, tasks: RenderSegmentTask[]): RenderSegmentTask[] {
  return tasks.map((task) => ({
    ...task,
    jobId: task.jobId,
    durationSeconds: Math.max(1, Math.min(12, task.durationSeconds)),
    fps: Math.max(8, Math.min(30, task.fps)),
    width: Math.max(256, Math.min(1920, task.width)),
    height: Math.max(256, Math.min(1920, task.height)),
    ...(request.platform ? {} : {}),
  }));
}

export class ModalVideoRenderBackend implements RenderBackend {
  readonly capabilities: RenderBackendCapabilities = {
    // The shared type currently has an intentionally broad adapter tier;
    // the concrete provider id below prevents certification from being
    // inferred from an arbitrary plugin name.
    tier: "optional_adapter",
    remote: true,
    supportsSegmentFanout: true,
    maxConcurrentSegments: 4,
    supportedAspectRatios: ["9:16", "1:1", "16:9"],
  };

  async isAvailable(signal?: AbortSignal): Promise<boolean> {
    try {
      await requestJson<{ ok?: boolean }>(`${modalUrl()}/health`, { method: "GET" }, signal);
      return true;
    } catch {
      return false;
    }
  }

  async renderSegments(
    request: VideoJobRequest,
    tasks: RenderSegmentTask[],
    signal?: AbortSignal,
  ): Promise<RenderSegmentArtifact[]> {
    const payload = await requestJson<ModalSubmitResponse>(
      `${modalUrl()}/v1/render`,
      {
        method: "POST",
        body: JSON.stringify({
          request,
          tasks: buildTasks(request, tasks),
        }),
      },
      signal,
    );

    const callId = payload.call_id;
    if (!callId) throw new Error("Modal renderer returned no call_id");

    const deadline = Date.now() + 15 * 60_000;
    let delayMs = 1_000;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const result = await requestJson<ModalResultResponse>(
        `${modalUrl()}/v1/render/${encodeURIComponent(callId)}`,
        { method: "GET" },
        signal,
      );
      if (result.status === "completed") return result.artifacts ?? [];
      if (result.status === "failed") {
        throw Object.assign(new Error(result.error ?? "Modal render failed"), {
          code: "RENDER_FAILED",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(5_000, Math.round(delayMs * 1.5));
    }

    throw Object.assign(new Error("Modal render polling timed out"), { code: "TIMEOUT" });
  }

  async cancel(jobId: string): Promise<void> {
    try {
      await requestJson(`${modalUrl()}/v1/render/job/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort cancellation; the authoritative job remains the API queue.
    }
  }
}
