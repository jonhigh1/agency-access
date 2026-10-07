#!/usr/bin/env node
/**
 * Meta App Review — screencast verifier (#133 / build spec #135 §E).
 * Green exit = harness run is complete enough to mark the submit pack ready (CEO Submit is manual).
 */
import fs from 'node:fs/promises';
import {
  findLatestRunDirectory,
  resolveArtifactsRoot,
  resolveRunDirectoryForVerify,
  submitPackReadyMarkerPath,
} from './paths.mjs';
import { formatVerificationReport, verifyScreencastRun } from './verify-run.mjs';

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const runDirIndex = argv.indexOf('--run-dir');
  const runDir = runDirIndex >= 0 ? argv[runDirIndex + 1] : undefined;
  return {
    smoke: flags.has('--smoke'),
    latest: flags.has('--latest'),
    markReady: flags.has('--mark-submit-pack-ready'),
    runDir,
  };
}

async function resolveRunDir({ runDir, latest }) {
  const fromFlagOrEnv = resolveRunDirectoryForVerify(runDir);
  if (fromFlagOrEnv) {
    return fromFlagOrEnv;
  }
  if (latest) {
    const latestRun = await findLatestRunDirectory(resolveArtifactsRoot());
    if (!latestRun) {
      throw new Error(
        `No run folders with manifest.json under ${resolveArtifactsRoot()} (try recording first)`
      );
    }
    return latestRun;
  }
  throw new Error(
    'Pass --run-dir <path>, set META_REVIEW_RECORDING_RUN_ID, or use --latest under the artifacts root'
  );
}

async function main() {
  const { smoke, latest, markReady, runDir } = parseArgs(process.argv.slice(2));
  const resolvedRunDir = await resolveRunDir({ runDir, latest });

  const result = await verifyScreencastRun({ runDir: resolvedRunDir, smoke });
  const report = formatVerificationReport(result);
  console.log(report);

  const reportPath = `${resolvedRunDir}/verification-report.txt`;
  await fs.writeFile(reportPath, `${report}\n`, 'utf8');

  if (!result.ok) {
    process.exit(1);
  }

  if (markReady) {
    const marker = {
      markedReadyAt: new Date().toISOString(),
      runDir: resolvedRunDir,
      manifestGeneratedAt:
        result.runManifest && typeof result.runManifest.generatedAt === 'string'
          ? result.runManifest.generatedAt
          : null,
      note: 'CEO Meta App Review Submit only — verifier never submits to Meta.',
    };
    await fs.writeFile(
      submitPackReadyMarkerPath(resolvedRunDir),
      `${JSON.stringify(marker, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote ${submitPackReadyMarkerPath(resolvedRunDir)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
