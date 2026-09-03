import { renderWithFfmpeg } from "../src/services/ffmpeg-video-renderer.js";
import { resolveOutputPath } from "../src/services/video-assets.js";
import { stat } from "node:fs/promises";

async function main() {
  console.log("Rendering first autonomous local video...");
  const jobId = "first-local-video-" + Date.now();
  
  const result = await renderWithFfmpeg({
    jobId,
    scriptText: "[HOOK] STOP scheduling 1 hour meetings for a 2 MINUTE email.\n[BODY] Async standups save *15 HOURS* a week. Most teams waste 40% of their day in useless syncs.\n[CTA] DROP MEETINGS. Ship code faster.",
    storyboardFrames: [
      "Scene 1: Split screen comparing calendar bloat with productive coding",
      "Scene 2: High velocity code commits and minimal interruptions",
      "Scene 3: Punchy bold CTA card on pulsing procedural background",
    ],
    request: {
      prompt: "Why async beats meetings for software engineering teams",
      platform: "tiktok",
      tone: "contrarian",
      targetDurationSeconds: 15,
      template: "myth-vs-fact",
      niche: "tech",
      captionStyle: "bold_center",
      voiceProfileId: "kokoro_contrarian",
    },
  });

  const fullPath = resolveOutputPath(result.outputFilename);
  const videoStat = await stat(fullPath);
  console.log("\n========================================================");
  console.log("🎉 FIRST AUTONOMOUS LOCAL VIDEO GENERATION SUCCESSFUL!");
  console.log("========================================================");
  console.log("Output Filename :", result.outputFilename);
  console.log("Full Path       :", fullPath);
  console.log("File Size       :", (videoStat.size / (1024 * 1024)).toFixed(2), "MB");
  console.log("Renderer Tier   :", result.renderPackage.rendererTier);
  console.log("QC Certification:", result.renderPackage.mediaQualityReport.certificationTier);
  console.log("Package Dir     :", result.renderPackage.packageDir);
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Video rendering failed:", err);
  process.exit(1);
});
