/**
 * Centralized environment schema for the SwarmX API.
 *
 * Purpose:
 *   - Fail-fast on invalid values at startup rather than crashing on first request
 *     or silently mis-behaving.
 *   - Document every env var the API reads in one place.
 *   - Provide typed, defaulted access via `env.X` — all services and routes import
 *     loadEnv() instead of reading process.env directly.
 *
 * Dynamic env access that must not be cached is centralized at the bottom of
 * this module. Services and routes still go through env.ts; secrets are never
 * copied into the cached loadEnv() object.
 *
 * Dynamic keys:
 *   SWARMX_VIDEO_API_TOKEN     — secret; read at auth-check time
 *   SWARMX_TIKTOK_ACCESS_TOKEN — OAuth secret
 *   SWARMX_INSTAGRAM_ACCESS_TOKEN — OAuth secret
 *   PYTHONPATH                 — inherited system variable
 *   VIDEO_*_TIMEOUT_MS         — parametric stage timeout overrides
 *   SWARMX_VIDEO_*_MODEL       — stage-keyed model overrides
 *
 * Legacy aliases normalized here:
 *   VIDEO_OUTPUT_DIR          → SWARMX_VIDEO_EXPORT_DIR
 *   VIDEO_PUBLIC_URL_BASE     → SWARMX_VIDEO_PUBLIC_URL_BASE
 *   COMFY_HOST                → SWARMX_COMFYUI_URL
 *   HIGH_PRESSURE_DELAY_MS    → SWARMX_VIDEO_HIGH_PRESSURE_DELAY_MS
 */

import { z } from "zod";
import path from "node:path";

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().min(1);
const nonNegativeInt = z.coerce.number().int().min(0);
const boolFlag = z.enum(["0", "1"]).default("0");

const schema = z.object({
  // ── Core ──────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SWARMX_API_PORT: port.default(3001),
  SWARMX_API_HOST: z.string().min(1).default("127.0.0.1"),
  SWARMX_API_INTERNAL: z.string().url().default("http://localhost:7380"),
  SWARMX_DASHBOARD_ORIGIN: z.string().optional(),

  // ── Ollama / model connectivity ───────────────────────────────────────────
  OLLAMA_HOST: z.string().url().optional(),
  SWARMX_OLLAMA_URL: z.string().url().optional(),
  SWARMX_OLLAMA_BASE_URL: z.string().url().optional(),
  SWARMX_OLLAMA_PROBE_TIMEOUT_MS: positiveInt.default(5000),
  SWARMX_OLLAMA_CACHE_TTL_MS: nonNegativeInt.default(15_000),
  OLLAMA_MAX_LOADED_MODELS: z.coerce.number().int().min(1).default(1),
  // CPU performance profile (WSL2/CPU-only) — set by startup-enhanced.sh before Ollama starts.
  // Defaults reflect safe fallbacks when not set; actual required values are enforced by startup script.
  OLLAMA_NUM_PARALLEL: z.coerce.number().int().min(1).default(1),
  OLLAMA_FLASH_ATTENTION: z.enum(["0", "1"]).default("0"),
  OLLAMA_KV_CACHE_TYPE: z.string().default("f16"),
  OLLAMA_NUM_THREADS: z.coerce.number().int().min(1).default(4),
  OLLAMA_KEEP_ALIVE: z.string().default("0"),
  // Pilot keep-alive in seconds. startup-enhanced.sh exports 300 (5 min) on 16 GB hosts
  // so the model stays resident between the intent stage and the post-pipeline virality call.
  OLLAMA_KEEP_ALIVE_PILOT_S: z.coerce.number().int().min(0).default(300),
  SWARMX_HOST_PROFILE: z.enum([
    "auto",
    "constrained_cpu_8gb",
    "standard_cpu_16gb",
    "accelerated_optional",
    "constrained_cpu",
    "standard_cpu",
    "8gb",
    "16gb",
  ]).default("auto"),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),

  // ── Model tags (preprocess resolves legacy SWARM_* alias chains) ──────────
  SWARMX_MODEL_FAST: z.preprocess(
    (val) => val ?? process.env["SWARM_MODEL_FAST"],
    z.string().default("instruct-phi4-pro-q8-prod"),
  ),
  SWARMX_MODEL_REASON: z.preprocess(
    (val) => val ?? process.env["SWARMX_MODEL_REASONER"] ?? process.env["SWARM_MODEL_REASON"],
    z.string().default("reason-deepseekr1-pro-q5km-prod"),
  ),
  SWARMX_MODEL_CODE: z.preprocess(
    (val) => val ?? process.env["SWARM_MODEL_CODE"],
    z.string().default("code-qwen25-pro-q5km-prod"),
  ),
  SWARMX_MODEL_ULTRA_ROUTER: z.preprocess(
    (val) => val ?? process.env["SWARM_MODEL_ULTRA_ROUTER"],
    z.string().default("route-phi4-lite-q4km-prod"),
  ),
  // Composer-specific model overrides; fall back to SWARMX_MODEL_FAST at call sites
  SWARMX_COMPOSER_FAST_MODEL: z.string().optional(),
  SWARMX_COMPOSER_MODEL: z.string().optional(),
  SWARMX_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),
  SWARMX_MODEL_STARTUP_PREWARM: boolFlag,
  SWARMX_MODEL_PREDICTIVE_PREWARM: boolFlag,

  // ── Agent subsystem ───────────────────────────────────────────────────────
  SWARMX_TELEMETRY_INTERVAL_MS: positiveInt.default(2000),
  SWARMX_MAX_AGENTS: positiveInt.default(10),
  SWARMX_AGENT_TIMEOUT_MS: positiveInt.default(300_000),
  SWARMX_MAX_PTY_SESSIONS: positiveInt.default(8),

  // ── Composer subsystem ────────────────────────────────────────────────────
  SWARMX_COMPOSER_TIMEOUT_HISTO_LOG_EVERY: positiveInt.default(3),
  SWARMX_COMPOSER_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(2),
  SWARMX_COMPOSER_RETRY_BASE_DELAY_MS: positiveInt.default(250),
  SWARMX_COMPOSER_RETRY_MAX_DELAY_MS: positiveInt.default(2500),
  SWARMX_COMPOSER_CB_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(4),
  SWARMX_COMPOSER_CB_OPEN_MS: positiveInt.default(20_000),
  SWARMX_COMPOSER_DEEP_TIMEOUT_MS: positiveInt.default(90_000),
  // Defaults to SWARMX_COMPOSER_DEEP_TIMEOUT_MS; override to lower floor on constrained hosts
  SWARMX_COMPOSER_DEEP_TIMEOUT_MIN_MS: z.preprocess(
    (val) => val ?? process.env["SWARMX_COMPOSER_DEEP_TIMEOUT_MS"] ?? "90000",
    positiveInt,
  ),
  SWARMX_COMPOSER_TIMEOUT_MS: positiveInt.default(60_000),
  SWARMX_COMPOSER_NUM_PREDICT: positiveInt.default(256),
  SWARMX_COMPOSER_KEEP_ALIVE: z.string().optional(),
  SWARMX_COMPOSER_SHORT_PROMPT_TIMEOUT_MS: positiveInt.default(45_000),

  // ── Adaptive timeout / circuit-breaker ────────────────────────────────────
  SWARMX_CB_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(3),
  SWARMX_CB_WINDOW_MS: positiveInt.default(90_000),
  SWARMX_CB_OPEN_DURATION_MS: positiveInt.default(30_000),

  // ── Video pipeline ────────────────────────────────────────────────────────
  SWARMX_VIDEO_USE_BULLMQ: z.enum(["0", "1"]).default("1"),
  SWARMX_VIDEO_LOW_RAM_MODE: z.enum(["0", "1"]).default("0"),
  SWARMX_VIDEO_JOB_LIMIT_PER_HOUR: positiveInt.default(10),
  SWARMX_VIDEO_CAPTION_SCORE_LIMIT_PER_MIN: positiveInt.default(10),
  SWARMX_VIDEO_QUEUE_MAX_SIZE: positiveInt.default(20),
  SWARMX_VIDEO_QUEUE_NAME: z.string().min(1).default("swarmx-video"),
  SWARMX_VIDEO_MAX_RETRIES: z.preprocess(
    (val) => val ?? process.env["VIDEO_MAX_RETRIES"],
    nonNegativeInt.default(3),
  ),
  SWARMX_VIDEO_RETRY_BASE_DELAY_MS: positiveInt.default(5_000),
  SWARMX_VIDEO_RETRY_MAX_DELAY_MS: positiveInt.default(30_000),
  SWARMX_VIDEO_RETRY_JITTER_MS: nonNegativeInt.default(1_000),
  SWARMX_VIDEO_JOB_TTL_MS: z.preprocess(
    (val) => val ?? process.env["VIDEO_JOB_TTL_MS"],
    positiveInt.default(4 * 60 * 60 * 1000),
  ),
  SWARMX_VIDEO_MAX_CONCURRENT_JOBS: z.preprocess(
    (val) => val ?? process.env["VIDEO_MAX_CONCURRENT_JOBS"],
    positiveInt.default(1),
  ),
  SWARMX_VIDEO_EXPORT_TTL_DAYS: positiveInt.default(7),
  SWARMX_VIDEO_CLEANUP_INTERVAL_MS: positiveInt.default(6 * 60 * 60 * 1000),
  SWARMX_VIDEO_FFPROBE_TIMEOUT_MS: positiveInt.default(15_000),
  SWARMX_VIDEO_FFMPEG_TIMEOUT_MS: positiveInt.default(240_000),
  SWARMX_VIDEO_ALLOW_STUB_RENDER: boolFlag,
  SWARMX_VIDEO_ALLOW_SILENT_AUDIO: boolFlag,
  SWARMX_VIDEO_ALLOW_UNSTRUCTURED_INTENT: boolFlag,
  SWARMX_VIDEO_RENDER_BACKEND: z.string().default("auto"),
  SWARMX_MODAL_RENDER_URL: z.string().url().optional(),
  SWARMX_MODAL_MAX_CONTAINERS: positiveInt.default(4),
  SWARMX_MODAL_FUNCTION_TIMEOUT_S: positiveInt.default(600),
  SWARMX_MODAL_STARTUP_TIMEOUT_S: positiveInt.default(180),
  SWARMX_VIDEO_REQUIRE_WORD_ALIGNMENT: boolFlag,
  SWARMX_VIDEO_MAX_BATCH_SIZE: positiveInt.default(8),
  SWARMX_VIDEO_EXPORT_DIR: z.preprocess(
    (val) => val ?? process.env["VIDEO_OUTPUT_DIR"] ?? ".swarmx/video/exports",
    z.string().min(1),
  ),
  SWARMX_VIDEO_ARTIFACT_DIR: z.string().min(1).default(".swarmx/video/artifacts"),
  SWARMX_VIDEO_PUBLIC_URL_BASE: z.preprocess(
    (val) => val ?? process.env["VIDEO_PUBLIC_URL_BASE"] ?? "/api/video/files",
    z.string().min(1),
  ),
  SWARMX_VIDEO_TEMP_DIR: z.preprocess(
    (val) => val ?? path.join(process.cwd(), ".swarmx", "video", "tmp"),
    z.string(),
  ),
  SWARMX_VIDEO_HIGH_PRESSURE_DELAY_MS: z.preprocess(
    (val) => val ?? process.env["HIGH_PRESSURE_DELAY_MS"] ?? "3000",
    z.coerce.number().int()
      .transform((n) => Math.min(30_000, Math.max(1_000, n))),
  ),
  SWARMX_VIDEO_MAX_FRAME_BUDGET_MB: positiveInt.default(7600),
  SWARMX_VIDEO_COMFY_POLL_INTERVAL_MS: positiveInt.default(2000),
  SWARMX_VIDEO_COMFY_POLL_MAX_ATTEMPTS: positiveInt.default(180),

  // ── Local voice / audio rendering ─────────────────────────────────────────
  SWARMX_TTS_PROVIDER: z.enum(["auto", "kokoro", "piper", "espeak", "silent_fixture"]).default("auto"),
  SWARMX_TTS_URL: z.string().url().default("http://127.0.0.1:8888"),
  SWARMX_TTS_PIPER_MODEL_PATH: z.string().optional(),
  SWARMX_TTS_LOCALE: z.string().min(2).default("en-US"),
  SWARMX_TTS_PRONUNCIATION_DICTIONARY_VERSION: z.string().default("builtin-v1"),
  SWARMX_AUDIO_MASTER_SAMPLE_RATE_HZ: positiveInt.default(48_000),
  SWARMX_AUDIO_MASTER_CHANNELS: z.coerce.number().int().min(1).max(2).default(2),
  SWARMX_AUDIO_TARGET_LUFS: z.coerce.number().default(-16),
  SWARMX_AUDIO_TRUE_PEAK_MAX_DBFS: z.coerce.number().default(-1.5),
  SWARMX_VOICE_BENCHMARK_FILE: z.preprocess(
    (val) => val ?? "/tmp/swarmxq-voice-benchmark.json",
    z.string(),
  ),
  SWARMX_VOICE_BENCHMARK_MAX_AGE_HOURS: z.coerce.number().int().min(1).max(720).default(168),

  // ── ComfyUI ───────────────────────────────────────────────────────────────
  SWARMX_COMFYUI_URL: z.preprocess(
    (val) => val ?? process.env["COMFY_HOST"],
    z.string().url().default("http://127.0.0.1:8188"),
  ),
  SWARMX_COMFYUI_OUTPUT_DIR: z.string().optional(),
  SWARMX_COMFYUI_TEACACHE: boolFlag,

  // ── Path / system (computed defaults from HOME / cwd) ─────────────────────
  SWARMX_HOME: z.preprocess(
    (val) => val ?? `${process.env["HOME"] ?? process.env["USERPROFILE"] ?? ""}/.swarmx`,
    z.string(),
  ),
  SWARMX_REPO_ROOT: z.preprocess(
    (val) => val ?? process.cwd(),
    z.string(),
  ),
  SWARMX_WORKFLOWS_DIR: z.preprocess(
    (val) =>
      val ??
      path.join(
        process.env["SWARMX_HOME"] ??
          `${process.env["HOME"] ?? process.env["USERPROFILE"] ?? ""}/.swarmx`,
        "workflows",
      ),
    z.string(),
  ),
  SWARMX_LOG_DIR: z.string().default("/var/log/swarmx"),
  SWARMX_EVENTS_LIMIT: nonNegativeInt.default(200),

  // ── Python bridge ─────────────────────────────────────────────────────────
  SWARMX_PYTHON: z.string().default("python3"),
  SWARMX_PYTHON_API_URL: z.string().optional(),
  SWARMX_V5_POLL_INTERVAL_MS: positiveInt.default(15_000),
  SWARMX_V5_POLL_TIMEOUT_MS: positiveInt.default(25_000),
  SWARMX_PYEVENTS_POLL_MS: positiveInt.default(2500),

  // ── Observability / systemd ───────────────────────────────────────────────
  SWARMX_JOURNAL_UNITS: z.string().optional(),
  SWARMX_SYSTEMD_FILTER: z.string().optional(),
  SWARMX_CGROUP_ROOT: z.string().default("/sys/fs/cgroup/swarmx.slice"),
  SWARMX_CGROUP_INTERVAL_MS: positiveInt.default(2000),

  // ── Health / warmup ───────────────────────────────────────────────────────
  // Bounds-clamped (250–10 000 ms) — replaces readBoundedTimeoutMs() in system.ts.
  // Uses clamp transform (not min/max validation) to preserve the original
  // readBoundedTimeoutMs() behavior: out-of-range values are silently clamped.
  SWARMX_SYSTEM_HEALTH_PROBE_TIMEOUT_MS: z.coerce.number().int()
    .transform((n) => Math.min(10_000, Math.max(250, n))).default(1500),
  SWARMX_SYSTEM_HEALTH_MODEL_PROBE_TIMEOUT_MS: z.coerce.number().int()
    .transform((n) => Math.min(10_000, Math.max(250, n))).default(2500),
  SWARMX_WARMUP_STATUS_FILE: z.string().default("/tmp/swarmxq-warmup.json"),

  // ── Publisher (non-secret config; secrets stay as direct process.env reads) ─
  SWARMX_INSTAGRAM_USER_ID: z.string().optional(),
  SWARMX_TIKTOK_API_APPROVED: boolFlag,
});

type Env = z.infer<typeof schema>;

export type SecretEnvKey =
  | "SWARMX_VIDEO_API_TOKEN"
  | "SWARMX_TIKTOK_ACCESS_TOKEN"
  | "SWARMX_INSTAGRAM_ACCESS_TOKEN";

let cached: Env | null = null;

/**
 * Parse and cache the API env. Call at startup (server.ts) before any other
 * module reads env. Throws with a formatted list of issues on first invalid
 * value; process.exit(1) is the caller's responsibility.
 */
export function loadEnv(): Env {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

/**
 * Escape hatch for tests — resets the cached env so the next `loadEnv()` re-parses.
 */
export function resetEnvForTesting(): void {
  cached = null;
}

/**
 * Non-cached secret reads. Keep token material out of the parsed env object so
 * structured logging of config snapshots cannot accidentally disclose secrets.
 */
export function readSecretEnv(key: SecretEnvKey): string {
  return process.env[key]?.trim() ?? "";
}

/**
 * Non-cached raw reads for parametric/system env names that cannot be modeled
 * as one cached schema property, such as stage-specific timeout overrides.
 */
export function readRawEnv(key: string): string | undefined {
  return process.env[key];
}
