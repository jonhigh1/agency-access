const META_GRAPH_ORIGIN = 'https://graph.facebook.com';
export const META_GRAPH_TIMEOUT_MS = 15_000;

export function metaGraphGet(url: string, accessToken: string): Promise<Response> {
  const parsedUrl = new URL(url);
  if (parsedUrl.origin !== META_GRAPH_ORIGIN) {
    throw new Error('Meta Graph request URL must use graph.facebook.com');
  }

  parsedUrl.searchParams.delete('access_token');
  return fetch(parsedUrl.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(META_GRAPH_TIMEOUT_MS),
    redirect: 'error',
  });
}
