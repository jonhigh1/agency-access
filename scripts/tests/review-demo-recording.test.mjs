import assert from 'node:assert/strict';
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
