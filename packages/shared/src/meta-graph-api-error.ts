import { z } from 'zod';

export const MetaGraphApiErrorBodySchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().optional(),
      code: z.number().optional(),
      error_subcode: z.number().optional(),
      fbtrace_id: z.string().optional(),
    })
    .optional(),
});

export type MetaGraphApiErrorBody = z.infer<typeof MetaGraphApiErrorBodySchema>;

export interface MetaGraphApiErrorDetails {
  code?: number;
  errorSubcode?: number;
  message: string;
  type?: string;
  fbtraceId?: string;
  displayMessage: string;
}

function buildDisplayMessage(fields: {
  code?: number;
  errorSubcode?: number;
  message: string;
  type?: string;
  fbtraceId?: string;
}): string {
  let head =
    fields.code !== undefined ? `Meta Graph error #${fields.code}` : 'Meta Graph error';
  if (fields.type) {
    head += ` (${fields.type})`;
  }
  let message = `${head}: ${fields.message}`;
  if (fields.errorSubcode !== undefined) {
    message += ` (subcode ${fields.errorSubcode})`;
  }
  if (fields.fbtraceId) {
    message += ` [fbtrace_id ${fields.fbtraceId}]`;
  }
  return message;
}

export function parseMetaGraphApiErrorText(raw: string): MetaGraphApiErrorDetails {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonCandidate = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;

  try {
    const parsed = MetaGraphApiErrorBodySchema.parse(JSON.parse(jsonCandidate));
    if (parsed.error) {
      const code = typeof parsed.error.code === 'number' ? parsed.error.code : undefined;
      const errorSubcode =
        typeof parsed.error.error_subcode === 'number' ? parsed.error.error_subcode : undefined;
      const message =
        parsed.error.message ??
        (code !== undefined ? `Meta Graph API error (${code})` : 'Meta Graph API error');
      const type = parsed.error.type;
      const fbtraceId = parsed.error.fbtrace_id;
      return {
        code,
        errorSubcode,
        message,
        type,
        fbtraceId,
        displayMessage: buildDisplayMessage({ code, errorSubcode, message, type, fbtraceId }),
      };
    }
  } catch {
    // Fall through to raw text.
  }

  return {
    message: trimmed,
    displayMessage: trimmed,
  };
}

export async function readMetaGraphApiErrorFromResponse(
  response: Response
): Promise<MetaGraphApiErrorDetails> {
  const text = await response.text();
  return parseMetaGraphApiErrorText(text);
}

/** Redact token-like fragments before logging Graph error messages. */
export function sanitizeMetaGraphErrorMessage(message: string): string {
  return message.replace(/access_token=\S+/gi, '').replace(/\s{2,}/g, ' ').trim();
}
