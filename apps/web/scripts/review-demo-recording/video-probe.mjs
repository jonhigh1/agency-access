import { spawnSync } from 'node:child_process';

export function probeVideoDimensions(filePath) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      filePath,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    return { ok: false, reason: result.stderr || 'ffprobe failed', width: 0, height: 0 };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const stream = parsed.streams?.[0];
    const width = Number(stream?.width ?? 0);
    const height = Number(stream?.height ?? 0);
    return { ok: true, width, height, reason: null };
  } catch {
    return { ok: false, reason: 'Could not parse ffprobe output', width: 0, height: 0 };
  }
}

export function meetsMin1080p(width, height) {
  return width >= 1920 && height >= 1080;
}

/**
 * @param {string} filePath
 * @returns {{ ok: boolean, reason: string | null, width: number, height: number, durationSec: number | null }}
 */
export function probeVideoFile(filePath) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      filePath,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    return {
      ok: false,
      reason: result.stderr || 'ffprobe failed',
      width: 0,
      height: 0,
      durationSec: null,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const stream = parsed.streams?.[0];
    const width = Number(stream?.width ?? 0);
    const height = Number(stream?.height ?? 0);
    const durationRaw = parsed.format?.duration;
    const durationSec =
      durationRaw === undefined || durationRaw === null ? null : Number(durationRaw);
    return {
      ok: true,
      width,
      height,
      durationSec: Number.isFinite(durationSec) ? durationSec : null,
      reason: null,
    };
  } catch {
    return {
      ok: false,
      reason: 'Could not parse ffprobe output',
      width: 0,
      height: 0,
      durationSec: null,
    };
  }
}
