import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookSettingsTab } from '../webhook-settings-tab';
import { isBrutalistButton } from '@/test/utils/design-system';

const mockAuthorizedApiFetch = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue('token-123');
const mockGetWebhookEndpoint = vi.fn();
const mockListWebhookDeliveries = vi.fn();
const mockUpsertWebhookEndpoint = vi.fn();
const mockRotateWebhookEndpointSecret = vi.fn();
const mockDisableWebhookEndpoint = vi.fn();
const mockSendWebhookTestEvent = vi.fn();

function buildEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'endpoint-1',
    agencyId: 'agency-1',
    url: 'https://example.com/webhooks',
    status: 'active',
    subscribedEvents: ['access_request.completed'],
    failureCount: 0,
    secretLastFour: '1234',
    lastDeliveredAt: '2026-03-08T00:00:00.000Z',
    lastFailedAt: null,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    ...overrides,
  };
}

function buildDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delivery-1',
    eventId: 'event-1',
    eventType: 'access_request.completed',
    status: 'delivered',
    attemptNumber: 1,
    responseStatus: 200,
    responseBodySnippet: null,
    errorMessage: null,
    deliveredAt: '2026-03-08T00:00:03.000Z',
    createdAt: '2026-03-08T00:00:00.000Z',
    ...overrides,
  };
}

function mockEndpointQueries({
  endpoint,
  deliveries = [],
}: {
  endpoint: ReturnType<typeof buildEndpoint> | null;
  deliveries?: Array<ReturnType<typeof buildDelivery>>;
}) {
  mockGetWebhookEndpoint.mockResolvedValue(endpoint);
  mockListWebhookDeliveries.mockResolvedValue({
    endpoint,
    deliveries,
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'user_123',
    orgId: null,
    getToken: mockGetToken,
  }),
}));

vi.mock('@/lib/api/authorized-api-fetch', () => ({
  authorizedApiFetch: (...args: any[]) => mockAuthorizedApiFetch(...args),
}));

vi.mock('@/lib/api/webhooks', () => ({
  getWebhookEndpoint: (...args: any[]) => mockGetWebhookEndpoint(...args),
  listWebhookDeliveries: (...args: any[]) => mockListWebhookDeliveries(...args),
  upsertWebhookEndpoint: (...args: any[]) => mockUpsertWebhookEndpoint(...args),
  rotateWebhookEndpointSecret: (...args: any[]) => mockRotateWebhookEndpointSecret(...args),
  disableWebhookEndpoint: (...args: any[]) => mockDisableWebhookEndpoint(...args),
  sendWebhookTestEvent: (...args: any[]) => mockSendWebhookTestEvent(...args),
}));

describe('WebhookSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('token-123');
    mockAuthorizedApiFetch.mockResolvedValue({
      data: [{ id: 'agency-1', name: 'Agency One' }],
      error: null,
    });
    mockRotateWebhookEndpointSecret.mockResolvedValue({
      endpoint: {
        id: 'endpoint-1',
        agencyId: 'agency-1',
        url: 'https://example.com/webhooks',
        status: 'active',
        subscribedEvents: ['access_request.completed'],
        failureCount: 0,
        secretLastFour: '1234',
        lastDeliveredAt: null,
        lastFailedAt: null,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
      signingSecret: 'rotated_secret',
    });
    mockDisableWebhookEndpoint.mockResolvedValue({
      endpoint: {
        id: 'endpoint-1',
        agencyId: 'agency-1',
        url: 'https://example.com/webhooks',
        status: 'disabled',
        subscribedEvents: ['access_request.completed'],
        failureCount: 4,
        secretLastFour: '1234',
        lastDeliveredAt: null,
        lastFailedAt: '2026-03-08T00:00:00.000Z',
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
    });
    mockSendWebhookTestEvent.mockResolvedValue({ eventId: 'event-1', queued: true });
  });

  it('renders an active endpoint and recent deliveries', async () => {
    mockEndpointQueries({
      endpoint: buildEndpoint({
        subscribedEvents: ['access_request.partial', 'access_request.completed'],
      }),
      deliveries: [buildDelivery()],
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    expect(await screen.findByText('Webhook Endpoint')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('https://example.com/webhooks')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('access_request.completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inspect/i })).toBeInTheDocument();
  });

  it('creates an endpoint and reveals the signing secret handoff', async () => {
    mockEndpointQueries({
      endpoint: null,
      deliveries: [],
    });
    mockUpsertWebhookEndpoint.mockResolvedValue({
      endpoint: buildEndpoint({
        url: 'https://hooks.example.com/agency',
        subscribedEvents: ['webhook.test', 'access_request.completed'],
        secretLastFour: '5678',
        lastDeliveredAt: null,
      }),
      signingSecret: 'whsec_123456',
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    const user = userEvent.setup();
    const urlInput = await screen.findByLabelText('Destination URL');
    await user.type(urlInput, 'https://hooks.example.com/agency');
    await user.click(screen.getByLabelText('webhook.test'));
    await user.click(screen.getByRole('button', { name: /create endpoint/i }));

    await waitFor(() => {
      expect(mockUpsertWebhookEndpoint).toHaveBeenCalledWith(
        'agency-1',
        expect.objectContaining({
          url: 'https://hooks.example.com/agency',
          subscribedEvents: expect.arrayContaining(['webhook.test']),
        }),
        mockGetToken
      );
    });

    expect(await screen.findByText('Signing secret')).toBeInTheDocument();
    expect(screen.getByText('whsec_123456')).toBeInTheDocument();
  });

  it('updates an existing endpoint without showing the signing secret again', async () => {
    mockGetWebhookEndpoint
      .mockResolvedValueOnce(buildEndpoint())
      .mockResolvedValue(buildEndpoint({
        url: 'https://hooks.example.com/updated',
        subscribedEvents: ['webhook.test', 'access_request.completed'],
        updatedAt: '2026-03-08T01:00:00.000Z',
      }));
    mockListWebhookDeliveries.mockResolvedValue({
      endpoint: buildEndpoint(),
      deliveries: [],
    });
    mockUpsertWebhookEndpoint.mockResolvedValue({
      endpoint: buildEndpoint({
        url: 'https://hooks.example.com/updated',
        subscribedEvents: ['webhook.test', 'access_request.completed'],
        updatedAt: '2026-03-08T01:00:00.000Z',
      }),
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    const user = userEvent.setup();
    const urlInput = await screen.findByLabelText('Destination URL');
    await user.clear(urlInput);
    await user.type(urlInput, 'https://hooks.example.com/updated');
    await user.click(screen.getByLabelText('webhook.test'));
    await user.click(screen.getByRole('button', { name: /save endpoint/i }));

    await waitFor(() => {
      expect(mockUpsertWebhookEndpoint).toHaveBeenCalledWith(
        'agency-1',
        {
          url: 'https://hooks.example.com/updated',
          subscribedEvents: ['access_request.completed', 'webhook.test'],
        },
        mockGetToken
      );
    });

    expect(await screen.findByText('Endpoint updated.')).toBeInTheDocument();
    expect(screen.queryByText('Signing secret')).not.toBeInTheDocument();
  });

  it('rotates the signing secret and reveals the new handoff value', async () => {
    mockEndpointQueries({
      endpoint: buildEndpoint(),
      deliveries: [],
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /rotate secret/i }));

    await waitFor(() => {
      expect(mockRotateWebhookEndpointSecret).toHaveBeenCalledWith('agency-1', mockGetToken);
    });

    expect(await screen.findByText('Signing secret rotated. Update your receiver before sending more events.')).toBeInTheDocument();
    expect(screen.getByText('rotated_secret')).toBeInTheDocument();
  });

  it('disables an active endpoint and shows the disabled state', async () => {
    mockGetWebhookEndpoint
      .mockResolvedValueOnce(buildEndpoint())
      .mockResolvedValue(buildEndpoint({
        status: 'disabled',
        failureCount: 4,
        lastFailedAt: '2026-03-08T00:00:00.000Z',
      }));
    mockListWebhookDeliveries.mockResolvedValue({
      endpoint: buildEndpoint(),
      deliveries: [],
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /disable/i }));

    await waitFor(() => {
      expect(mockDisableWebhookEndpoint).toHaveBeenCalledWith('agency-1', mockGetToken);
    });

    expect(await screen.findByText('Endpoint disabled. Deliveries are paused until you save it again.')).toBeInTheDocument();
    expect(await screen.findByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Signing secret')).not.toBeInTheDocument();
  });

  it('queues a test event from the active endpoint state', async () => {
    mockEndpointQueries({
      endpoint: buildEndpoint(),
      deliveries: [buildDelivery()],
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /send test/i }));

    await waitFor(() => {
      expect(mockSendWebhookTestEvent).toHaveBeenCalledWith('agency-1', mockGetToken);
    });

    expect(await screen.findByText('Test event queued.')).toBeInTheDocument();
  });

  it('renders the empty state when no endpoint has been configured', async () => {
    mockEndpointQueries({
      endpoint: null,
      deliveries: [],
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    expect(await screen.findByText(/No endpoint is configured yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery history appears here after your first test send/i)).toBeInTheDocument();
    expect(screen.queryByText('Signing secret')).not.toBeInTheDocument();
  });

  it('surfaces the repeated-failure warning and failed delivery details', async () => {
    mockEndpointQueries({
      endpoint: buildEndpoint({
        failureCount: 3,
        lastFailedAt: '2026-03-08T02:00:00.000Z',
      }),
      deliveries: [
        buildDelivery({
          status: 'failed',
          responseStatus: 500,
          responseBodySnippet: 'temporary upstream outage',
          errorMessage: 'Server error',
        }),
      ],
    });

    renderWithQueryClient(<WebhookSettingsTab />);

    expect(await screen.findByText('Delivery attention needed')).toBeInTheDocument();
    expect(screen.getByText(/recent delivery failures/i)).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    expect(screen.getByText('Server error')).toBeInTheDocument();
    expect(screen.getByText('temporary upstream outage')).toBeInTheDocument();
  });

  describe('Design System v2.0 layout contract', () => {
    const isBrutalist = isBrutalistButton;

    it('renders one ink-panel strip with the wrapped endpoint URL and one brutalist button outside it', async () => {
      const longUrl = 'https://hooks.example.com/a/very/long/path/that/keeps/going/and/going/until/it/must/wrap/somewhere';
      mockEndpointQueries({
        endpoint: buildEndpoint({ url: longUrl }),
        deliveries: [buildDelivery()],
      });

      const { container } = renderWithQueryClient(<WebhookSettingsTab />);
      await screen.findByDisplayValue(longUrl);

      const panels = container.querySelectorAll('.ink-panel');
      expect(panels).toHaveLength(1);
      const panel = panels[0];

      // Endpoint URL lives in the strip and wraps rather than overflowing.
      const urlNode = Array.from(panel.querySelectorAll('*')).find((node) => node.textContent === longUrl);
      expect(urlNode).toBeDefined();
      expect(urlNode!.className).toMatch(/break-all|\[overflow-wrap:anywhere\]/);

      // Status badge and last delivery time sit in the strip.
      expect(panel.textContent).toMatch(/Active/);
      expect(panel.querySelector('.label-nano')).not.toBeNull();

      const brutalist = Array.from(container.querySelectorAll('button')).filter(isBrutalist);
      expect(brutalist).toHaveLength(1);
      expect(brutalist[0].textContent).toMatch(/save endpoint/i);
      expect(panel.contains(brutalist[0])).toBe(false);

      // Shadow budget and retired surfaces.
      expect(container.querySelectorAll('[class*="shadow-brutalist"]').length).toBeLessThanOrEqual(3);
      expect(container.querySelectorAll('[class*="bg-gradient"]')).toHaveLength(0);
      expect(container.querySelectorAll('[class*="rounded-3xl"]')).toHaveLength(0);
      expect(container.querySelectorAll('[class*="rounded-2xl"]')).toHaveLength(0);
      expect(container.querySelectorAll('.clean-card')).toHaveLength(0);
    });

    it('shows the empty-endpoint copy inside the ink-panel strip', async () => {
      mockEndpointQueries({ endpoint: null, deliveries: [] });

      const { container } = renderWithQueryClient(<WebhookSettingsTab />);
      const copy = await screen.findByText(/No endpoint is configured yet/i);

      const panel = container.querySelector('.ink-panel');
      expect(panel).not.toBeNull();
      expect(panel!.contains(copy)).toBe(true);
      expect(screen.getByRole('button', { name: /create endpoint/i })).toBeInTheDocument();
    });

    it('keeps the group shell and ink-panel while loading', () => {
      mockAuthorizedApiFetch.mockReturnValue(new Promise(() => {}));

      const { container } = renderWithQueryClient(<WebhookSettingsTab />);

      expect(screen.getByText('Webhook Endpoint')).toBeInTheDocument();
      expect(container.querySelectorAll('.ink-panel')).toHaveLength(1);
      expect(screen.queryByText(/No endpoint is configured yet/i)).not.toBeInTheDocument();
      expect(container.querySelectorAll('.clean-card')).toHaveLength(0);
    });

    it('keeps the group shell and ink-panel when a query fails', async () => {
      mockGetWebhookEndpoint.mockRejectedValue(new Error('Endpoint lookup failed'));
      mockListWebhookDeliveries.mockResolvedValue({ endpoint: null, deliveries: [] });

      const { container } = renderWithQueryClient(<WebhookSettingsTab />);

      expect(await screen.findByText('Endpoint lookup failed')).toBeInTheDocument();
      expect(screen.getByText('Webhook Endpoint')).toBeInTheDocument();
      expect(container.querySelectorAll('.ink-panel')).toHaveLength(1);
    });

    it('wraps long payload text in the delivery inspector', async () => {
      const snippet = 'x'.repeat(240);
      mockEndpointQueries({
        endpoint: buildEndpoint(),
        deliveries: [buildDelivery({ status: 'failed', responseStatus: 500, responseBodySnippet: snippet })],
      });
      renderWithQueryClient(<WebhookSettingsTab />);

      const payload = await screen.findByText(snippet);
      expect(payload.className).toMatch(/break-all|break-words|\[overflow-wrap:anywhere\]/);
    });

    it('uses danger for disable and secondary for rotate and test send', async () => {
      mockEndpointQueries({ endpoint: buildEndpoint(), deliveries: [] });
      renderWithQueryClient(<WebhookSettingsTab />);

      const disable = await screen.findByRole('button', { name: /disable/i });
      expect(disable.className).toContain('bg-danger-ink');
      expect(screen.getByRole('button', { name: /rotate secret/i }).className).not.toContain('shadow-brutalist');
      expect(screen.getByRole('button', { name: /send test/i }).className).not.toContain('shadow-brutalist');
    });
  });
});
