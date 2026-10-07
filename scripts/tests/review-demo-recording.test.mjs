import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const harnessDir = path.join(repoRoot, 'apps/web/scripts/review-demo-recording');

test('recording manifest stays aligned with permission keys and output basenames', async () => {
  const manifest = await import(pathToFileURL(path.join(harnessDir, 'manifest.mjs')).href);
  manifest.assertRecordingPlanMatchesSteps();
  assert.deepEqual(manifest.REVIEW_DEMO_RECORDING_STEPS, [
    'pages_show_list',
    'pages_read_engagement',
    'ads_management',
    'business_management',
  ]);
});

test('artifact paths map permission keys to filenames', async () => {
  const paths = await import(pathToFileURL(path.join(harnessDir, 'paths.mjs')).href);
  const runDir = '/tmp/meta-review-run';
  assert.equal(
    paths.videoPathForPermission(runDir, 'ads_management'),
    path.join(runDir, 'ads_management.webm')
  );
});

test('1080p probe helper enforces minimum capture size', async () => {
  const probe = await import(pathToFileURL(path.join(harnessDir, 'video-probe.mjs')).href);
  assert.equal(probe.meetsMin1080p(1920, 1080), true);
  assert.equal(probe.meetsMin1080p(1280, 720), false);
});

const PERMISSIONS = [
  'pages_show_list',
  'pages_read_engagement',
  'ads_management',
  'business_management',
];

async function writeStubRun(tmpDir, { omitPermission, lowResolution } = {}) {
  const captionExpectations = await import(
    pathToFileURL(path.join(harnessDir, 'caption-expectations.mjs')).href
  );
  /** @type {Array<Record<string, unknown>>} */
  const entries = [];
  for (const permission of PERMISSIONS) {
    if (permission === omitPermission) {
      continue;
    }
    const content = Buffer.from(`stub-webm-${permission}`);
    const fileName = `${permission}.webm`;
    await fs.writeFile(path.join(tmpDir, fileName), content);
    const width = lowResolution === permission ? 1280 : 1920;
    const height = lowResolution === permission ? 720 : 1080;
    entries.push({
      permission,
      file: fileName,
      width,
      height,
      meets1080p: width >= 1920 && height >= 1080,
      durationSec: 8,
      captionPrimary: captionExpectations.expectedCaptionPrimaryForPermission(permission),
      fileSizeBytes: content.length,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    });
  }

  await fs.writeFile(
    path.join(tmpDir, 'manifest.json'),
    `${JSON.stringify(
      {
        generatedAt: '2026-01-01T00:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        minResolution: '1080p',
        entries,
      },
      null,
      2
    )}\n`
  );
}

test('screencast verifier passes a complete four-permission run', async () => {
  const verifyRun = await import(pathToFileURL(path.join(harnessDir, 'verify-run.mjs')).href);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meta-review-verify-pass-'));
  await writeStubRun(tmpDir);

  const result = await verifyRun.verifyScreencastRun({
    runDir: tmpDir,
    probeVideoFile: () => ({
      ok: true,
      width: 1920,
      height: 1080,
      durationSec: 8,
      reason: null,
    }),
    minDurationSec: 3,
  });

  assert.equal(result.ok, true);
  assert.equal(result.submitPackReady, true);
  assert.equal(result.checks.length, 4);
});

test('screencast verifier blocks submit pack when a permission file is missing', async () => {
  const verifyRun = await import(pathToFileURL(path.join(harnessDir, 'verify-run.mjs')).href);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meta-review-verify-fail-'));
  await writeStubRun(tmpDir, { omitPermission: 'ads_management' });

  const result = await verifyRun.verifyScreencastRun({
    runDir: tmpDir,
    probeVideoFile: () => ({
      ok: true,
      width: 1920,
      height: 1080,
      durationSec: 8,
      reason: null,
    }),
    minDurationSec: 3,
  });

  assert.equal(result.ok, false);
  assert.equal(result.submitPackReady, false);
  assert.match(result.blockers.join('\n'), /ads_management/);
});

test('screencast verifier fails when resolution is below 1080p', async () => {
  const verifyRun = await import(pathToFileURL(path.join(harnessDir, 'verify-run.mjs')).href);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meta-review-verify-res-'));
  await writeStubRun(tmpDir, { lowResolution: 'pages_show_list' });

  const result = await verifyRun.verifyScreencastRun({
    runDir: tmpDir,
    probeVideoFile: (filePath) => {
      if (filePath.endsWith('pages_show_list.webm')) {
        return {
          ok: true,
          width: 1280,
          height: 720,
          durationSec: 8,
          reason: null,
        };
      }
      return {
        ok: true,
        width: 1920,
        height: 1080,
        durationSec: 8,
        reason: null,
      };
    },
    minDurationSec: 3,
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /pages_show_list/);
  assert.match(result.blockers.join('\n'), /1280x720/);
});

test('caption expectation helper matches shot list primary lines', async () => {
  const captionExpectations = await import(
    pathToFileURL(path.join(harnessDir, 'caption-expectations.mjs')).href
  );
  assert.equal(
    captionExpectations.expectedCaptionPrimaryForPermission('ads_management'),
    'Permission: ads_management'
  );
  assert.equal(
    captionExpectations.permissionLabelDetectable('Permission: pages_show_list', 'pages_show_list'),
    true
  );
});
