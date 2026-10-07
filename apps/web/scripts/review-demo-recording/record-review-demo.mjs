#!/usr/bin/env node
/**
 * Meta App Review — Playwright screencast harness for /review-demo (#132 / build spec #135 §D).
 *
 * Produces one WebM per permission (≥1080p viewport) with burned-in caption overlay.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { assertRecordingPlanMatchesSteps, REVIEW_DEMO_RECORDING_PLAN } from './manifest.mjs';
import { installCaptionOverlay, setRecordingCaption } from './caption-overlay.mjs';
import { runStepPlan } from './run-actions.mjs';
import {
  createRunDirectory,
  resolveArtifactsRoot,
  videoPathForPermission,
  writeRunManifest,
} from './paths.mjs';
import { ensureClerkSignedIn, resolveBaseUrl } from './clerk-auth.mjs';
import { expectedCaptionPrimaryForPermission } from './caption-expectations.mjs';
import { meetsMin1080p, probeVideoDimensions, probeVideoFile } from './video-probe.mjs';

const VIEWPORT = { width: 1920, height: 1080 };
const HEADLESS = process.env.META_REVIEW_RECORDING_HEADLESS !== 'false';

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  return {
    smoke: flags.has('--smoke'),
    skipAuth: flags.has('--skip-clerk-auth'),
  };
}

async function finalizeVideo(rawPath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fs.rename(rawPath, targetPath);
  } catch {
    await fs.copyFile(rawPath, targetPath);
    await fs.rm(rawPath, { force: true });
  }
}

async function fileSha256(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function recordPermissionVideo(browser, plan, runDir, baseUrl, storageState) {
  const videoDir = path.join(runDir, '.playwright-video', plan.outputBasename);
  await fs.mkdir(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: VIEWPORT },
    storageState,
    colorScheme: 'light',
  });

  const page = await context.newPage();
  await installCaptionOverlay(page);

  await setRecordingCaption(
    page,
    'AuthHub Meta App Review demo',
    `Permission: ${plan.outputBasename} — guided /review-demo`
  );

  await page.goto(`${baseUrl}/review-demo`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByTestId('review-demo-root').waitFor({ state: 'visible', timeout: 60_000 });

  await runStepPlan(page, plan);

  const video = page.video();
  await context.close();

  if (!video) {
    throw new Error(`Playwright did not attach a video recorder for ${plan.outputBasename}`);
  }

  const rawPath = await video.path();
  const targetPath = videoPathForPermission(runDir, plan.outputBasename, 'webm');
  await finalizeVideo(rawPath, targetPath);

  const probe = probeVideoDimensions(targetPath);
  return {
    permission: plan.outputBasename,
    path: targetPath,
    probe,
  };
}

async function main() {
  assertRecordingPlanMatchesSteps();
  const { smoke, skipAuth } = parseArgs(process.argv.slice(2));
  const baseUrl = resolveBaseUrl();
  const runDir = createRunDirectory(resolveArtifactsRoot());
  await fs.mkdir(runDir, { recursive: true });

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: HEADLESS ? undefined : ['--start-maximized'],
  });

  let storageState;
  if (!skipAuth) {
    const bootstrapContext = await browser.newContext({ viewport: VIEWPORT });
    const bootstrapPage = await bootstrapContext.newPage();
    await ensureClerkSignedIn(bootstrapContext, bootstrapPage);
    storageState = await bootstrapContext.storageState();
    await bootstrapContext.close();
  }

  const plans = smoke ? REVIEW_DEMO_RECORDING_PLAN.slice(0, 1) : REVIEW_DEMO_RECORDING_PLAN;
  /** @type {Array<{ permission: string, path: string, probe: ReturnType<typeof probeVideoDimensions> }>} */
  const entries = [];

  try {
    for (const plan of plans) {
      const entry = await recordPermissionVideo(browser, plan, runDir, baseUrl, storageState);
      entries.push(entry);
      if (entry.probe.ok && !meetsMin1080p(entry.probe.width, entry.probe.height)) {
        console.warn(
          `[review-demo-recording] ${entry.permission}: video is ${entry.probe.width}x${entry.probe.height} (expected ≥1920x1080)`
        );
      }
    }
  } finally {
    await browser.close();
  }

  await writeRunManifest(
    runDir,
    await Promise.all(
      entries.map(async (entry) => {
        const fileStat = await fs.stat(entry.path);
        const fullProbe = probeVideoFile(entry.path);
        const width = fullProbe.ok ? fullProbe.width : entry.probe.width;
        const height = fullProbe.ok ? fullProbe.height : entry.probe.height;
        return {
          permission: entry.permission,
          file: path.basename(entry.path),
          width,
          height,
          meets1080p: meetsMin1080p(width, height),
          durationSec: fullProbe.durationSec,
          captionPrimary: expectedCaptionPrimaryForPermission(entry.permission),
          fileSizeBytes: fileStat.size,
          sha256: await fileSha256(entry.path),
        };
      })
    )
  );

  console.log(`Meta review demo screencasts written to ${runDir}`);
  for (const entry of entries) {
    console.log(`  - ${entry.permission}: ${entry.path}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
