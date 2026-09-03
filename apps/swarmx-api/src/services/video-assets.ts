/**
 * apps/swarmx-api/src/services/video-assets.ts
 * SwarmXQ Video Subsystem — Output Storage Abstraction
 *
 * Responsibilities:
 *  - Build VideoOutputMetadata from raw orchestrator results
 *  - Resolve file paths and public URLs
 *  - Verify output file existence
 *  - Artifact cleanup for old/cancelled jobs
 */

import { createHash } from "node:crypto";
import { copyFile, stat, unlink, writeFile, mkdir } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { createReadStream, existsSync } from "node:fs";
import type { VideoOutputMetadata, VideoJobRequest, VideoJobStage, CaptionDraft } from "../types/video.js";
import type { FfmpegRenderPackage } from "./ffmpeg-video-renderer.js";
import type { VideoPerformanceMetrics } from "@swarmx/types/video-types";
import { loadEnv } from "../lib/env.js";

// ─── Config ───────────────────────────────────────────────────────────────────

function configuredOutputDir(): string {
  return resolve(loadEnv().SWARMX_VIDEO_EXPORT_DIR);
}

function configuredArtifactDir(): string {
  return resolve(loadEnv().SWARMX_VIDEO_ARTIFACT_DIR);
}

function configuredPublicUrlBase(): string {
  return loadEnv().SWARMX_VIDEO_PUBLIC_URL_BASE.replace(/\/+$/, "");
}

function configuredFfprobeTimeoutMs(): number {
  return Math.min(60_000, Math.max(5_000, loadEnv().SWARMX_VIDEO_FFPROBE_TIMEOUT_MS));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuildMetadataInput {
  jobId: string;
  outputFilename: string;
  scriptText?: string;
  storyboardFrames?: string[];
  modelsUsed: Record<string, string>;
  request: VideoJobRequest;
  renderPackage?: FfmpegRenderPackage;
  captionDraft?: CaptionDraft;
}

// ─── Path Resolution ──────────────────────────────────────────────────────────

export function outputDir(): string {
  return configuredOutputDir();
}

export function resolveOutputPath(filename: string): string {
  const exportDir = configuredOutputDir();
  const resolved = resolve(exportDir, filename);
  const root = exportDir.endsWith(sep) ? exportDir : `${exportDir}${sep}`;
  if (!resolved.startsWith(root)) {
    throw Object.assign(new Error("Output filename escapes export directory"), {
      code: "ARTIFACT_PATH_TRAVERSAL",
    });
  }
  return resolved;
}

export function resolvePublicUrl(filename: string): string {
  return `${configuredPublicUrlBase()}/${encodeURIComponent(filename)}`;
}

// ─── Metadata Builder ─────────────────────────────────────────────────────────

/**
 * Build a VideoOutputMetadata record.
 * Production mode requires a real non-empty media file that ffprobe accepts.
 */
export async function buildOutputMetadata(
  input: BuildMetadataInput
): Promise<VideoOutputMetadata> {
  const absolutePath = resolveOutputPath(input.outputFilename);
  const publicUrl = resolvePublicUrl(input.outputFilename);
  const relativePath = input.outputFilename;

  if (input.outputFilename.startsWith("stub_") && loadEnv().SWARMX_VIDEO_ALLOW_STUB_RENDER !== "1") {
    throw Object.assign(new Error("Stub render output is disabled"), {
      code: "STUB_RENDER_DISABLED",
    });
  }

  if (!existsSync(absolutePath)) {
    throw Object.assign(new Error(`Video artifact missing: ${absolutePath}`), {
      code: "ARTIFACT_MISSING",
    });
  }

  const fileStat = await stat(absolutePath);
  if (fileStat.size <= 0) {
    throw Object.assign(new Error(`Video artifact is empty: ${absolutePath}`), {
      code: "ARTIFACT_EMPTY",
    });
  }

  const checksum = await hashFile(absolutePath);
  const probe = await probeMedia(absolutePath);
  const durationSeconds = probe.durationSeconds;
  const widthPx = probe.width;
  const heightPx = probe.height;
  const fps = probe.fps;

  if (durationSeconds <= 0 || widthPx <= 0 || heightPx <= 0 || fps <= 0) {
    throw Object.assign(new Error(`Video artifact is invalid: ${absolutePath}`), {
      code: "ARTIFACT_INVALID",
    });
  }

  const format: "mp4" | "webm" = input.outputFilename.endsWith(".webm")
    ? "webm"
    : "mp4";

  return {
    relativePath,
    absolutePath,
    publicUrl,
    fileSizeBytes: fileStat.size,
    durationSeconds,
    widthPx,
    heightPx,
    fps,
    format,
    checksum,
    generatedAt: new Date().toISOString(),
    ...(input.scriptText !== undefined ? { scriptText: input.scriptText } : {}),
    ...(input.storyboardFrames !== undefined ? { storyboardFrames: input.storyboardFrames } : {}),
    modelsUsed: input.modelsUsed,
    ...(input.captionDraft !== undefined ? { captionDraft: input.captionDraft } : {}),
    ...(input.renderPackage
      ? {
        rendererTier: input.renderPackage.rendererTier,
        certificationTier: input.renderPackage.mediaQualityReport.certificationTier,
        voiceArtifact: input.renderPackage.voiceArtifact,
        mediaQualityReport: input.renderPackage.mediaQualityReport,
        productionPackageDir: input.renderPackage.packageDir,
        renderManifestPath: input.renderPackage.renderManifestPath,
        transcriptPath: input.renderPackage.transcriptPath,
        srtPath: input.renderPackage.srtPath,
        vttPath: input.renderPackage.vttPath,
        rightsManifestPath: input.renderPackage.rightsManifestPath,
        platformPackagePath: input.renderPackage.platformPackagePath,
        thumbnailPath: input.renderPackage.thumbnailPath,
      }
      : {}),
  };
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

export async function importComfyOutput(filename: string): Promise<string> {
  const comfyOutputDir = loadEnv().SWARMX_COMFYUI_OUTPUT_DIR;
  if (!comfyOutputDir) {
    throw Object.assign(new Error("SWARMX_COMFYUI_OUTPUT_DIR is required for ComfyUI output handoff"), {
      code: "COMFY_OUTPUT_DIR_MISSING",
    });
  }

  const safeName = basename(filename);
  if (safeName !== filename || safeName.includes("..")) {
    throw Object.assign(new Error("ComfyUI output filename is unsafe"), {
      code: "COMFY_OUTPUT_PATH_TRAVERSAL",
    });
  }

  const sourceRoot = resolve(comfyOutputDir);
  const source = resolve(sourceRoot, safeName);
  const sourcePrefix = sourceRoot.endsWith(sep) ? sourceRoot : `${sourceRoot}${sep}`;
  if (!source.startsWith(sourcePrefix)) {
    throw Object.assign(new Error("ComfyUI output path escapes configured directory"), {
      code: "COMFY_OUTPUT_PATH_TRAVERSAL",
    });
  }

  if (!existsSync(source)) {
    throw Object.assign(new Error(`ComfyUI output missing: ${source}`), {
      code: "ARTIFACT_MISSING",
    });
  }

  await mkdir(outputDir(), { recursive: true });
  const target = resolveOutputPath(safeName);
  await copyFile(source, target);
  return safeName;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Delete output artifact for a given job.
 * Safe to call even if the file does not exist.
 */
export async function deleteArtifact(filename: string): Promise<boolean> {
  const path = resolveOutputPath(filename);
  try {
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

// ─── Probes ───────────────────────────────────────────────────────────────────

async function probeMedia(
  filePath: string,
): Promise<{ durationSeconds: number; width: number; height: number; fps: number }> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "error",
        "-show_entries",
        "format=duration:stream=codec_type,width,height,avg_frame_rate,r_frame_rate",
        "-of",
        "json",
        filePath,
      ],
      { timeout: configuredFfprobeTimeoutMs(), maxBuffer: 1024 * 1024 },
    );

    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: {
        width?: number;
        height?: number;
        codec_type?: string;
        avg_frame_rate?: string;
        r_frame_rate?: string;
      }[];
    };
    const dur = parseFloat(parsed.format?.duration ?? "0");
    const video = parsed.streams?.find((s) => s.codec_type === "video");
    const fps = parseFrameRate(video?.avg_frame_rate) || parseFrameRate(video?.r_frame_rate);
    if (!video?.width || !video.height || !(dur > 0) || !(fps > 0)) {
      throw new Error("ffprobe did not find a valid video stream");
    }
    return {
      durationSeconds: dur,
      width: video.width,
      height: video.height,
      fps,
    };
  } catch (error) {
    throw Object.assign(
      new Error(`Video artifact media probe failed: ${error instanceof Error ? error.message : String(error)}`),
      { code: "ARTIFACT_INVALID" },
    );
  }
}

function parseFrameRate(value: string | undefined): number {
  if (!value) return 0;
  if (!value.includes("/")) {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const [numeratorRaw, denominatorRaw] = value.split("/", 2);
  const numerator = Number.parseFloat(numeratorRaw ?? "0");
  const denominator = Number.parseFloat(denominatorRaw ?? "0");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

export interface ArtifactManifestEntry {
  jobId: string;
  filename: string;
  publicUrl: string;
  createdAt: string;
}

/**
 * List all video artifacts in the output directory.
 */
export async function listArtifacts(): Promise<ArtifactManifestEntry[]> {
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(outputDir());
    return files
      .filter((f) => f.endsWith(".mp4") || f.endsWith(".webm"))
      .map((f) => ({
        jobId: f.split("_")[1]?.split(".")[0] ?? f,
        filename: f,
        publicUrl: resolvePublicUrl(f),
        createdAt: new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

/**
 * r2 evolution handoff stub.
 * Persists publish-time metrics without coupling to Lab in VIDEO-ALPHA r1.
 */
export async function recordVideoPerformance(
  jobId: string,
  metrics: VideoPerformanceMetrics,
): Promise<string> {
  const artifactDir = configuredArtifactDir();
  await mkdir(artifactDir, { recursive: true });
  const outputPath = resolve(artifactDir, `${jobId}.performance.json`);
  await writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  return outputPath;
}
