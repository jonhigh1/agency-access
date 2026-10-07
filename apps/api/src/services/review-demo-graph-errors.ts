export interface MetaGraphApiErrorDetails {
  code?: number;
  message: string;
  displayMessage: string;
}

export function formatMetaGraphApiError(raw: string): MetaGraphApiErrorDetails {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonCandidate = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;

  try {
    const body = JSON.parse(jsonCandidate) as { error?: { code?: number; message?: string } };
    if (body.error?.message) {
      const code = typeof body.error.code === 'number' ? body.error.code : undefined;
      return {
        code,
        message: body.error.message,
        displayMessage:
          code !== undefined
            ? `Meta Graph error #${code}: ${body.error.message}`
            : body.error.message,
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

export async function readMetaGraphApiError(response: Response): Promise<MetaGraphApiErrorDetails> {
  const text = await response.text();
  return formatMetaGraphApiError(text);
}
