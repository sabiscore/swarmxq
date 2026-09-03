import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { resetEnvForTesting } from "../src/lib/env.js";
import {
  isTextVideoStage,
  readBoundedEnvInt,
  stageTimeoutMs,
  resolveVideoModelTag,
  videoModelTagsForRequest,
  resetLowRamModeCacheForTesting,
  LOW_RAM_VIDEO_MODEL,
  VIDEO_TEXT_STAGES,
} from "../src/services/video-runtime-config.js";
import {
  normalizeRuntimeProfileId,
  resolveRuntimeProfile,
} from "../src/services/runtime-profiles.js";

beforeEach(() => {
  resetEnvForTesting();
  resetLowRamModeCacheForTesting();
  delete process.env["VIDEO_INTENT_CLASSIFY_TIMEOUT_MS"];
  delete process.env["SWARMX_VIDEO_LOW_RAM_MODE"];
  delete process.env["TEST_BOUNDED_INT"];
  delete process.env["SWARMX_HOST_PROFILE"];
  delete process.env["OLLAMA_NUM_PARALLEL"];
  delete process.env["OLLAMA_MAX_LOADED_MODELS"];
  delete process.env["OLLAMA_KEEP_ALIVE"];
  delete process.env["SWARMX_MODEL_STARTUP_PREWARM"];
});

afterEach(() => {
  resetEnvForTesting();
  resetLowRamModeCacheForTesting();
  delete process.env["VIDEO_INTENT_CLASSIFY_TIMEOUT_MS"];
  delete process.env["SWARMX_VIDEO_LOW_RAM_MODE"];
  delete process.env["TEST_BOUNDED_INT"];
  delete process.env["SWARMX_HOST_PROFILE"];
  delete process.env["OLLAMA_NUM_PARALLEL"];
  delete process.env["OLLAMA_MAX_LOADED_MODELS"];
  delete process.env["OLLAMA_KEEP_ALIVE"];
  delete process.env["SWARMX_MODEL_STARTUP_PREWARM"];
});

describe("isTextVideoStage", () => {
  test("returns true for intent_classification", () => {
    expect(isTextVideoStage("intent_classification")).toBe(true);
  });

  test("returns true for scripting", () => {
    expect(isTextVideoStage("scripting")).toBe(true);
  });

  test("returns false for render_assembly", () => {
    expect(isTextVideoStage("render_assembly")).toBe(false);
  });

  test("returns false for finalizing", () => {
    expect(isTextVideoStage("finalizing")).toBe(false);
  });
});

describe("readBoundedEnvInt", () => {
  test("returns fallback when env var is not set", () => {
    expect(readBoundedEnvInt("TEST_BOUNDED_INT", 50, 0, 100)).toBe(50);
  });

  test("clamps value above max to max", () => {
    process.env["TEST_BOUNDED_INT"] = "200";
    expect(readBoundedEnvInt("TEST_BOUNDED_INT", 50, 0, 100)).toBe(100);
  });

  test("clamps value below min to min", () => {
    process.env["TEST_BOUNDED_INT"] = "-10";
    expect(readBoundedEnvInt("TEST_BOUNDED_INT", 50, 0, 100)).toBe(0);
  });

  test("returns parsed value when within bounds", () => {
    process.env["TEST_BOUNDED_INT"] = "75";
    expect(readBoundedEnvInt("TEST_BOUNDED_INT", 50, 0, 100)).toBe(75);
  });
});

describe("stageTimeoutMs", () => {
  test("returns default 240000 for intent_classification with no env override", () => {
    expect(stageTimeoutMs("intent_classification")).toBe(240_000);
  });

  test("env override is clamped to stage max bound (600000 for intent_classification)", () => {
    process.env["VIDEO_INTENT_CLASSIFY_TIMEOUT_MS"] = "999999"; // above max 600_000
    expect(stageTimeoutMs("intent_classification")).toBe(600_000);
  });
});

describe("resolveVideoModelTag", () => {
  test("returns canonical qwen25 tag for planning stage when low-RAM mode is explicitly disabled", () => {
    // Explicit "0" (not unset) so this assertion is deterministic regardless
    // of the test host's live available RAM: isLowRamVideoMode() falls back
    // to a live /proc/meminfo check when unset, which is intentional
    // (auto-enable on constrained hosts) but would make this specific
    // "default" assertion flaky on a real low-RAM CI/dev box.
    process.env["SWARMX_VIDEO_LOW_RAM_MODE"] = "0";
    resetEnvForTesting();
    resetLowRamModeCacheForTesting();
    const tag = resolveVideoModelTag({ prompt: "test" }, "planning");
    expect(tag).toBe("plan-qwen25-pro-q5km-prod");
  });

  test("returns LOW_RAM_VIDEO_MODEL when SWARMX_VIDEO_LOW_RAM_MODE=1", () => {
    process.env["SWARMX_VIDEO_LOW_RAM_MODE"] = "1";
    resetEnvForTesting();
    resetLowRamModeCacheForTesting();
    const tag = resolveVideoModelTag({ prompt: "test" }, "planning");
    expect(tag).toBe(LOW_RAM_VIDEO_MODEL);
  });
});

describe("videoModelTagsForRequest", () => {
  test("returns an array covering all text stages, including the Auditor gate", () => {
    const tags = videoModelTagsForRequest({ prompt: "test" });
    expect(tags).toHaveLength(VIDEO_TEXT_STAGES.length);
    expect(tags.length).toBe(5);
  });

  test("all returned tags are non-empty strings", () => {
    const tags = videoModelTagsForRequest({ prompt: "test" });
    for (const tag of tags) {
      expect(typeof tag).toBe("string");
      expect(tag.length).toBeGreaterThan(0);
    }
  });
});

describe("runtime profile resolution", () => {
  test("normalizes legacy profile aliases to V3 IDs", () => {
    expect(normalizeRuntimeProfileId("constrained_cpu")).toBe("constrained_cpu_8gb");
    expect(normalizeRuntimeProfileId("standard_cpu")).toBe("standard_cpu_16gb");
    expect(normalizeRuntimeProfileId("8gb")).toBe("constrained_cpu_8gb");
    expect(normalizeRuntimeProfileId("16gb")).toBe("standard_cpu_16gb");
  });

  test("auto-selects constrained profile below 12 GB total RAM", () => {
    const result = resolveRuntimeProfile({
      requested: "auto",
      totalRamMb: 8_000,
      availableRamMb: 4_000,
      ollamaNumParallel: 1,
      ollamaMaxLoadedModels: 1,
      ollamaKeepAlive: "0",
      startupPrewarm: "0",
    });
    expect(result.profile.id).toBe("constrained_cpu_8gb");
    expect(result.blockers).toEqual([]);
  });

  test("rejects unsafe constrained Ollama residency settings", () => {
    const result = resolveRuntimeProfile({
      requested: "constrained_cpu_8gb",
      totalRamMb: 8_000,
      availableRamMb: 4_000,
      ollamaNumParallel: 2,
      ollamaMaxLoadedModels: 2,
      ollamaKeepAlive: "3m",
      startupPrewarm: "1",
    });
    expect(result.blockers).toContain("OLLAMA_NUM_PARALLEL must be 1 on CPU profiles");
    expect(result.blockers).toContain("constrained_cpu_8gb requires OLLAMA_MAX_LOADED_MODELS=1");
    expect(result.blockers).toContain("constrained_cpu_8gb requires OLLAMA_KEEP_ALIVE=0");
    expect(result.blockers).toContain("constrained_cpu_8gb prohibits heavyweight startup preload");
  });
});
