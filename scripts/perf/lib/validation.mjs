export function positiveNumber(value, name, { integer = false, min = 0 } = {}) {
  const number = Number(value);
  if (!String(value).trim() || !Number.isFinite(number) || number <= 0 || number < min || (integer && !Number.isInteger(number))) {
    throw new Error(`${name} must be ${integer ? 'an integer' : 'a number'} >= ${Math.max(min, Number.EPSILON)}`);
  }
  return number;
}

export async function assertPerfResponse(response, kind) {
  const ok = typeof response.ok === 'function' ? response.ok() : response.ok;
  const status = typeof response.status === 'function' ? response.status() : response.status;
  if (!ok) throw new Error(`${kind} HTTP ${status}`);

  const body = await response.text();
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch {
    throw new Error(`${kind} invalid response`);
  }

  const data = envelope?.data;
  const valid = envelope?.error === null && (kind === 'agencies'
    ? Array.isArray(data) && data.length > 0 && data.every((agency) => typeof agency?.id === 'string' && agency.id.length > 0)
    : typeof data?.agency?.id === 'string' && data.agency.id.length > 0
      && ['totalRequests', 'pendingRequests', 'activeConnections', 'totalPlatforms']
        .every((key) => Number.isInteger(data.stats?.[key]) && data.stats[key] >= 0)
      && Array.isArray(data.requests) && Array.isArray(data.connections));
  if (!valid) throw new Error(`${kind} invalid response`);
  return Buffer.byteLength(body);
}

export function safeReportUrl(url) {
  const safe = new URL(url);
  safe.search = '';
  safe.hash = '';
  return safe.toString();
}

export function redactPerfToken(text, token) {
  if (!token) return text;
  return [...new Set([encodeURIComponent(token), token])]
    .sort((a, b) => b.length - a.length)
    .reduce((safe, value) => safe.replaceAll(value, '[REDACTED]'), String(text));
}
