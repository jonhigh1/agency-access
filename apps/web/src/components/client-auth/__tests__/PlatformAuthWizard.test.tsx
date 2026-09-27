import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlatformAuthWizard } from '../PlatformAuthWizard';

const { pushMock, replaceMock, onCompleteMock, trackOnboardingEventMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  onCompleteMock: vi.fn(),
  trackOnboardingEventMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/client-auth/PlatformWizardCard', () => ({
  PlatformWizardCard: ({ children, footer }: any) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}));

vi.mock('@/components/client-auth/MetaAssetSelector', () => ({
  MetaAssetSelector: ({ onSelectionChange, onSelectionDerivedStateReset, initialSelection }: any) => (
    <div>
      <div>Meta Asset Selector</div>
      {initialSelection?.adAccounts?.length ? (
        <p>{`Resume prefill: ${initialSelection.adAccounts.join(', ')}`}</p>
      ) : null}
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            adAccounts: ['act_1', 'act_2'],
            pages: [],
            instagramAccounts: [],
            // Real selector emits carry the fetched asset lists post-fetch;
            // the wizard treats their absence as still-loading (U7).
            allAdAccounts: [
              { id: 'act_1', name: 'DogTimez' },
              { id: 'act_2', name: 'Still Pending' },
            ],
            selectedAdAccountsWithNames: [
              { id: 'act_1', name: 'DogTimez' },
              { id: 'act_2', name: 'Still Pending' },
            ],
            selectedBusinessId: 'biz_1',
            selectedBusinessName: 'Client One',
          })
        }
      >
        Select Meta Assets
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            adAccounts: [],
            pages: ['page_1'],
            instagramAccounts: ['ig_1'],
            allPages: [{ id: 'page_1', name: 'Shop Page' }],
            selectedPagesWithNames: [{ id: 'page_1', name: 'Shop Page' }],
            selectedInstagramWithNames: [{ id: 'ig_1', name: 'Shop IG' }],
            selectedBusinessId: 'biz_1',
            selectedBusinessName: 'Client One',
          })
        }
      >
        Select Meta Pages And Instagram Assets
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            adAccounts: [],
            pages: [],
            instagramAccounts: ['ig_1'],
            allPages: [],
            selectedInstagramWithNames: [{ id: 'ig_1', name: 'Shop IG' }],
            selectedBusinessId: 'biz_1',
            selectedBusinessName: 'Client One',
          })
        }
      >
        Select Meta Instagram Assets
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            adAccounts: [],
            pages: [],
            instagramAccounts: [],
            catalogs: [],
            datasets: [],
            allAdAccounts: [{ id: 'act_9', name: 'Available Account' }],
            selectionRequired: false,
          })
        }
      >
        Emit Empty Meta Selection With Available Assets
      </button>
      <button
        type="button"
        onClick={() => {
          // Mirror the real selector: it wipes selection-derived state locally,
          // then re-emits an empty selection blob for the new business.
          onSelectionDerivedStateReset?.();
          onSelectionChange({
            adAccounts: [],
            pages: [],
            instagramAccounts: [],
            catalogs: [],
            datasets: [],
            allAdAccounts: [],
            selectionRequired: true,
            selectedBusinessId: 'biz_2',
            selectedBusinessName: 'Client One',
          });
        }}
      >
        Switch Meta Business
      </button>
    </div>
  ),
}));

vi.mock('@/components/client-auth/GoogleAssetSelector', () => ({
  GoogleAssetSelector: ({ product, onSelectionChange }: any) => (
    <div>
      <div>{`Google Asset Selector: ${product}`}</div>
      <button
        type="button"
        onClick={() => {
          if (product === 'google_business_profile') {
            onSelectionChange({
              businessAccounts: [],
              availableAssetCount: 0,
            });
            return;
          }

          if (product === 'ga4') {
            onSelectionChange({
              properties: ['properties/456'],
              availableAssetCount: 1,
            });
            return;
          }

          onSelectionChange({
            adAccounts: ['customers/123'],
            availableAssetCount: 1,
          });
        }}
      >
        {`Report assets for ${product}`}
      </button>
    </div>
  ),
}));

vi.mock('@/components/client-auth/LinkedInAssetSelector', () => ({
  LinkedInAssetSelector: ({ product, onSelectionChange }: any) => (
    <div>
      <div>{`LinkedIn Asset Selector: ${product}`}</div>
      <button
        type="button"
        onClick={() => {
          if (product === 'linkedin_pages') {
            onSelectionChange({
              pages: [],
              availableAssetCount: 0,
            });
            return;
          }

          onSelectionChange({
            adAccounts: ['urn:li:sponsoredAccount:123'],
            availableAssetCount: 1,
          });
        }}
      >
        {`Report assets for ${product}`}
      </button>
    </div>
  ),
}));

vi.mock('@/components/client-auth/TikTokAssetSelector', () => ({
  TikTokAssetSelector: ({ onSelectionChange }: any) => (
    <div>
      <div>TikTok Asset Selector</div>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            selectedAdvertiserIds: ['adv_1'],
            selectedBusinessCenterId: 'bc_1',
          })
        }
      >
        Select TikTok Assets
      </button>
    </div>
  ),
}));

vi.mock('@/components/client-auth/AutomaticPagesGrant', () => ({
  AutomaticPagesGrant: ({ onGrantComplete }: any) => (
    <button type="button" onClick={() => onGrantComplete([{ id: 'page_1', status: 'granted' }])}>
      Automatic Pages Grant
    </button>
  ),
}));

vi.mock('@/components/client-auth/AdAccountSharingInstructions', () => ({
  AdAccountSharingInstructions: ({ onComplete }: any) => (
    <div>
      <div>Ad Account Sharing Instructions</div>
      <button
        type="button"
        onClick={() =>
          onComplete({
            status: 'partial',
            verificationResults: [
              {
                assetId: 'act_1',
                assetName: 'DogTimez',
                status: 'verified',
                verifiedAt: '2026-03-11T12:02:00.000Z',
              },
              {
                assetId: 'act_2',
                assetName: 'Still Pending',
                status: 'unresolved',
                errorMessage:
                  'Ad account has not been shared to the agency business portfolio yet',
              },
            ],
          })
        }
      >
        Report Partial Meta Share
      </button>
    </div>
  ),
}));

vi.mock('@/components/client-auth/StepHelpText', () => ({
  StepHelpText: ({ title, description }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('@/components/client-auth/AssetSelectorDisabled', () => ({
  AssetSelectorDisabled: () => <div>Asset Selector Disabled</div>,
}));

vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick, type = 'button', isLoading, rightIcon, ...props }: any) => (
    <button type={type} onClick={onClick} data-loading={isLoading ? 'true' : 'false'} {...props}>
      {children}
      {rightIcon ? <span>{rightIcon}</span> : null}
    </button>
  ),
  PlatformIcon: ({ platform }: any) => <div>{platform}</div>,
}));

vi.mock('@/lib/analytics/onboarding', () => ({
  trackOnboardingEvent: trackOnboardingEventMock,
}));

describe('PlatformAuthWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.stubGlobal('location', { href: '', origin: 'https://app.example.com' });
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
    process.env.NEXT_PUBLIC_META_APP_ID = 'meta-app-123';
  });

  it('renders the connect step by default for OAuth platforms', () => {
    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    expect(screen.getByRole('heading', { name: /connect meta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect meta/i })).toBeInTheDocument();
    expect(screen.getByText(/you'll be redirected to meta to sign in and authorize access/i)).toBeInTheDocument();
  });

  it('calls the oauth-url endpoint on the configured API host when connect is clicked (Google redirect flow)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: { authUrl: 'https://example.com/oauth' },
          error: null,
        }),
      json: async () => ({
        data: { authUrl: 'https://example.com/oauth' },
        error: null,
      }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="google"
        platformName="Google"
        products={[{ product: 'google_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /connect google/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/oauth-url',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ platform: 'google' }),
        })
      );
    });
  });

  it('opens Meta OAuth in a popup and resumes after the popup confirms connection', async () => {
    const popup = { closed: false, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { authUrl: 'https://www.facebook.com/dialog/oauth' }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard platform="meta" platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1" onComplete={onCompleteMock} />
    );
    fireEvent.click(screen.getByRole('button', { name: /open meta in a pop-up/i }));
    await waitFor(() => expect(popup.location.href).toBe('https://www.facebook.com/dialog/oauth'));
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/client/token-1/oauth-url',
      expect.objectContaining({ body: JSON.stringify({ platform: 'meta', presentation: 'popup' }) })
    );
    const message = new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'authhub:oauth-result', success: true, connectionId: 'conn-123', platform: 'meta' },
    });
    Object.defineProperty(message, 'source', { value: popup });
    window.dispatchEvent(message);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/invite/token-1?connectionId=conn-123&platform=meta&step=2'));
  });

  it('redirects to Meta OAuth when Connect Meta is selected', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { authUrl: 'https://www.facebook.com/dialog/oauth' }, error: null }),
    } as Response);
    render(
      <PlatformAuthWizard platform="meta" platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1" onComplete={onCompleteMock} />
    );
    fireEvent.click(screen.getByRole('button', { name: /connect meta/i }));
    await waitFor(() => expect(global.location.href).toBe('https://www.facebook.com/dialog/oauth'));
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/client/token-1/oauth-url',
      expect.objectContaining({ body: JSON.stringify({ platform: 'meta' }) })
    );
  });

  it('shows a friendly error when the authorization service returns non-JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<!doctype html><html><body>Not JSON</body></html>',
    } as Response);

    render(
      <PlatformAuthWizard
        platform="google"
        platformName="Google"
        products={[{ product: 'google_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /connect google/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/authorization service returned an unexpected response/i)
      ).toBeInTheDocument();
    });
  });

  it('redirects Pinterest requests into the manual invite flow', async () => {
    render(
      <PlatformAuthWizard
        platform="pinterest"
        platformName="Pinterest"
        products={[{ product: 'pinterest', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/invite/token-1/pinterest/manual');
    });
  });

  it('redirects Mailchimp requests into the manual invite flow', async () => {
    render(
      <PlatformAuthWizard
        platform="mailchimp"
        platformName="Mailchimp"
        products={[{ product: 'mailchimp', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/invite/token-1/mailchimp/manual');
    });
  });

  it('lets users review the connect step for manual platforms before resuming setup', async () => {
    render(
      <PlatformAuthWizard
        platform="beehiiv"
        platformName="Beehiiv"
        products={[{ product: 'beehiiv', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        deferManualRedirect
      />
    );

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /resume beehiiv setup/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue in beehiiv/i }));

    expect(pushMock).toHaveBeenCalledWith('/invite/token-1/beehiiv/manual');
  });

  it('requires LinkedIn ad account selection before continuing to confirmation', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: { success: true },
          error: null,
        }),
      json: async () => ({
        data: { success: true },
        error: null,
      }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="linkedin"
        platformName="LinkedIn"
        products={[{ product: 'linkedin_ads', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    expect(screen.getByText('LinkedIn Asset Selector: linkedin_ads')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review access confirmation/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /report assets for linkedin_ads/i }));
    expect(screen.getByRole('button', { name: /share access/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /share access/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/save-assets',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /connected/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish request/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(screen.getByText('LinkedIn Ads')).toBeInTheDocument();
  });

  it('lets LinkedIn Pages continue with follow-up when no administered pages are found', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: { success: true },
          error: null,
        }),
      json: async () => ({
        data: { success: true },
        error: null,
      }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="linkedin"
        platformName="LinkedIn"
        products={[{ product: 'linkedin_pages', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    expect(screen.getByText('LinkedIn Asset Selector: linkedin_pages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /report assets for linkedin_pages/i }));

    expect(
      await screen.findByRole('button', { name: /share access/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /share access/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /connected/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(screen.getByText('LinkedIn Pages')).toBeInTheDocument();
    expect(screen.getByText(/No pages found yet/i)).toBeInTheDocument();
  });

  it('shows both LinkedIn Ads and LinkedIn Pages in mixed LinkedIn requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: { success: true },
          error: null,
        }),
      json: async () => ({
        data: { success: true },
        error: null,
      }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="linkedin"
        platformName="LinkedIn"
        products={[
          { product: 'linkedin_ads', accessLevel: 'admin' },
          { product: 'linkedin_pages', accessLevel: 'admin' },
        ]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    expect(screen.getByText('LinkedIn Asset Selector: linkedin_ads')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Asset Selector: linkedin_pages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /report assets for linkedin_ads/i }));
    fireEvent.click(screen.getByRole('button', { name: /report assets for linkedin_pages/i }));
    fireEvent.click(screen.getByRole('button', { name: /share access/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /connected/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(screen.getByText('LinkedIn Ads')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Pages')).toBeInTheDocument();
  });

  it('lets Google continue when a requested product has zero assets and shows follow-up summary copy', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: null,
          error: null,
        }),
      json: async () => ({
        data: null,
        error: null,
      }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="google"
        platformName="Google"
        products={[{ product: 'google_business_profile', accessLevel: 'standard' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /report assets for google_business_profile/i }));

    expect(
      await screen.findByRole('button', { name: /share access/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /share access/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /connected/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/some google products still need follow-up/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(screen.getByText('Business Profile')).toBeInTheDocument();
    expect(screen.getByText(/No locations found yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up needed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish request/i })).toBeInTheDocument();
  });

  it('saves grouped Google products sequentially to preserve connection asset updates', async () => {
    let resolveFirstSave!: (response: Response) => void;
    const firstSave = new Promise<Response>((resolve) => {
      resolveFirstSave = resolve;
    });
    const successfulResponse = {
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response;

    vi.mocked(fetch)
      .mockReturnValueOnce(firstSave)
      .mockResolvedValueOnce(successfulResponse);

    render(
      <PlatformAuthWizard
        platform="google"
        platformName="Google"
        products={[
          { product: 'google_ads', accessLevel: 'admin' },
          { product: 'ga4', accessLevel: 'admin' },
        ]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /report assets for google_ads/i }));
    fireEvent.click(screen.getByRole('button', { name: /report assets for ga4/i }));
    fireEvent.click(screen.getByRole('button', { name: /share access/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(
      expect.objectContaining({ platform: 'google_ads' })
    );

    resolveFirstSave(successfulResponse);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual(
      expect.objectContaining({ platform: 'ga4' })
    );
  });

  it('advances Meta into the confirmation step when manual ad-account verification is partial', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businessId: 'partner-bm-1',
              businessName: 'Agency Access',
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { success: true },
            error: null,
          }),
      } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/save-assets',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: /report partial meta share/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /connected/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/some meta accounts still need follow-up/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(
      screen.getByText(/still pending still needs manual meta sharing/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish request/i })).toBeInTheDocument();
  });

  it('keeps Instagram access pending for direct Meta verification', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businessId: 'partner-bm-1',
              businessName: 'Agency Access',
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { success: true },
            error: null,
          }),
      } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta instagram assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    expect(await screen.findByText(/share direct instagram access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify agency instagram access/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /connected/i })).not.toBeInTheDocument();
  });

  it('keeps the current Meta selection flow for the same invite', () => {
    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
        accessRequestToken="same-invite-token"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    expect(screen.getByText('Meta Asset Selector')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /choose accounts to share/i })).toBeInTheDocument();
    expect(screen.getByText('Meta Asset Selector')).toBeInTheDocument();
  });

  it('returns the save CTA after a post-save change-selection and completes a second save', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businessId: 'partner-bm-1',
              businessName: 'Agency Access',
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/save-assets',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Post-save: the grant section renders and the save CTA is gone.
    expect(await screen.findByText('Ad Account Sharing Instructions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share access/i })).not.toBeInTheDocument();

    // Post-save the client can still go back: a change-selection affordance
    // confirms with the selection count before clearing saved state.
    fireEvent.click(screen.getByRole('button', { name: /change selection/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: /clear selection and edit/i }));

    // Stale grant state clears and the wizard is not bricked.
    await waitFor(() => {
      expect(screen.queryByText('Ad Account Sharing Instructions')).not.toBeInTheDocument();
    });

    // The save CTA returns once the client selects assets again.
    fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
    const secondShareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(secondShareButton).toBeEnabled());

    // The full pipeline completes: a second save reaches the server.
    fireEvent.click(secondShareButton);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3); // agency-business-id + 2 saves
    });
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.example.com/api/client/token-1/save-assets',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('clears saved and Instagram verification state when the selector resets after a switch', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businessId: 'partner-bm-1',
              businessName: 'Agency Access',
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              assetGrantResults: [
                {
                  assetId: 'ig_1',
                  assetType: 'instagram_account',
                  recipientType: 'business',
                  recipientId: 'partner-bm-1',
                  status: 'verified',
                },
              ],
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta pages and instagram assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    // Verify Instagram while Pages are still pending: the wizard stays on step 2.
    fireEvent.click(await screen.findByRole('button', { name: /verify agency instagram access/i }));
    expect(
      await screen.findByText(/Meta confirmed agency Business Portfolio access/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /connected/i })).not.toBeInTheDocument();

    // Switch business from the re-opened selection section.
    fireEvent.click(screen.getByRole('button', { name: /choose accounts to share/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch meta business/i }));

    // The save CTA returns after reselecting: the wizard was not bricked.
    fireEvent.click(screen.getByRole('button', { name: /select meta pages and instagram assets/i }));
    const reselectedShareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(reselectedShareButton).toBeEnabled());
    fireEvent.click(reselectedShareButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4); // agency-business-id + IG verify + 2 saves
    });

    // Instagram verification was cleared by the reset: completing Pages alone
    // must not advance past the Instagram grant step.
    fireEvent.click(screen.getByRole('button', { name: /automatic pages grant/i }));
    expect(screen.queryByRole('heading', { name: /connected/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify agency instagram access/i })).toBeInTheDocument();
  });

  describe('always-rendered primary action footer', () => {
    const renderShareScreen = (props: Partial<Parameters<typeof PlatformAuthWizard>[0]> = {}) =>
      render(
        <PlatformAuthWizard
          platform="linkedin"
          platformName="LinkedIn"
          products={[{ product: 'linkedin_ads', accessLevel: 'admin' }]}
          accessRequestToken="token-1"
          onComplete={onCompleteMock}
          initialConnectionId="conn-1"
          initialStep={2}
          {...props}
        />
      );

    it('renders the footer disabled with a neutral reason while assets load', () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen();

      const shareButton = screen.getByRole('button', { name: /share access/i });
      expect(shareButton).toBeDisabled();
      expect(screen.getByText('Preparing your accounts')).toBeInTheDocument();
      expect(screen.queryByText(/select at least one/i)).not.toBeInTheDocument();
    });

    it('renders the footer with the selection reason once assets are loaded and nothing is selected', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({ platform: 'meta', platformName: 'Meta', products: [{ product: 'meta_ads', accessLevel: 'admin' }] });

      fireEvent.click(screen.getByRole('button', { name: /emit empty meta selection with available assets/i }));

      expect(
        await screen.findByText('Select at least one ad account to continue')
      ).toBeInTheDocument();
      const shareButton = screen.getByRole('button', { name: /share access/i });
      expect(shareButton).toBeDisabled();

      // A disabled primary action must not reach the save endpoint.
      fireEvent.click(shareButton);
      expect(fetch).not.toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/save-assets',
        expect.anything()
      );
    });

    it('names the create action when the selected business has no ad accounts', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({ platform: 'meta', platformName: 'Meta', products: [{ product: 'meta_ads', accessLevel: 'admin' }] });

      fireEvent.click(screen.getByRole('button', { name: /switch meta business/i }));

      expect(
        await screen.findByText('Create an ad account in Client One to continue')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share access/i })).toBeDisabled();
    });

    it('enables the footer once every requested product has a selection', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen();

      fireEvent.click(screen.getByRole('button', { name: /report assets for linkedin_ads/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share access/i })).toBeEnabled();
      });
      expect(screen.queryByText(/select at least one/i)).not.toBeInTheDocument();
    });

    it('ignores further clicks while the save request is in flight', async () => {
      let resolveFirstSave!: (response: Response) => void;
      const firstSave = new Promise<Response>((resolve) => {
        resolveFirstSave = resolve;
      });
      const successfulResponse = {
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response;
      vi.mocked(fetch).mockReturnValueOnce(firstSave).mockResolvedValue(successfulResponse);

      renderShareScreen();

      fireEvent.click(screen.getByRole('button', { name: /report assets for linkedin_ads/i }));
      const shareButton = await screen.findByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/client/token-1/save-assets',
          expect.objectContaining({ method: 'POST' })
        );
      });
      expect(screen.getByText('Saving your selection')).toBeInTheDocument();
      expect(shareButton).toBeDisabled();

      fireEvent.click(shareButton);

      expect(fetch).toHaveBeenCalledTimes(1);
      resolveFirstSave(successfulResponse);
    });

    it('switches the footer to a disabled advance action with a grant-progress reason after save', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta pages and instagram assets/i }));
      const shareButton = await screen.findByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());
      fireEvent.click(shareButton);

      const continueButton = await screen.findByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
      expect(
        screen.getByText('Access grants are still in progress. Complete the grant steps above.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /share access/i })).not.toBeInTheDocument();
      // The in-card duplicate advance button is gone; the footer is the primary action.
      expect(
        screen.queryByRole('button', { name: /review access confirmation/i })
      ).not.toBeInTheDocument();
    });

    it('enables the advance action after a saved flow with no pending grants', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: {
                success: false,
                partialFailure: true,
                results: [{ advertiserId: 'adv_1', status: 'failed', error: 'Manual action required' }],
                manualFallback: { required: true },
              },
              error: null,
            }),
        } as Response);

      renderShareScreen({
        platform: 'tiktok',
        platformName: 'TikTok',
        products: [{ product: 'tiktok_ads', accessLevel: 'admin' }],
      });

      fireEvent.click(screen.getByRole('button', { name: /select tiktok assets/i }));
      const shareButton = await screen.findByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());
      fireEvent.click(shareButton);

      const continueButton = await screen.findByRole('button', { name: /^continue$/i });
      await waitFor(() => expect(continueButton).toBeEnabled());
      expect(screen.queryByText(/still in progress/i)).not.toBeInTheDocument();

      fireEvent.click(continueButton);
      expect(await screen.findByRole('heading', { name: /connected/i })).toBeInTheDocument();
    });
  });

  describe('U7 resume prefill and terminal saves', () => {
    const resumeProps = {
      platform: 'meta' as const,
      platformName: 'Meta',
      products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      accessRequestToken: 'token-1',
      onComplete: onCompleteMock,
      initialConnectionId: 'conn-meta-1',
      initialStep: 2 as const,
    };

    it('lands a resumed Meta share step saved with selections prefilled from the payload rows', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      render(
        <PlatformAuthWizard
          {...resumeProps}
          initialMetaSelections={{
            adAccounts: ['act_111'],
            pages: [],
            instagramAccounts: [],
            catalogs: [],
            datasets: [],
          }}
        />
      );

      // The prefill reaches the selector so the fresh fetch can pre-check it.
      expect(screen.getByText('Resume prefill: act_111')).toBeInTheDocument();

      // Before the fresh asset fetch reports, the action is neutral-loading,
      // never an enableable advance (KTD2).
      expect(screen.getByText('Preparing your accounts')).toBeInTheDocument();

      // The chooser accordion starts collapsed on a resumed share step.
      fireEvent.click(screen.getByRole('button', { name: /choose accounts to share/i }));

      // The selector reports the fresh fetch with the client's saved
      // selections (the real selector pre-checks the pruned prefill).
      fireEvent.click(await screen.findByRole('button', { name: /select meta assets/i }));

      // Saved state without a save click: the action becomes the advance
      // action, gated on the pending grant steps (AE5).
      const advanceButton = await screen.findByRole('button', { name: /continue/i });
      await waitFor(() => expect(advanceButton).toBeDisabled());
      expect(
        screen.getByText('Access grants are still in progress. Complete the grant steps above.')
      ).toBeInTheDocument();

      // The wizard must not hit save-assets again on resume.
      expect(fetch).not.toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/save-assets',
        expect.anything()
      );
    });

    it('reopens the chooser and never resurrects the prefill after a selection reset', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      render(
        <PlatformAuthWizard
          {...resumeProps}
          initialMetaSelections={{
            adAccounts: ['act_111'],
            pages: [],
            instagramAccounts: [],
            catalogs: [],
            datasets: [],
          }}
        />
      );

      // The resumed share step starts with the chooser accordion collapsed;
      // opening it is how the client reaches the business switch.
      fireEvent.click(screen.getByRole('button', { name: /choose accounts to share/i }));
      fireEvent.click(await screen.findByRole('button', { name: /switch meta business/i }));

      // Post-reset the resolver is back on the selection rules — the resumed
      // save state and the prefill are gone. The mock business has zero
      // available accounts, so the creation reason shows.
      expect(
        await screen.findByText('Create an ad account in Client One to continue')
      ).toBeInTheDocument();
      expect(screen.queryByText('Resume prefill: act_111')).not.toBeInTheDocument();
    });

    it('reports a terminal request code from a failed save instead of a generic error', async () => {
      const onRequestUnavailable = vi.fn();
      vi.mocked(fetch).mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : String(input?.url ?? input);
        if (url.includes('/agency-business-id')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({ data: { businessId: 'biz_1', businessName: 'Client One' }, error: null }),
          } as Response;
        }
        return {
          ok: false,
          text: async () =>
            JSON.stringify({
              data: null,
              error: { code: 'REQUEST_EXPIRED', message: 'Access request has expired' },
            }),
        } as Response;
      });

      render(
        <PlatformAuthWizard
          {...resumeProps}
          initialMetaSelections={null}
          onRequestUnavailable={onRequestUnavailable}
        />
      );

      // No prefill: the chooser accordion starts expanded.
      fireEvent.click(await screen.findByRole('button', { name: /select meta assets/i }));
      const saveButton = await screen.findByRole('button', { name: /share access/i });
      await waitFor(() => expect(saveButton).toBeEnabled());
      fireEvent.click(saveButton);

      await waitFor(() => expect(onRequestUnavailable).toHaveBeenCalledWith('REQUEST_EXPIRED'));
      expect(screen.queryByText(/failed to save/i)).not.toBeInTheDocument();
    });
  });
});
