import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlatformAuthWizard } from '../PlatformAuthWizard';

const { pushMock, onCompleteMock, trackOnboardingEventMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  onCompleteMock: vi.fn(),
  trackOnboardingEventMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/client-auth/PlatformWizardCard', () => ({
  PlatformWizardCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/client-auth/MetaAssetSelector', () => ({
  MetaAssetSelector: ({ onSelectionChange }: any) => (
    <div>
      <div>Meta Asset Selector</div>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            adAccounts: ['act_1', 'act_2'],
            pages: [],
            instagramAccounts: [],
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
            pages: [],
            instagramAccounts: ['ig_1'],
            selectedInstagramWithNames: [{ id: 'ig_1', name: 'Shop IG' }],
            selectedBusinessId: 'biz_1',
            selectedBusinessName: 'Client One',
          })
        }
      >
        Select Meta Instagram Assets
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
  TikTokAssetSelector: () => <div>TikTok Asset Selector</div>,
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

const launchMetaClientPopupLoginMock = vi.fn();
vi.mock('@/lib/meta-business-login', () => ({
  launchMetaClientPopupLogin: (...args: any[]) => launchMetaClientPopupLoginMock(...args),
}));

describe('PlatformAuthWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.stubGlobal('location', { href: '' });
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

  it('uses popup flow for Meta: oauth-state, popup login, meta/finalize, then advances to step 2', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { state: 'stateless.meta.state.sig' },
            error: null,
          }),
        json: async () => ({
          data: { state: 'stateless.meta.state.sig' },
          error: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { connectionId: 'conn-123', platform: 'meta', token: 'token-1' },
            error: null,
          }),
        json: async () => ({
          data: { connectionId: 'conn-123', platform: 'meta', token: 'token-1' },
          error: null,
        }),
      } as Response);

    launchMetaClientPopupLoginMock.mockResolvedValue({
      accessToken: 'fb-access-token',
      userId: 'fb-user-123',
      expiresIn: 3600,
    });

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /connect meta/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/oauth-state',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ platform: 'meta' }),
        })
      );
    });

    await waitFor(() => {
      expect(launchMetaClientPopupLoginMock).toHaveBeenCalledWith('meta-app-123');
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/meta/finalize',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            state: 'stateless.meta.state.sig',
            accessToken: 'fb-access-token',
            userId: 'fb-user-123',
            expiresIn: 3600,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/choose accounts to share/i)).toBeInTheDocument();
    });
  });

  it('falls back to redirect flow when Meta popup fails (e.g. Firefox tracking protection)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { state: 'stateless.meta.state.sig' },
            error: null,
          }),
        json: async () => ({
          data: { state: 'stateless.meta.state.sig' },
          error: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { authUrl: 'https://www.facebook.com/v25.0/dialog/oauth?client_id=123' },
            error: null,
          }),
        json: async () => ({
          data: { authUrl: 'https://www.facebook.com/v25.0/dialog/oauth?client_id=123' },
          error: null,
        }),
      } as Response);

    launchMetaClientPopupLoginMock.mockRejectedValue(
      new Error('Failed to load Meta Business Login. Please try again.')
    );

    const location = global.location as { href: string };
    location.href = '';

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'standard' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /connect meta/i }));

    await waitFor(() => {
      expect(launchMetaClientPopupLoginMock).toHaveBeenCalledWith('meta-app-123');
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/oauth-url',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ platform: 'meta' }),
        })
      );
    });

    await waitFor(() => {
      expect(location.href).toBe('https://www.facebook.com/v25.0/dialog/oauth?client_id=123');
    });
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
    fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

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

  it('shows Instagram selections as unresolved Meta follow-up work in confirmation', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /connected/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/some meta accounts still need follow-up/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(
      screen.getByText(/shop ig requires manual follow-up because instagram automation is not supported yet/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish request/i })).toBeInTheDocument();
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
});
