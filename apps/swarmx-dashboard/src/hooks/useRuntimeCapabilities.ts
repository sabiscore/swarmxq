"use client";

import { useQuery } from "@tanstack/react-query";
import { resolveClientApiBaseUrl } from "@/lib/api-config";

export interface RuntimeCapabilities {
  status: "ok" | "degraded" | "warning" | "critical";
  ts: string;
  ollama: { url: string; reachable: boolean; latencyMs: number | null };
  models: Array<{
    role: string;
    tag: string;
    gguf?: string;
    status: "ready" | "missing" | "error";
    error?: string;
  }>;
  memory: { totalGb: number; availableGb: number; usedGb: number };
  warmup: { done: boolean; coldStartEtaSecs: number | null; source: "file" | "default" } | null;
  voice: {
    preferredProvider: string;
    fallbackWarning?: string;
    benchmark: {
      generatedAt: string;
      ageHours: number;
      stale: boolean;
      recommendedProviderId: string;
      recommendationReason: string;
      providers: Array<{
        id: string;
        qualityTier: string;
        probeState: string;
        realTimeFactor: number | null;
        warmLatencyMs: number | null;
        coldLatencyMs: number | null;
        failures: number;
      }>;
    } | null;
  };
  runtimeProfile: {
    id: string;
    label: string;
    source: string;
    totalRamMb: number;
    availableRamMb: number;
    blockers: string[];
    warnings: string[];
  };
  warnings?: string[];
}

function resolveDirectApiBaseUrl(): string {
  return resolveClientApiBaseUrl();
}

const QUERY_KEY = ["swarmx", "runtime-capabilities"] as const;
const POLL_MS = 20_000;
const TIMEOUT_MS = 4_000;

async function fetchRuntimeCapabilities(): Promise<RuntimeCapabilities | null> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${resolveDirectApiBaseUrl()}/api/system/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as RuntimeCapabilities;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

/**
 * Full `/api/system/health` payload for the Runtime Capabilities strip.
 * Separate cache from useApiHealth so the CommandBar keeps its lean payload
 * while the system page consumes the full envelope.
 */
export function useRuntimeCapabilities(): RuntimeCapabilities | null {
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRuntimeCapabilities,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return data ?? null;
}
