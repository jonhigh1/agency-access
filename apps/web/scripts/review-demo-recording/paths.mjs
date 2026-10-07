import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../../..');

export const DEFAULT_ARTIFACTS_ROOT = path.join(repoRoot, 'artifacts/meta-app-review/screencasts');

export function resolveArtifactsRoot() {
  const configured = process.env.META_REVIEW_RECORDING_OUT_DIR?.trim();
  return configured ? path.resolve(configured) : DEFAULT_ARTIFACTS_ROOT;
}

export function createRunDirectory(root = resolveArtifactsRoot()) {
  const runId =
    process.env.META_REVIEW_RECORDING_RUN_ID?.trim() ||
    new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(root, runId);
}

export function videoPathForPermission(runDir, permissionKey, ext = 'webm') {
  return path.join(runDir, `${permissionKey}.${ext}`);
}

export function manifestPathForRun(runDir) {
  return path.join(runDir, 'manifest.json');
}

export async function writeRunManifest(runDir, entries) {
  await fs.mkdir(runDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    minResolution: '1080p',
    entries,
  };
  await fs.writeFile(manifestPathForRun(runDir), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}
