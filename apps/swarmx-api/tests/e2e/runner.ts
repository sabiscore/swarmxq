#!/usr/bin/env node
/**
 * apps/swarmx-api/tests/e2e/runner.ts
 * Master E2E & Multi-Tier Test Runner for SwarmXQ.
 *
 * Usage:
 *   npx tsx apps/swarmx-api/tests/e2e/runner.ts
 *   npx tsx apps/swarmx-api/tests/e2e/runner.ts --verbose
 *   npx tsx apps/swarmx-api/tests/e2e/runner.ts --tier=1
 *   npx tsx apps/swarmx-api/tests/e2e/runner.ts --feature=4
 *   npx tsx apps/swarmx-api/tests/e2e/runner.ts --json
 */

import { performance } from "node:perf_hooks";
import { type TestSuite, type TestCase, type TestContext } from "./test-helpers.js";

// Import all Tier 1 Suites
import { tier1ContractsTypesSuite } from "./tier1-feature-coverage/tier1-contracts-types.test.js";
import { tier1AuditorAndEvictionSuite } from "./tier1-feature-coverage/tier1-auditor-and-eviction.test.js";
import { tier1SanitizerAndSeoSuite } from "./tier1-feature-coverage/tier1-sanitizer-and-seo.test.js";
import { tier1TemplatesAndFfmpegSuite } from "./tier1-feature-coverage/tier1-templates-and-ffmpeg.test.js";
import { tier1KineticAndFontsSuite } from "./tier1-feature-coverage/tier1-kinetic-and-fonts.test.js";
import { tier1InvariantsAndHardeningSuite } from "./tier1-feature-coverage/tier1-invariants-and-hardening.test.js";
import { tier1DashboardAndSseSuite } from "./tier1-feature-coverage/tier1-dashboard-and-sse.test.js";
import { tier1CompletionAndVitestSuite } from "./tier1-feature-coverage/tier1-completion-and-vitest.test.js";
import { tier1E2eAndProductionSuite } from "./tier1-feature-coverage/tier1-e2e-and-production.test.js";

// Import all Tier 2 Suites
import { tier2BoundariesContractsAuditorSuite } from "./tier2-boundary-corner/tier2-boundaries-contracts-auditor.test.js";
import { tier2BoundariesSanitizerSeoFfmpegSuite } from "./tier2-boundary-corner/tier2-boundaries-sanitizer-seo-ffmpeg.test.js";
import { tier2BoundariesFontsHardeningDashSuite } from "./tier2-boundary-corner/tier2-boundaries-fonts-hardening-dash.test.js";
import { tier2BoundariesCompletionE2eProdSuite } from "./tier2-boundary-corner/tier2-boundaries-completion-e2e-prod.test.js";

// Import Tier 3 Suite
import { tier3PairwiseMatrixSuite } from "./tier3-combinations/tier3-pairwise-matrix.test.js";

// Import Tier 4 Suite
import { tier4RealWorldScenariosSuite } from "./tier4-application-scenarios/tier4-real-world-scenarios.test.js";

const ALL_SUITES: TestSuite[] = [
  // Tier 1
  tier1ContractsTypesSuite,
  tier1AuditorAndEvictionSuite,
  tier1SanitizerAndSeoSuite,
  tier1TemplatesAndFfmpegSuite,
  tier1KineticAndFontsSuite,
  tier1InvariantsAndHardeningSuite,
  tier1DashboardAndSseSuite,
  tier1CompletionAndVitestSuite,
  tier1E2eAndProductionSuite,

  // Tier 2
  tier2BoundariesContractsAuditorSuite,
  tier2BoundariesSanitizerSeoFfmpegSuite,
  tier2BoundariesFontsHardeningDashSuite,
  tier2BoundariesCompletionE2eProdSuite,

  // Tier 3
  tier3PairwiseMatrixSuite,

  // Tier 4
  tier4RealWorldScenariosSuite,
];

// Parse CLI Flags
const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith("--tier="))?.split("=")[1];
const targetTier = tierArg ? parseInt(tierArg, 10) : undefined;

const featureArg = args.find((a) => a.startsWith("--feature="))?.split("=")[1];
const targetFeature = featureArg ? parseInt(featureArg, 10) : undefined;

const isVerbose = args.includes("--verbose");
const isJson = args.includes("--json");

async function main() {
  const startTime = performance.now();
  const results: TestContext[] = [];

  let totalExecuted = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  if (!isJson) {
    console.log("\n================================================================================");
    console.log("             SWARMXQ MULTI-TIER E2E & ACCEPTANCE TEST RUNNER                  ");
    console.log("================================================================================\n");
    if (targetTier) console.log(`[FILTER] Running Tier ${targetTier} tests only.`);
    if (targetFeature) console.log(`[FILTER] Running Feature ${targetFeature} tests only.`);
  }

  for (const suite of ALL_SUITES) {
    if (targetTier && suite.tier !== targetTier) {
      continue;
    }

    const filteredTests = suite.tests.filter((t) => {
      if (targetFeature && t.featureId !== targetFeature) return false;
      return true;
    });

    if (filteredTests.length === 0) continue;

    if (!isJson) {
      console.log(`\n📦 ${suite.suiteName} (Tier ${suite.tier})`);
      console.log("─".repeat(70));
    }

    for (const test of filteredTests) {
      totalExecuted++;
      const testStart = performance.now();
      let passed = true;
      let errorMsg: string | undefined;

      try {
        await test.fn();
        totalPassed++;
      } catch (err: any) {
        passed = false;
        totalFailed++;
        errorMsg = err.message || String(err);
      }

      const durationMs = Math.round((performance.now() - testStart) * 100) / 100;
      results.push({
        name: test.name,
        tier: test.tier,
        featureId: test.featureId,
        passed,
        error: errorMsg,
        durationMs,
      });

      if (!isJson) {
        if (passed) {
          if (isVerbose) {
            console.log(`  ✅ PASS: ${test.name} (${durationMs}ms)`);
          } else {
            process.stdout.write(".");
          }
        } else {
          console.log(`\n  ❌ FAIL: ${test.name} (${durationMs}ms)`);
          console.log(`     Error: ${errorMsg}`);
        }
      }
    }

    if (!isJson && !isVerbose) {
      process.stdout.write("\n");
    }
  }

  const totalDurationMs = Math.round(performance.now() - startTime);

  const tier1Count = results.filter((r) => r.tier === 1).length;
  const tier2Count = results.filter((r) => r.tier === 2).length;
  const tier3Count = results.filter((r) => r.tier === 3).length;
  const tier4Count = results.filter((r) => r.tier === 4).length;

  if (isJson) {
    const jsonOutput = {
      summary: {
        totalExecuted,
        totalPassed,
        totalFailed,
        totalDurationMs,
        tierBreakdown: {
          tier1: { total: tier1Count, passed: results.filter((r) => r.tier === 1 && r.passed).length },
          tier2: { total: tier2Count, passed: results.filter((r) => r.tier === 2 && r.passed).length },
          tier3: { total: tier3Count, passed: results.filter((r) => r.tier === 3 && r.passed).length },
          tier4: { total: tier4Count, passed: results.filter((r) => r.tier === 4 && r.passed).length },
        },
      },
      results,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    console.log("\n================================================================================");
    console.log("                            TEST EXECUTION SUMMARY                             ");
    console.log("================================================================================");
    console.log(`  Total Tests Executed : ${totalExecuted}`);
    console.log(`  Passed               : ${totalPassed}`);
    console.log(`  Failed               : ${totalFailed}`);
    console.log(`  Execution Time       : ${totalDurationMs} ms`);
    console.log("─".repeat(70));
    console.log(`  Tier 1 (Feature Coverage)     : ${tier1Count} tests`);
    console.log(`  Tier 2 (Boundaries & Corners) : ${tier2Count} tests`);
    console.log(`  Tier 3 (Pairwise Matrix)      : ${tier3Count} tests`);
    console.log(`  Tier 4 (Real-World Scenarios) : ${tier4Count} tests`);
    console.log("================================================================================");

    if (totalFailed === 0) {
      console.log("\n🎉 ALL TESTS PASSED! E2E SUITE IS PRODUCTION-READY.\n");
    } else {
      console.log(`\n⚠️  ${totalFailed} TEST(S) FAILED.\n`);
    }
  }

  process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL: Test runner crashed", err);
  process.exit(1);
});
