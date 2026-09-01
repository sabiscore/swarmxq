type BackendKind = "ollama" | "comfyui";

type BackendUnavailableCode = "OLLAMA_UNAVAILABLE" | "COMFY_UNAVAILABLE";

interface BackendFetchOptions extends RequestInit {
  backend: BackendKind;
}

interface BackendDescriptor {
  label: string;
  unavailableCode: BackendUnavailableCode;
}

const BACKENDS: Record<BackendKind, BackendDescriptor> = {
  ollama: { label: "Ollama", unavailableCode: "OLLAMA_UNAVAILABLE" },
  comfyui: { label: "ComfyUI", unavailableCode: "COMFY_UNAVAILABLE" },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}


function codeFromReason(reason: unknown): string | undefined {
  return typeof reason === "object" && reason !== null && "code" in reason
    ? String((reason as { code?: unknown }).code)
    : undefined;
}

export function classifyBackendFetchError(
  error: unknown,
  backend: BackendKind,
  signal?: AbortSignal,
): unknown {
  const reasonCode = codeFromReason(signal?.reason);
  if (signal?.aborted && (reasonCode === "TIMEOUT" || reasonCode === "CANCELLED_BY_USER")) {
    return signal?.reason instanceof Error
      ? signal.reason
      : Object.assign(new Error(reasonCode === "TIMEOUT" ? "Stage timed out" : "Job was cancelled"), { code: reasonCode });
  }

  const descriptor = BACKENDS[backend];
  return Object.assign(
    new Error(`${descriptor.label} unreachable: ${errorMessage(error)}`),
    { code: descriptor.unavailableCode },
  );
}

export async function fetchBackend(
  url: string,
  { backend, ...init }: BackendFetchOptions,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw classifyBackendFetchError(error, backend, init.signal ?? undefined);
  }
}
