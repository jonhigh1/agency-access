import { resolveApiUrl } from './api-env';

const AUTHORIZED_API_TIMEOUT_MS = 15_000;

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export class AuthorizedApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor({ code, message, status, details }: { code: string; message: string; status: number; details?: any }) {
    super(message);
    this.name = 'AuthorizedApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface AuthorizedApiFetchOptions extends Omit<RequestInit, 'headers'> {
  getToken: () => Promise<string | null>;
  headers?: HeadersInit;
}

export async function authorizedApiFetch<TResponse = any>(
  endpoint: string,
  options: AuthorizedApiFetchOptions
): Promise<TResponse> {
  const { getToken, headers, method = 'GET', signal: callerSignal, ...rest } = options;

  const token = await getToken();
  if (!token) {
    throw new AuthorizedApiError({
      code: 'UNAUTHORIZED',
      message: 'Missing authentication token',
      status: 401,
    });
  }

  const requestHeaders = new Headers(headers);
  requestHeaders.set('Authorization', `Bearer ${token}`);
  if (!requestHeaders.has('Content-Type') && rest.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, AUTHORIZED_API_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  if (callerSignal?.aborted) controller.abort();

  try {
    const response = await fetch(resolveApiUrl(endpoint), {
      ...rest,
      method,
      headers: requestHeaders,
      signal: controller.signal,
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const responseError = payload?.error;
    if (!response.ok || responseError) {
      throw new AuthorizedApiError({
        code: responseError?.code || 'REQUEST_FAILED',
        message: responseError?.message || `Request failed with status ${response.status}`,
        status: response.status,
        details: responseError?.details,
      });
    }

    return payload as TResponse;
  } catch (error) {
    if (didTimeout) {
      throw new AuthorizedApiError({
        code: 'TIMEOUT',
        message: 'Request timed out. Please try again.',
        status: 408,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
