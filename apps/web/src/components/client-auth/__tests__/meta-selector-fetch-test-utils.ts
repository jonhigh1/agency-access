import { vi } from 'vitest';

export function metaCreationLinksJsonResponse(): Response {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        data: {
          pageCreationUrl: 'https://business.facebook.com/pages/creation/?business_id=biz-1',
          pixelCreationUrl: 'https://business.facebook.com/events_manager2/pixel/new/?business_id=biz-1',
          adAccountCreationUrl: 'https://business.facebook.com/settings/biz-1/ad_accounts',
        },
        error: null,
      }),
  } as Response;
}

/** Intercepts `/create/meta/links` so asset fetch mocks keep stable indices. */
export function stubFetchWithCreationLinks(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/create/meta/links')) {
        return Promise.resolve(metaCreationLinksJsonResponse());
      }
      return fetchMock(url, init);
    })
  );
}

export function fetchCallUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): string | undefined {
  return fetchMock.mock.calls[index]?.[0] as string | undefined;
}
