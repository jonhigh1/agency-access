import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  expectedCaptionPrimaryForPermission,
  permissionLabelDetectable,
  requiredPermissionsForVerify,
} from './caption-expectations.mjs';
import { manifestPathForRun } from './paths.mjs';
import { meetsMin1080p, probeVideoFile } from './video-probe.mjs';

const DEFAULT_MIN_DURATION_SEC = Number(process.env.META_REVIEW_MIN_VIDEO_DURATION_SEC ?? 3);

/**
 * @typedef {'pass' | 'fail'} CheckStatus
 */

/**
 * @typedef {Object} PermissionCheck
 * @property {string} permission
 * @property {CheckStatus} status
 * @property {string[]} messages
 */

/**
 * @typedef {Object} VerifyRunResult
 * @property {boolean} ok
 * @property {string} runDir
 * @property {boolean} submitPackReady
 * @property {PermissionCheck[]} checks
 * @property {string[]} blockers
 * @property {Record<string, unknown> | null} runManifest
 */

/**
 * @param {string} filePath
 */
async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @param {unknown} value
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} permission
 */
function findManifestEntry(manifest, permission) {
  const entries = manifest.entries;
  if (!Array.isArray(entries)) {
    return null;
  }
  return entries.find((entry) => isRecord(entry) && entry.permission === permission) ?? null;
}

/**
 * @param {string | undefined} sidecarPath
 */
async function readCaptionSidecar(sidecarPath) {
  if (!sidecarPath) {
    return null;
  }
  try {
    const raw = await fs.readFile(sidecarPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    const primary = typeof parsed.primary === 'string' ? parsed.primary : null;
    return primary;
  } catch {
    return null;
  }
}

/**
 * @param {Object} options
 * @param {string} options.runDir
 * @param {boolean} [options.smoke]
 * @param {typeof probeVideoFile} [options.probeVideoFile]
 * @param {typeof fs.readFile} [options.readFile]
 * @param {typeof fs.stat} [options.stat]
 * @param {number | null} [options.minDurationSec]
 * @returns {Promise<VerifyRunResult>}
 */
export async function verifyScreencastRun({
  runDir,
  smoke = false,
  probeVideoFile: probeFn = probeVideoFile,
  readFile = fs.readFile,
  stat = fs.stat,
  minDurationSec = DEFAULT_MIN_DURATION_SEC,
}) {
  const resolvedRunDir = path.resolve(runDir);
  /** @type {PermissionCheck[]} */
  const checks = [];
  /** @type {string[]} */
  const blockers = [];

  let manifestRaw;
  try {
    manifestRaw = await readFile(manifestPathForRun(resolvedRunDir), 'utf8');
  } catch {
    blockers.push(`Missing run manifest at ${manifestPathForRun(resolvedRunDir)}`);
    return {
      ok: false,
      runDir: resolvedRunDir,
      submitPackReady: false,
      checks,
      blockers,
      runManifest: null,
    };
  }

  /** @type {Record<string, unknown>} */
  let runManifest;
  try {
    const parsed = JSON.parse(manifestRaw);
    if (!isRecord(parsed)) {
      throw new Error('manifest root must be an object');
    }
    runManifest = parsed;
  } catch {
    blockers.push('Run manifest.json is not valid JSON');
    return {
      ok: false,
      runDir: resolvedRunDir,
      submitPackReady: false,
      checks,
      blockers,
      runManifest: null,
    };
  }

  const permissions = requiredPermissionsForVerify(smoke);

  for (const permission of permissions) {
    /** @type {string[]} */
    const messages = [];
    let failed = false;

    const entry = findManifestEntry(runManifest, permission);
    if (!entry) {
      failed = true;
      messages.push(`manifest.json has no entry for permission ${permission}`);
    }

    const basename =
      entry && typeof entry.file === 'string' && entry.file.trim()
        ? entry.file.trim()
        : `${permission}.webm`;
    const videoPath = path.join(resolvedRunDir, basename);

    try {
      const videoStat = await stat(videoPath);
      if (!videoStat.isFile()) {
        failed = true;
        messages.push(`Expected video file is not a file: ${videoPath}`);
      } else if (entry && typeof entry.fileSizeBytes === 'number') {
        if (videoStat.size !== entry.fileSizeBytes) {
          failed = true;
          messages.push(
            `File size changed since recording (manifest ${entry.fileSizeBytes} bytes, now ${videoStat.size})`
          );
        }
      }

      if (entry && typeof entry.sha256 === 'string' && entry.sha256.length > 0) {
        const currentHash = await sha256File(videoPath);
        if (currentHash !== entry.sha256) {
          failed = true;
          messages.push('sha256 mismatch — video may have been replaced since recording');
        }
      }
    } catch {
      failed = true;
      messages.push(`Missing video file: ${videoPath}`);
    }

    if (!failed) {
      const probe = probeFn(videoPath);
      const manifestWidth = entry && typeof entry.width === 'number' ? entry.width : null;
      const manifestHeight = entry && typeof entry.height === 'number' ? entry.height : null;
      const manifestMeets =
        entry && typeof entry.meets1080p === 'boolean' ? entry.meets1080p : null;

      let width = manifestWidth ?? 0;
      let height = manifestHeight ?? 0;
      let durationSec =
        entry && typeof entry.durationSec === 'number' ? entry.durationSec : null;

      if (probe.ok) {
        width = probe.width;
        height = probe.height;
        durationSec = probe.durationSec ?? durationSec;
      } else if (manifestMeets === true && meetsMin1080p(manifestWidth ?? 0, manifestHeight ?? 0)) {
        messages.push(`Resolution taken from manifest (${probe.reason ?? 'ffprobe unavailable'})`);
      } else {
        failed = true;
        messages.push(
          probe.reason
            ? `Could not probe video resolution: ${probe.reason}`
            : 'Could not confirm ≥1080p resolution'
        );
      }

      if (!failed && !meetsMin1080p(width, height)) {
        failed = true;
        messages.push(`Resolution ${width}x${height} is below 1920x1080`);
      }

      if (
        !failed &&
        minDurationSec !== null &&
        Number.isFinite(minDurationSec) &&
        minDurationSec > 0
      ) {
        if (durationSec === null) {
          messages.push('Duration not verified (no ffprobe duration and no manifest durationSec)');
        } else if (durationSec < minDurationSec) {
          failed = true;
          messages.push(
            `Duration ${durationSec.toFixed(2)}s is below minimum ${minDurationSec}s`
          );
        }
      }

      const expectedCaption = expectedCaptionPrimaryForPermission(permission);
      const manifestCaption =
        entry && typeof entry.captionPrimary === 'string' ? entry.captionPrimary : null;
      const sidecarCaption = await readCaptionSidecar(
        path.join(resolvedRunDir, `${permission}.caption.json`)
      );
      const captionPrimary = manifestCaption ?? sidecarCaption;

      if (!captionPrimary) {
        failed = true;
        messages.push(
          'Missing caption metadata (manifest captionPrimary or sidecar .caption.json)'
        );
      } else if (manifestCaption && manifestCaption !== expectedCaption) {
        failed = true;
        messages.push(
          `captionPrimary "${manifestCaption}" does not match shot list "${expectedCaption}"`
        );
      } else if (!permissionLabelDetectable(captionPrimary, permission)) {
        failed = true;
        messages.push(`Caption metadata does not name permission ${permission}`);
      }
    }

    if (!failed && entry && typeof entry.meets1080p === 'boolean' && entry.meets1080p === false) {
      failed = true;
      messages.push('manifest entry meets1080p is false');
    }

    checks.push({
      permission,
      status: failed ? 'fail' : 'pass',
      messages: failed ? messages : messages.length > 0 ? messages : ['OK'],
    });

    if (failed) {
      blockers.push(`${permission}: ${messages.join('; ')}`);
    }
  }

  const ok = blockers.length === 0;
  return {
    ok,
    runDir: resolvedRunDir,
    submitPackReady: ok,
    checks,
    blockers,
    runManifest,
  };
}

/**
 * @param {VerifyRunResult} result
 */
export function formatVerificationReport(result) {
  const lines = [];
  lines.push('Meta App Review — screencast verification');
  lines.push(`Run directory: ${result.runDir}`);
  lines.push('');

  for (const check of result.checks) {
    const label = check.status === 'pass' ? 'PASS' : 'FAIL';
    lines.push(`${check.permission}: ${label}`);
    for (const message of check.messages) {
      lines.push(`  - ${message}`);
    }
  }

  lines.push('');
  if (result.ok) {
    lines.push(
      'Status: READY — submit pack may be marked ready for CEO Meta Submit (this tool does not submit to Meta).'
    );
  } else {
    lines.push('Status: BLOCKED — submit pack must NOT be marked ready until all checks pass.');
    for (const blocker of result.blockers) {
      lines.push(`  • ${blocker}`);
    }
  }

  return lines.join('\n');
}

