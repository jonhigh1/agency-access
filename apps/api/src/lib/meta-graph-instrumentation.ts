import {
  assertNoTokenMaterialInSerializedGraphOps,
  formatMetaGraphOpCaption,
  normalizeMetaGraphEdge,
  parseMetaGraphApiErrorText,
  sanitizeMetaGraphErrorMessage,
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
  logger.info('meta_graph_op', { graphOp: record });
}

async function parseMetaGraphErrorFields(
  response: Response
): Promise<Pick<
  MetaGraphOpRecord,
  'metaCode' | 'metaMessage' | 'metaType' | 'metaErrorSubcode' | 'fbtraceId'
>> {
  if (response.ok) return {};
  try {
    const readable = typeof response.clone === 'function' ? response.clone() : response;
    if (typeof readable.text !== 'function') return {};
    const details = parseMetaGraphApiErrorText(await readable.text());
    return {
      ...(details.code !== undefined ? { metaCode: details.code } : {}),
      ...(details.message ? { metaMessage: sanitizeMetaGraphErrorMessage(details.message) } : {}),
      ...(details.type ? { metaType: details.type } : {}),
      ...(details.errorSubcode !== undefined ? { metaErrorSubcode: details.errorSubcode } : {}),
      ...(details.fbtraceId ? { fbtraceId: details.fbtraceId } : {}),
    };
  } catch {
    return {};
  }
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

  const metaErrorFields = await parseMetaGraphErrorFields(response);
  recordMetaGraphOp({
    method,
    edge: normalizeMetaGraphEdge(parsedUrl.toString()),
    tokenClass,
    outcome: response.ok ? 'ok' : 'error',
    ...metaErrorFields,
  });

  return response;
}
