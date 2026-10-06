import {
  assertNoTokenMaterialInSerializedGraphOps,
  formatMetaGraphOpCaption,
  normalizeMetaGraphEdge,
  serializeMetaGraphOp,
  type MetaGraphOpRecord,
  type MetaGraphTokenClass,
} from '@agency-platform/shared';
import { logger } from './logger.js';

const recordedOps: MetaGraphOpRecord[] = [];

export function clearRecordedMetaGraphOps(): void {
  recordedOps.length = 0;
}

export function getRecordedMetaGraphOps(): readonly MetaGraphOpRecord[] {
  return [...recordedOps];
}

export function getMetaGraphOpCaptions(): string[] {
  return recordedOps.map((op) => formatMetaGraphOpCaption(op));
}

export function recordMetaGraphOp(record: MetaGraphOpRecord): void {
  const serialized = serializeMetaGraphOp(record);
  assertNoTokenMaterialInSerializedGraphOps(serialized);
  recordedOps.push(record);
  logger.info({ graphOp: record }, 'meta_graph_op');
}

async function parseMetaErrorCode(response: Response): Promise<number | undefined> {
  if (response.ok) return undefined;
  try {
    const readable = typeof response.clone === 'function' ? response.clone() : response;
    if (typeof readable.text !== 'function') return undefined;
    const body = JSON.parse(await readable.text()) as { error?: { code?: number } };
    if (typeof body.error?.code === 'number') return body.error.code;
  } catch {
    // Non-JSON error bodies are ignored for metaCode extraction.
  }
  return undefined;
}

export type MetaGraphFetchOptions = RequestInit & {
  accessToken?: string;
  tokenClass: MetaGraphTokenClass;
};

export async function metaGraphFetch(url: string, options: MetaGraphFetchOptions): Promise<Response> {
  const parsedUrl = new URL(url);
  if (parsedUrl.origin !== 'https://graph.facebook.com') {
    throw new Error('Meta Graph request URL must use graph.facebook.com');
  }

  parsedUrl.searchParams.delete('access_token');
  const method = (options.method ?? 'GET').toUpperCase() as MetaGraphOpRecord['method'];
  const headers = new Headers(options.headers);
  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const { accessToken: _token, tokenClass, ...init } = options;
  const response = await fetch(parsedUrl.toString(), {
    ...init,
    method,
    headers,
  });

  const metaCode = await parseMetaErrorCode(response);
  recordMetaGraphOp({
    method,
    edge: normalizeMetaGraphEdge(parsedUrl.toString()),
    tokenClass,
    outcome: response.ok ? 'ok' : 'error',
    ...(metaCode !== undefined ? { metaCode } : {}),
  });

  return response;
}
