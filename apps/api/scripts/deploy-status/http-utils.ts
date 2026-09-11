/**
 * Shared HTTP/text helpers for the Vercel and Render deploy-status clients
 * (U2). Neither platform's version of these was platform-specific — they
 * were duplicated verbatim between vercel.ts and render.ts (simplify-pass
 * finding). Extracted here so both files import one copy.
 */

/** Default cap on returned log-excerpt length (bytes, ASCII-approximate). */
export const DEFAULT_LOG_EXCERPT_MAX_CHARS = 4000;

/** Reads a non-OK response body for inclusion in a typed API error. */
export async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text || response.statusText || 'unknown error';
  } catch {
    return response.statusText || 'unknown error';
  }
}

/** Bearer-token auth header, shared by both platforms' bare Authorization scheme. */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Bounds `text` to `maxLength`, keeping the head and noting how much was cut from the tail. */
export function boundHead(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const omitted = text.length - maxLength;
  return `${text.slice(0, maxLength)}\n... [truncated, ${omitted} more characters]`;
}

/** Bounds `text` to `maxLength`, keeping the tail and noting how much was cut from the head. */
export function boundTail(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const omitted = text.length - maxLength;
  return `... [truncated, ${omitted} earlier characters]\n${text.slice(-maxLength)}`;
}
