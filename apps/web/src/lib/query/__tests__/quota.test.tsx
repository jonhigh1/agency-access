import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuotaCheck } from '../quota';

const { authorizedApiFetch } = vi.hoisted(() => ({ authorizedApiFetch: vi.fn() }));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgId: null, userId: 'user_1', getToken: vi.fn() }),
}));

vi.mock('@/lib/api/authorized-api-fetch', () => ({ authorizedApiFetch }));

describe('useQuotaCheck', () => {
  it('uses the signed-in user when Clerk has no active organization', async () => {
    authorizedApiFetch.mockResolvedValue({ data: { allowed: true } });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useQuotaCheck(), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    result.current.mutate({ metric: 'clients' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authorizedApiFetch).toHaveBeenCalledWith('/api/quota/check', expect.objectContaining({ method: 'POST' }));
  });
});
