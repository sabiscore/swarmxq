/**
 * SwarmX V6.2 — Resilient Ollama Service
 *
 * Centralizes Ollama endpoint resolution and model discovery with:
 * - Multi-endpoint failover (localhost, 127.0.0.1, configured)
 * - Graceful degradation (HTTP -> subprocess fallback)
 * - Cached model lists with TTL
 * - Structured health reporting
 *
 * [V6.2-FIX-02] Split endpoint health from model-list readiness so the API can
 * fail over across localhost/127.0.0.1 even when /api/tags is slow or blocked.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sanitizeReasoningOutput } from "./reasoning-sanitizer.js";
import { fetchBackend } from "./backend-fetch-errors.js";

const execFileAsync = promisify(execFile);

export interface OllamaServiceConfig {
  baseUrl: string;
  // Health means HTTP reachability on /api/version for the selected endpoint.
  isHealthy: boolean;
  modelListMethod: "http" | "http-health" | "subprocess" | "static";
  cachedModels: string[];
  configuredModels: string[];
  lastCheckTime: number;
  lastError?: string;
}

interface EndpointProbeResult {
  endpoint: string;
  versionReachable: boolean;
  tagsReachable: boolean;
  models: string[];
  latencyMs: number;
}

import { loadEnv } from "../lib/env.js";

function getDefaultEndpoints(): string[] {
  const _oe = loadEnv();
  const ordered = [
    _oe.OLLAMA_HOST?.trim() ?? "",
    _oe.SWARMX_OLLAMA_URL?.trim() ?? "",
    _oe.SWARMX_OLLAMA_BASE_URL?.trim() ?? "",
    "http://127.0.0.1:11434",
    "http://localhost:11434",
  ].filter(Boolean);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const endpoint of ordered) {
    const normalized = normalizeEndpoint(endpoint);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

// [V6.2-FIX-04] CACHE_TTL_MS is now env-overridable so constrained hosts can
// tune discovery frequency without a code change.
const CACHE_TTL_MS = loadEnv().SWARMX_OLLAMA_CACHE_TTL_MS;

let cachedConfig: OllamaServiceConfig | null = null;
let lastDiscoveryTime = 0;
// [V6.2-FIX-04] In-flight deduplication: all concurrent callers awaiting
// discovery share a single Promise instead of racing to spawn parallel
// discoverModels() calls, which caused stale writes within the TTL window.
let _discoveryPromise: Promise<OllamaServiceConfig> | null = null;

function normalizeEndpoint(raw: string): string {
  if (!raw) return "http://127.0.0.1:11434";
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }
  return `http://${trimmed.replace(/\/+$/, "")}`;
}

async function probeVersion(baseUrl: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchBackend(`${baseUrl}/api/version`, {
        backend: "ollama",
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return false;
  }
}

async function probeTags(baseUrl: string, timeoutMs: number): Promise<{ ok: boolean; models: string[] }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchBackend(`${baseUrl}/api/tags`, {
        backend: "ollama",
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false, models: [] };
      const json = (await res.json()) as { models?: Array<{ name?: string }> };
      const names = (json.models ?? [])
        .map((m) => m.name?.trim())
        .filter((n): n is string => Boolean(n));
      return { ok: true, models: [...new Set(names)].sort() };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return { ok: false, models: [] };
  }
}

async function probeEndpoint(baseUrl: string): Promise<EndpointProbeResult> {
  const start = Date.now();
  const [versionReachable, tags] = await Promise.all([
    probeVersion(baseUrl, 1800),
    probeTags(baseUrl, 2600),
  ]);
  return {
    endpoint: baseUrl,
    versionReachable,
    tagsReachable: tags.ok,
    models: tags.models,
    latencyMs: Date.now() - start,
  };
}

async function probeSubprocessModels(): Promise<string[]> {
  try {
    const { stdout } = await Promise.race([
      execFileAsync("ollama", ["list"], { timeout: 3000, maxBuffer: 1024 * 1024 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("subprocess timeout")), 3500),
      ),
    ]);
    const lines = stdout.trim().split("\n").slice(1);
    const names = lines
      .map((line) => line.split(/\s+/)[0]?.trim())
      .filter((n): n is string => Boolean(n) && n !== "NAME");
    return [...new Set(names)].sort();
  } catch {
    return [];
  }
}

function getStaticModels(): string[] {
  const _sm = loadEnv();
  const models = [
    _sm.SWARMX_COMPOSER_MODEL,
    _sm.SWARMX_MODEL_FAST,
    _sm.SWARMX_MODEL_CODE,
    _sm.SWARMX_MODEL_REASON,
    "instruct-phi4-pro-q8-prod",
    "code-qwen25-pro-q5km-prod",
    "reason-deepseekr1-pro-q5km-prod",
  ].filter((m): m is string => Boolean(m));
  return [...new Set(models)].sort();
}

async function discoverModels(
  endpoints: string[],
): Promise<{
  models: string[];
  configuredModels: string[];
  httpReachable: boolean;
  method: "http" | "http-health" | "subprocess" | "static";
  endpoint: string;
}> {
  const normalizedEndpoints = endpoints.map((e) => normalizeEndpoint(e));
  const primaryEndpoint = normalizeEndpoint(normalizedEndpoints[0] ?? "http://127.0.0.1:11434");
  const configuredModels = getStaticModels();

  // [V6.2-FIX-12] Keep successful probe results even when one configured
  // endpoint is dead or slow. Each probe already has short internal timeouts,
  // so waiting on allSettled avoids collapsing the whole pass to static mode.
  const results = (await Promise.allSettled(normalizedEndpoints.map((endpoint) => probeEndpoint(endpoint))))
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

  // Prefer endpoint with tags readiness; tie-break by configured endpoint order.
  for (const endpoint of normalizedEndpoints) {
    const match = results.find((r) => r.endpoint === endpoint && r.versionReachable && r.tagsReachable);
    if (match) {
      return {
        models: match.models,
        configuredModels,
        httpReachable: true,
        method: "http",
        endpoint: match.endpoint,
      };
    }
  }

  // If tags fail but /api/version is reachable, keep HTTP endpoint usable for chat.
  for (const endpoint of normalizedEndpoints) {
    const match = results.find((r) => r.endpoint === endpoint && r.versionReachable);
    if (match) {
      return {
        models: [],
        configuredModels,
        httpReachable: true,
        method: "http-health",
        endpoint: match.endpoint,
      };
    }
  }

  const subprocessModels = await probeSubprocessModels();
  if (subprocessModels.length > 0) {
    return {
      models: subprocessModels,
      configuredModels,
      httpReachable: false,
      method: "subprocess",
      endpoint: primaryEndpoint,
    };
  }

  return {
    models: [],
    configuredModels,
    httpReachable: false,
    method: "static",
    endpoint: primaryEndpoint,
  };
}

export async function getOllamaConfig(): Promise<OllamaServiceConfig> {
  const now = Date.now();

  if (cachedConfig && now - lastDiscoveryTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  // [V6.2-FIX-04] Return the in-flight promise if discovery is already running
  // so concurrent callers (e.g. composer + health check arriving simultaneously)
  // share one discovery round rather than racing to spawn duplicates.
  if (_discoveryPromise !== null) {
    return _discoveryPromise;
  }

  const endpoints = getDefaultEndpoints();

  async function doDiscovery(): Promise<OllamaServiceConfig> {
    const discovery = await discoverModels(endpoints);
    const ts = Date.now();
    cachedConfig = {
      baseUrl: normalizeEndpoint(discovery.endpoint),
      isHealthy: discovery.httpReachable,
      modelListMethod: discovery.method,
      cachedModels: discovery.models,
      configuredModels: discovery.configuredModels,
      lastCheckTime: ts,
    };
    lastDiscoveryTime = ts;
    return cachedConfig;
  }

  _discoveryPromise = doDiscovery().finally(() => {
    _discoveryPromise = null;
  });

  return _discoveryPromise;
}

export async function getOllamaBaseUrl(): Promise<string> {
  const config = await getOllamaConfig();
  return config.baseUrl;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  keepAlive?: string;
  overrides?: {
    num_predict?: number;
    num_ctx?: number;
    temperature?: number;
  };
  signal?: AbortSignal;
}

function normalizeKeepAlive(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = /^(\d+)(ms|s|m|h)$/.exec(trimmed);
  if (!match?.[1] || !match[2]) return undefined;
  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2];
  const seconds =
    unit === "ms" ? amount / 1000 :
    unit === "s" ? amount :
    unit === "m" ? amount * 60 :
    amount * 3600;
  if (seconds < 0 || seconds > 3600) return undefined;
  return trimmed;
}

export function buildOllamaGenerateBody(request: OllamaGenerateRequest): Record<string, unknown> {
  const maxTokens = request.maxTokens ?? 1024;
  const overrides = request.overrides ?? {};
  const keepAlive = normalizeKeepAlive(request.keepAlive);
  const numPredict =
    overrides.num_predict !== undefined
      ? Math.min(overrides.num_predict, maxTokens)
      : maxTokens;
  return {
    model: request.model,
    prompt: request.prompt,
    stream: false,
    ...(keepAlive !== undefined ? { keep_alive: keepAlive } : {}),
    options: {
      num_predict: numPredict,
      ...(overrides.num_ctx !== undefined ? { num_ctx: overrides.num_ctx } : {}),
      temperature: overrides.temperature ?? 0.3,
    },
  };
}

export interface OllamaGenerateResult {
  text: string;
  tokenCount: number;
}

export async function generateOllamaText(request: OllamaGenerateRequest): Promise<OllamaGenerateResult> {
  const baseUrl = await getOllamaBaseUrl();

  const res = await fetchBackend(`${baseUrl}/api/generate`, {
    backend: "ollama",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(request.signal ? { signal: request.signal } : {}),
    body: JSON.stringify(buildOllamaGenerateBody(request)),
  });

  if (!res.ok) {
    throw Object.assign(
      new Error(`Ollama ${request.model} responded ${res.status}: ${await res.text()}`),
      { code: "OLLAMA_UNAVAILABLE" },
    );
  }

  const data = (await res.json()) as { response?: string; eval_count?: number; prompt_eval_count?: number };
  const { text } = sanitizeReasoningOutput(data.response ?? "");
  const tokenCount = (data.eval_count ?? 0) + (data.prompt_eval_count ?? 0);
  return { text: text.trim(), tokenCount };
}

export async function getAvailableModels(): Promise<string[]> {
  const config = await getOllamaConfig();
  return config.cachedModels;
}

export async function getConfiguredModels(): Promise<string[]> {
  const config = await getOllamaConfig();
  return config.configuredModels;
}

export async function checkOllamaHealth(): Promise<{
  reachable: boolean;
  endpoint: string;
  methodUsed: string;
}> {
  const config = await getOllamaConfig();
  return {
    reachable: config.isHealthy,
    endpoint: config.baseUrl,
    methodUsed: config.modelListMethod,
  };
}

export function invalidateOllamaCache(): void {
  cachedConfig = null;
  lastDiscoveryTime = 0;
  // Note: _discoveryPromise is intentionally not cleared; any in-flight
  // discovery will complete and write a fresh result.
}

// [V6.2-FIX-22] Probe timeout is now env-overridable. On constrained hosts the
// default 2000ms proved too tight during cold startup and high memory pressure;
// default to 5000ms and override with SWARMX_OLLAMA_PROBE_TIMEOUT_MS if needed.
const FAST_PROBE_TIMEOUT_MS = loadEnv().SWARMX_OLLAMA_PROBE_TIMEOUT_MS;

export async function fastHealthProbe(timeoutMs = FAST_PROBE_TIMEOUT_MS): Promise<{
  reachable: boolean;
  endpoint: string;
  latencyMs: number;
}> {
  const endpoints = getDefaultEndpoints().map((e) => normalizeEndpoint(e));
  const start = Date.now();
  const boundedTimeoutMs = Math.min(10_000, Math.max(250, Math.round(timeoutMs)));

  if (endpoints.length === 0) {
    return { reachable: false, endpoint: "http://127.0.0.1:11434", latencyMs: 0 };
  }

  // [V6.2-FIX-22] Run all endpoint probes in parallel and take the first
  // successful one. The prior sequential approach (2s × N endpoints) caused
  // latencyMs ≈ 4 s on hosts with 2 deduplicated endpoints (127.0.0.1 +
  // localhost), which made the health endpoint report reachable:false and
  // triggered a permanent MODEL OFFLINE banner even when Ollama was running.
  const probes = endpoints.map(async (endpoint) => {
    const ok = await probeVersion(endpoint, boundedTimeoutMs);
    if (!ok) throw new Error("unreachable");
    return endpoint;
  });

  try {
    const firstEndpoint = await Promise.any(probes);
    return {
      reachable: true,
      endpoint: firstEndpoint,
      latencyMs: Date.now() - start,
    };
  } catch {
    // All probes failed — truly unreachable.
    return {
      reachable: false,
      endpoint: endpoints[0] ?? "http://127.0.0.1:11434",
      latencyMs: Date.now() - start,
    };
  }
}
