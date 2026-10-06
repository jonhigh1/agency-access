import { extractMessageFromBody } from './extract-error';

export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

interface ParseJsonResponseOptions {
  fallbackErrorMessage?: string;
  fallbackParseMessage?: string;
}

export async function parseJsonResponse<T>(
  response: Response,
  options: ParseJsonResponseOptions = {}
): Promise<T> {
  const {
    fallbackErrorMessage = 'Request failed',
    fallbackParseMessage = 'Authorization service returned an unexpected response. Please try again.',
  } = options;

  const rawBody = await response.text();

  if (!rawBody) {
    if (!response.ok) {
      throw new Error(response.statusText || fallbackErrorMessage);
    }

    throw new Error(fallbackParseMessage);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    if (!response.ok) {
      throw new Error(response.statusText || fallbackErrorMessage);
    }

    throw new Error(fallbackParseMessage);
  }

  if (!response.ok) {
    const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const error = body.error && typeof body.error === 'object'
      ? body.error as Record<string, unknown>
      : {};
    throw new ApiResponseError(
      extractMessageFromBody(payload, response.statusText || fallbackErrorMessage),
      typeof error.code === 'string' ? error.code : undefined,
      error.details,
    );
  }

  return payload as T;
}
