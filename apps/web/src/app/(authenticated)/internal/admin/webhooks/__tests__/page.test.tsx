import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InternalAdminWebhooksPage from '../page';

const useInternalAdminWebhookEndpointsMock = vi.fn();
const useInternalAdminWebhookDetailMock = vi.fn();

vi.mock('@/lib/query/internal-admin', () => ({
  useInternalAdminWebhookEndpoints: () => useInternalAdminWebhookEndpointsMock(),
  useInternalAdminWebhookDetail: () => useInternalAdminWebhookDetailMock(),
}));

describe('Internal admin webhooks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInternalAdminWebhookEndpointsMock.mockReturnValue({ data: [], isLoading: false, error: null });
    useInternalAdminWebhookDetailMock.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  it('keeps an accessible name on the webhook search field', () => {
    render(<InternalAdminWebhooksPage />);

    expect(screen.getByRole('searchbox', { name: 'Search webhook endpoints by agency name or email' })).toBeInTheDocument();
  });
});
