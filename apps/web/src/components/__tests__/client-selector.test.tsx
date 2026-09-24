/**
 * ClientSelector Component Tests
 *
 * Test-Driven Development for Phase 5 Client Selection
 * Following Red-Green-Refactor cycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientSelector } from '../client-selector';

const { mockGetToken, mockCapture } = vi.hoisted(() => ({
  mockGetToken: vi.fn(),
  mockCapture: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'user_123',
    orgId: null,
    isLoaded: true,
    getToken: mockGetToken,
  }),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: mockCapture,
}));

// Mock fetch
global.fetch = vi.fn();

const unauthorizedResponse = {
  ok: false,
  status: 401,
  json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }),
};

describe('Phase 5: ClientSelector - TDD Tests', () => {
  const mockClients = [
    { id: 'client-1', name: 'Acme Corporation', company: 'Acme', email: 'contact@acme.com', language: 'en' },
    { id: 'client-2', name: 'TechStart Inc', company: 'TechStart', email: 'hello@techstart.io', language: 'es' },
    { id: 'client-3', name: 'Global Marketing LLC', company: 'Global', email: 'info@global.com', language: 'nl' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('mock-token');
    // @ts-ignore
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockClients, pagination: { total: 3, limit: 50, offset: 0 } }),
    });
  });

  describe('Initial Rendering', () => {
    it('should render search input', () => {
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(screen.getByPlaceholderText(/search clients/i)).toBeInTheDocument();
    });

    it('should render "Add new client" button', () => {
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(screen.getByRole('button', { name: /add new client/i })).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      // @ts-ignore
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    });
  });

  describe('Client Search', () => {
    it('should load and display clients on mount', async () => {
      const onSelect = vi.fn();
      render(<ClientSelector agencyId="agency-1" onSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
      });
    });

    it('should filter clients by search query', async () => {
      const user = userEvent.setup();
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // @ts-ignore
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockClients[0]], pagination: { total: 1, limit: 50, offset: 0 } }),
      });

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'Acme');

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        expect(screen.queryByText('TechStart Inc')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no clients match search', async () => {
      const user = userEvent.setup();
      // @ts-ignore
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }),
      });

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'NonExistent');

      await waitFor(() => {
        expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
      });
    });

    it('should show error state on API failure', async () => {
      // @ts-ignore
      global.fetch.mockRejectedValue(new Error('API Error'));

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load clients/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Load Failure Recovery', () => {
    const okResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: mockClients, pagination: { total: 3, limit: 50, offset: 0 } }),
    };

    it('should refresh the token and retry once when the client list returns 401', async () => {
      mockGetToken.mockImplementation(async (options?: { skipCache?: boolean }) =>
        options?.skipCache ? 'fresh-token' : 'stale-token'
      );
      // @ts-ignore
      global.fetch.mockResolvedValueOnce(unauthorizedResponse).mockResolvedValue(okResponse);

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(await screen.findByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.queryByText(/failed to load clients/i)).not.toBeInTheDocument();
      expect(mockGetToken).toHaveBeenCalledWith({ skipCache: true });

      // @ts-ignore
      const [, retryInit] = global.fetch.mock.calls[1];
      expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer fresh-token');
      expect(mockCapture).toHaveBeenCalledWith('client_list_auth_recovered');
      expect(mockCapture).not.toHaveBeenCalledWith('client_list_load_failed', expect.anything());
    });

    it('should show the error and capture the failure when the retry also returns 401', async () => {
      // @ts-ignore
      global.fetch.mockResolvedValue(unauthorizedResponse);

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockCapture).toHaveBeenCalledWith('client_list_load_failed', {
        status: 401,
        error_code: 'UNAUTHORIZED',
        token_refreshed: true,
      });
    });

    it('should not retry on a non-401 failure', async () => {
      // @ts-ignore
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Boom' } }),
      });

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockGetToken).not.toHaveBeenCalledWith({ skipCache: true });
      expect(mockCapture).toHaveBeenCalledWith('client_list_load_failed', {
        status: 500,
        error_code: 'INTERNAL_ERROR',
        token_refreshed: false,
      });
    });
  });

  describe('Client Selection', () => {
    it('should call onSelect when a client is clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(<ClientSelector agencyId="agency-1" onSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Acme Corporation'));

      expect(onSelect).toHaveBeenCalledWith(mockClients[0]);
    });

    it('should highlight selected client', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <ClientSelector agencyId="agency-1" onSelect={onSelect} value={mockClients[0].id} />
      );

      await waitFor(() => {
        const acmeCard = screen.getByText('Acme Corporation').closest('[role="button"]');
        expect(acmeCard).toHaveClass('border-coral');
      });
    });
  });

  describe('Add New Client Flow', () => {
    it('should show new client form when "Add new client" is clicked', async () => {
      const user = userEvent.setup();
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /add new client/i }));

      expect(screen.getByText(/create new client/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should validate required fields when creating new client', async () => {
      const user = userEvent.setup();
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /add new client/i }));

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create client/i });
      await user.click(submitButton);

      expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/company is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      // Mock fetch to prevent hanging if validation fails
      // @ts-ignore
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ errorCode: 'VALIDATION_ERROR' }),
      });

      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /add new client/i }));

      await user.type(screen.getByLabelText(/client name/i), 'Test Client');
      await user.type(screen.getByLabelText(/company/i), 'Test Company');
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /create client/i });
      await user.click(submitButton);

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('should create new client and call onSelect', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      // @ts-ignore
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-client', name: 'New Client', company: 'New Co', email: 'new@test.com', language: 'en' }),
      });

      render(<ClientSelector agencyId="agency-1" onSelect={onSelect} />);

      await user.click(screen.getByRole('button', { name: /add new client/i }));

      await user.type(screen.getByLabelText(/client name/i), 'New Client');
      await user.type(screen.getByLabelText(/company/i), 'New Co');
      await user.type(screen.getByLabelText(/email/i), 'new@test.com');

      const submitButton = screen.getByRole('button', { name: /create client/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith({
          id: 'new-client',
          name: 'New Client',
          company: 'New Co',
          email: 'new@test.com',
          language: 'en',
        });
      });
    });

    it('should cancel new client form and return to list', async () => {
      const user = userEvent.setup();
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      // Open form
      await user.click(screen.getByRole('button', { name: /add new client/i }));
      expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();

      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByLabelText(/client name/i)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search clients/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const firstClient = screen.getByRole('button', { name: /acme corporation/i });
      firstClient.focus();
      expect(firstClient).toHaveFocus();
    });

    it('should have proper ARIA labels', () => {
      render(<ClientSelector agencyId="agency-1" onSelect={vi.fn()} />);

      expect(screen.getByPlaceholderText(/search clients/i)).toHaveAttribute('aria-label', 'Search clients');
    });
  });
});
