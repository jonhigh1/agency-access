import type { MetaGraphTokenClass } from '@agency-platform/shared';
import { metaGraphFetch } from './meta-graph-instrumentation.js';

export const META_GRAPH_TIMEOUT_MS = 15_000;

export type MetaGraphGetContext = {
  tokenClass?: MetaGraphTokenClass;
};

export function metaGraphGet(
  url: string,
  accessToken: string,
  context: MetaGraphGetContext = {}
): Promise<Response> {
  return metaGraphFetch(url, {
    method: 'GET',
    accessToken,
    tokenClass: context.tokenClass ?? 'client_user',
    signal: AbortSignal.timeout(META_GRAPH_TIMEOUT_MS),
    redirect: 'error',
  });
}
