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
