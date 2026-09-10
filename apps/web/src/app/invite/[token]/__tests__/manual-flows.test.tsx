import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeehiivManualPage from '../beehiiv/manual/page';
import KitManualPage from '../kit/manual/page';
import KlaviyoManualPage from '../klaviyo/manual/page';
import MailchimpManualPage from '../mailchimp/manual/page';
import PinterestManualPage from '../pinterest/manual/page';
import ShopifyManualPage from '../shopify/manual/page';

const { pushMock, backMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ token: 'token-123' })),
  useRouter: vi.fn(() => ({ push: pushMock, back: backMock })),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

function buildPayload(overrides?: Partial<any>) {
  return {
    data: {
      id: 'request-1',
      agencyId: 'agency-1',
      agencyName: 'Demo Agency',
      clientName: 'Client',
      clientEmail: 'client@test.com',
      status: 'pending',
      uniqueToken: 'token-123',
      expiresAt: new Date().toISOString(),
      intakeFields: [],
      branding: {},
      platforms: [
        {
          platformGroup: 'beehiiv',
          products: [{ product: 'beehiiv', accessLevel: 'admin' }],
        },
      ],
      manualInviteTargets: {
        beehiiv: { agencyEmail: 'ops@demoagency.com' },
        kit: { agencyEmail: 'ops@demoagency.com' },
        klaviyo: { agencyEmail: 'ops@demoagency.com' },
        mailchimp: { agencyEmail: 'ops@demoagency.com' },
        pinterest: { businessId: '123456789' },
        shopify: { shopDomain: 'store-demo.myshopify.com', collaboratorCode: '1234' },
      },
      authorizationProgress: { completedPlatforms: [], isComplete: false },
      ...overrides,
    },
    error: null,
  };
}

async function clickPrimaryAction(label: string) {
  const buttons = screen.getAllByRole('button', { name: label });
  const activeButton = buttons.find((button) => !button.hasAttribute('disabled')) || buttons[0];
  await userEvent.click(activeButton);
}

describe('Manual invite flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Beehiiv flow gates completion and redirects on successful manual connect', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/beehiiv/manual-connect')) {
        return {
          ok: true,
          json: async () => ({ data: { connectionId: 'conn-beehiiv-1' }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => buildPayload(),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<BeehiivManualPage />);

    await screen.findByText(/copy invite email/i);

    await clickPrimaryAction('I copied this');
    await screen.findByText(/open beehiiv team settings/i);
    await clickPrimaryAction('I opened settings');
    await screen.findByText(/invite your agency in beehiiv/i);
    await clickPrimaryAction('I sent the invite');
    await screen.findByRole('heading', { name: /confirm and continue/i });

    const returnButtons = screen.getAllByRole('button', { name: 'Return to request' });
    expect(returnButtons[0]).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /i invited ops@demoagency.com/i }));
    await clickPrimaryAction('Return to request');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/client/token-123/beehiiv/manual-connect'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(pushMock).toHaveBeenCalledWith('/invite/token-123?step=2&platform=beehiiv&connectionId=conn-beehiiv-1');
    });
  });

  it('Beehiiv back button returns to the invite connect step instead of browser history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => buildPayload(),
      }))
    );

    render(<BeehiivManualPage />);

    await screen.findByText(/copy invite email/i);
    const [headerBackButton] = screen.getAllByRole('button', { name: 'Back' });
    await userEvent.click(headerBackButton);

    expect(pushMock).toHaveBeenCalledWith('/invite/token-123?view=connect&platform=beehiiv');
    expect(backMock).not.toHaveBeenCalled();
  });

  it('Kit flow submits manual connect and redirects', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/kit/manual-connect')) {
        return {
          ok: true,
          json: async () => ({ data: { connectionId: 'conn-kit-1' }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => buildPayload(),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<KitManualPage />);

    await screen.findByText(/copy invite email/i);

    await clickPrimaryAction('I copied this');
    await screen.findByText(/open kit team settings/i);
    await clickPrimaryAction('I opened team settings');
    await screen.findByText(/invite your agency in kit/i);
    await clickPrimaryAction('I sent the invite');
    await screen.findByRole('heading', { name: /confirm and continue/i });
    await userEvent.click(screen.getByRole('checkbox', { name: /i invited ops@demoagency.com/i }));
    await clickPrimaryAction('Return to request');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/client/token-123/kit/manual-connect'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(pushMock).toHaveBeenCalledWith('/invite/token-123?step=2&platform=kit&connectionId=conn-kit-1');
    });
  });

  it('Mailchimp flow submits manual connect and redirects', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/mailchimp/manual-connect')) {
        return {
          ok: true,
          json: async () => ({ data: { connectionId: 'conn-mailchimp-1' }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => buildPayload({
          platforms: [
            {
              platformGroup: 'mailchimp',
              products: [{ product: 'mailchimp', accessLevel: 'admin' }],
            },
          ],
        }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MailchimpManualPage />);

    await screen.findByText(/copy invite email/i);
    expect(screen.getByRole('heading', { name: /complete mailchimp access/i })).toBeInTheDocument();
    expect(screen.getByText(/Demo Agency/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual invite/i)).toBeInTheDocument();

    await clickPrimaryAction('I copied this');
    await screen.findByText(/open mailchimp team settings/i);
    await clickPrimaryAction('I opened settings');
    await screen.findByText(/invite your agency in mailchimp/i);
    await clickPrimaryAction('I sent the invite');
    await screen.findByRole('heading', { name: /confirm and continue/i });
    await userEvent.click(screen.getByRole('checkbox', { name: /i invited ops@demoagency.com/i }));
    await clickPrimaryAction('Return to request');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/client/token-123/mailchimp/manual-connect'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(pushMock).toHaveBeenCalledWith('/invite/token-123?step=2&platform=mailchimp&connectionId=conn-mailchimp-1');
    });
  });

  it('Klaviyo flow submits manual connect and redirects', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/klaviyo/manual-connect')) {
        return {
          ok: true,
          json: async () => ({ data: { connectionId: 'conn-klaviyo-1' }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => buildPayload({
          platforms: [
            {
              platformGroup: 'klaviyo',
              products: [{ product: 'klaviyo', accessLevel: 'admin' }],
            },
          ],
        }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<KlaviyoManualPage />);

    await screen.findByText(/copy invite email/i);

    await clickPrimaryAction('I copied this');
    await screen.findByText(/open klaviyo team settings/i);
    await clickPrimaryAction('I opened settings');
    await screen.findByText(/invite your agency in klaviyo/i);
    await clickPrimaryAction('I sent the invite');
    await screen.findByRole('heading', { name: /confirm and continue/i });
    await userEvent.click(screen.getByRole('checkbox', { name: /i invited ops@demoagency.com/i }));
    await clickPrimaryAction('Return to request');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/client/token-123/klaviyo/manual-connect'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(pushMock).toHaveBeenCalledWith('/invite/token-123?step=2&platform=klaviyo&connectionId=conn-klaviyo-1');
    });
  });

  it('Pinterest flow blocks progression when business ID is missing', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => buildPayload({ manualInviteTargets: { pinterest: {} } }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<PinterestManualPage />);

    await screen.findByText(/open pinterest business manager/i);
    await clickPrimaryAction('I opened Pinterest');
    await screen.findByText(/add your agency as partner/i);

    const blockedAction = screen.getAllByRole('button', { name: 'Business ID required' })[0];
    expect(blockedAction).toBeDisabled();
    expect(screen.getAllByText(/business id is required before this step can continue/i).length).toBeGreaterThan(0);
  });

  it('Shopify flow submits collaborator details and redirects', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/shopify/manual-connect')) {
        return {
          ok: true,
          json: async () => ({ data: { connectionId: 'conn-shopify-1' }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => buildPayload(),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<ShopifyManualPage />);

    await screen.findByRole('heading', { name: /connect shopify/i });
    expect(screen.getAllByText(/step 1 of 3/i).length).toBeGreaterThan(0);

    await clickPrimaryAction('Connect Shopify');
    await screen.findByRole('heading', { name: /select store/i });
    expect(screen.getAllByText(/step 2 of 3/i).length).toBeGreaterThan(0);
    await clickPrimaryAction('Select Store');
    await screen.findByRole('heading', { name: /connected/i });
    expect(screen.getAllByText(/step 3 of 3/i).length).toBeGreaterThan(0);

    const returnButtons = screen.getAllByRole('button', { name: 'Return to request' });
    expect(returnButtons[0]).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /i have shared my shop domain and collaborator code/i }));
    await clickPrimaryAction('Return to request');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/client/token-123/shopify/manual-connect'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(pushMock).toHaveBeenCalledWith('/invite/token-123?step=2&platform=shopify&connectionId=conn-shopify-1');
    });
  });
});
