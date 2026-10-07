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

/**
 * Resolve a harness run folder for verification (same env as recording).
 * @param {string | undefined} explicitRunDir
 */
export function resolveRunDirectoryForVerify(explicitRunDir) {
  const trimmed = explicitRunDir?.trim();
  if (trimmed) {
    return path.resolve(trimmed);
  }
  const runId = process.env.META_REVIEW_RECORDING_RUN_ID?.trim();
  if (runId) {
    return path.join(resolveArtifactsRoot(), runId);
  }
  return null;
}

/** @param {string} artifactsRoot */
export async function findLatestRunDirectory(artifactsRoot = resolveArtifactsRoot()) {
  let names;
  try {
    names = await fs.readdir(artifactsRoot);
  } catch {
    return null;
  }

  const candidates = [];
  for (const name of names) {
    const runDir = path.join(artifactsRoot, name);
    try {
      const stat = await fs.stat(runDir);
      if (!stat.isDirectory()) {
        continue;
      }
      const manifestStat = await fs.stat(manifestPathForRun(runDir)).catch(() => null);
      if (!manifestStat?.isFile()) {
        continue;
      }
      candidates.push({ runDir, mtimeMs: manifestStat.mtimeMs });
    } catch {
      // skip unreadable entries
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.runDir ?? null;
}

export function submitPackReadyMarkerPath(runDir) {
  return path.join(runDir, 'submit-pack-ready.json');
}
