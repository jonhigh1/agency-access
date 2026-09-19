import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAccessRequest,
  getAccessRequest,
  updateAccessRequest,
  cancelAccessRequest,
  sendAccessRequestReminder,
} from '../access-requests';

function getAuthorizationHeader(headers: HeadersInit | undefined): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get('Authorization') ?? undefined;
  if (Array.isArray(headers)) {
    const tuple = headers.find(([key]) => key.toLowerCase() === 'authorization');
    return tuple?.[1];
  }

  const record = headers as Record<string, string>;
  return record.Authorization ?? record.authorization;
}

describe('access-requests api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).fetch = fetchMock;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  });

  it('includes Authorization header when creating an access request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'request-123' },
        error: null,
      }),
    });

    await createAccessRequest(
      {
        agencyId: 'agency-123',
        clientName: 'Client',
        clientEmail: 'client@example.com',
        platforms: [],
      },
      async () => 'token-123'
    );

    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(getAuthorizationHeader(requestOptions.headers)).toBe('Bearer token-123');
  });

  it('includes Authorization header when fetching an access request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'request-123' },
        error: null,
      }),
    });

    await getAccessRequest('request-123', async () => 'token-123');

    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(getAuthorizationHeader(requestOptions.headers)).toBe('Bearer token-123');
  });

  it('includes Authorization header when updating an access request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'request-123', authorizationLinkChanged: false },
        error: null,
      }),
    });

    await updateAccessRequest(
      'request-123',
      {
        platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin', accounts: [] }] }],
      },
      async () => 'token-123'
    );

    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(requestOptions.method).toBe('PATCH');
    expect(getAuthorizationHeader(requestOptions.headers)).toBe('Bearer token-123');
  });

  it('calls POST /api/access-requests/:id/cancel when cancelling an access request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { success: true },
        error: null,
      }),
    });

    const result = await cancelAccessRequest('request-456', async () => 'token-123');

    expect(result.data).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/access-requests/request-456/cancel',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
      })
    );
    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(getAuthorizationHeader(requestOptions.headers)).toBe('Bearer token-123');
  });

  it('calls POST /api/access-requests/:id/remind when sending a reminder', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          accessRequestId: 'request-456',
          sentAt: '2026-09-19T12:00:00.000Z',
          recipientEmail: 'client@example.com',
        },
        error: null,
      }),
    });

    const result = await sendAccessRequestReminder('request-456', async () => 'token-123');

    expect(result.data?.recipientEmail).toBe('client@example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/access-requests/request-456/remind',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
