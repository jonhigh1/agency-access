import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlatformAuthWizard } from '../PlatformAuthWizard';
import { manualGrantChecklistStorageKey } from '@/lib/invite/manual-grant-checklist-storage';
import type { MetaFulfillmentResult } from '@agency-platform/shared';

let fulfillmentRowSeq = 0;

/** A verified ad-account fulfillment row by default; overrides shape the case. */
function fulfillmentRow(overrides: Partial<MetaFulfillmentResult> = {}): MetaFulfillmentResult {
  fulfillmentRowSeq += 1;
  return {
    id: `row-${fulfillmentRowSeq}`,
    assetKind: 'ad_account',
    assetId: `asset-${fulfillmentRowSeq}`,
    assetName: `Asset ${fulfillmentRowSeq}`,
    recipientType: 'business',
    recipientId: `biz-${fulfillmentRowSeq}`,
    recipientName: `Recipient ${fulfillmentRowSeq}`,
    requestedTasks: ['ADVERTISE'],
    verifiedTasks: [],
    status: 'verified',
    updatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

const { pushMock, replaceMock, onCompleteMock, trackOnboardingEventMock, trackInviteCtaBlockedMock, trackInviteSelectionSavedMock, trackClientGrantChecklistViewedMock, trackClientFinishClickedWithPendingMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  onCompleteMock: vi.fn(),
  trackOnboardingEventMock: vi.fn(),
  trackInviteCtaBlockedMock: vi.fn(),
  trackInviteSelectionSavedMock: vi.fn(),
  trackClientGrantChecklistViewedMock: vi.fn(),
  trackClientFinishClickedWithPendingMock: vi.fn(),
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
  MetaAssetSelector: ({ onSelectionChange, onSelectionDerivedStateReset, initialSelection, allowedAssetTypes, onError }: any) => (
    <div>
      <div>Meta Asset Selector</div>
      <div>{`Allowed Meta asset types: ${allowedAssetTypes.join(',')}`}</div>
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
            assetsLoaded: true,
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
            assetsLoaded: true,
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
            pages: ['page_1', 'page_2'],
            instagramAccounts: [],
            allPages: [
              { id: 'page_1', name: 'Shop Page' },
              { id: 'page_2', name: 'Second Page' },
            ],
            selectedPagesWithNames: [
              { id: 'page_1', name: 'Shop Page' },
              { id: 'page_2', name: 'Second Page' },
            ],
            selectedBusinessId: 'biz_1',
            selectedBusinessName: 'Client One',
            assetsLoaded: true,
          })
        }
      >
        Select Meta Pages Only
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
            assetsLoaded: true,
          })
        }
      >
        Select Meta Instagram Assets
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            adAccounts: initialSelection?.adAccounts ?? [],
            pages: initialSelection?.pages ?? [],
            instagramAccounts: initialSelection?.instagramAccounts ?? [],
            catalogs: initialSelection?.catalogs ?? [],
            datasets: initialSelection?.datasets ?? [],
            allAdAccounts: (initialSelection?.adAccounts ?? []).map((id: string) => ({ id, name: id })),
            allPages: (initialSelection?.pages ?? []).map((id: string) => ({ id, name: id })),
            allInstagramAccounts: (initialSelection?.instagramAccounts ?? []).map((id: string) => ({ id, username: id })),
            assetsLoaded: true,
          })
        }
      >
        Emit Resumed Meta Selection
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
            assetsLoaded: true,
          })
        }
      >
        Emit Empty Meta Selection With Available Assets
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
            declinedAssetKinds: ['ad_account', 'page', 'instagram_account', 'dataset'],
            allAdAccounts: [{ id: 'act_9', name: 'Available Account' }],
            allPages: [{ id: 'page_9', name: 'Available Page' }],
            allInstagramAccounts: [{ id: 'ig_9', username: 'available' }],
            allDatasets: [{ id: 'ds_9', name: 'Available Dataset' }],
            assetsLoaded: true,
          })
        }
      >
        Decline All Meta Assets
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
            // Lists are present but the real selector only sets assetsLoaded
            // after a successful fetch; its absence means still-loading.
            allAdAccounts: [{ id: 'act_9', name: 'Available Account' }],
            selectionRequired: false,
          })
        }
      >
        Emit Unloaded Meta Selection Blob
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
            assetsLoaded: true,
          });
        }}
      >
        Switch Meta Business
      </button>
      <button type="button" onClick={() => onSelectionDerivedStateReset?.()}>
        Reset Meta Selection Only
      </button>
      <button type="button" onClick={() => onError?.('Could not load Meta accounts')}>
        Emit Meta Selector Error
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
    <>
      <button type="button" onClick={() => onGrantComplete([{ id: 'page_1', status: 'granted' }])}>
        Automatic Pages Grant
      </button>
      <button
        type="button"
        onClick={() => onGrantComplete([
          { id: 'page_1', status: 'granted' },
          { id: 'page_2', status: 'failed', error: 'No verified grant result returned' },
        ])}
      >
        Return partial Page results
      </button>
    </>
  ),
}));

vi.mock('@/components/client-auth/AdAccountSharingInstructions', () => ({
  AdAccountSharingInstructions: ({ autoStart, initialStatus, onComplete, selectedAdAccounts }: any) => (
    <div>
      <div>
        {`Ad Account Sharing Instructions autostart:${String(autoStart ?? true)} initialStatus:${initialStatus ?? 'none'}`}
      </div>
      <div>{`Resume panel assets: ${selectedAdAccounts.map((account: any) => account.id).join(',')}`}</div>
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

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteCtaBlocked: trackInviteCtaBlockedMock,
  trackInviteSelectionSaved: trackInviteSelectionSavedMock,
  trackClientGrantChecklistViewed: trackClientGrantChecklistViewedMock,
  trackClientFinishClickedWithPending: trackClientFinishClickedWithPendingMock,
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
      expect(screen.getByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/some google products still need follow-up/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /see which accounts you shared/i }));
    expect(screen.getByText('Business Profile')).toBeInTheDocument();
    expect(screen.getByText(/No locations found yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up needed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
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

  it('shows a system-user disclaimer on ad-account requests that does not claim human owner access', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { businessId: 'biz_1' }, error: null }),
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
        metaAccessConfig={{
          recipients: [{ type: 'system_user', id: 'sys-1', name: 'Automation Bot' }],
          pageTasks: [],
          adAccountTasks: ['ADVERTISE'],
          catalogTasks: ['MANAGE'],
        }}
      />
    );

    expect(await screen.findByRole('note')).toHaveTextContent(
      /system-user assignment is separate from partner share/i
    );
    expect(screen.getByRole('note')).toHaveTextContent(/human ads manager access/i);
  });

  it('keeps the chooser open and unsaved when fresh Meta assets prune resume selections', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { businessId: 'biz_1' }, error: null }),
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
        initialMetaSelections={{
          adAccounts: ['act_stale'],
          pages: [],
          instagramAccounts: [],
          catalogs: [],
          datasets: [],
        }}
      />
    );

    const chooser = screen.getByRole('button', { name: /choose accounts to share/i });
    expect(chooser).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /emit empty meta selection with available assets/i }));

    expect(await screen.findByText('Select at least one ad account to continue')).toBeInTheDocument();
    expect(chooser).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /share access/i })).toBeDisabled();
  });

  it('does not collapse the chooser when resume selections arrive after mount', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { businessId: 'biz_1' }, error: null }),
    } as Response);

    const { rerender } = render(
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

    rerender(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        initialMetaSelections={{
          adAccounts: ['act_1'],
          pages: [],
          instagramAccounts: [],
          catalogs: [],
          datasets: [],
        }}
      />
    );

    expect(await screen.findByText('Resume prefill: act_1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose accounts to share/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reopens the chooser when Meta asset loading fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { businessId: 'biz_1' }, error: null }),
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

    const chooser = screen.getByRole('button', { name: /choose accounts to share/i });
    fireEvent.click(chooser);
    expect(chooser).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /emit meta selector error/i, hidden: true }));

    expect(await screen.findByText("We couldn't load your accounts. Try again.")).toBeInTheDocument();
    expect(chooser).toHaveAttribute('aria-expanded', 'true');
  });

  it('shares Meta selection across ads, pages, and Instagram products', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[
          { product: 'meta_ads', accessLevel: 'admin' },
          { product: 'meta_pages', accessLevel: 'admin' },
          { product: 'instagram', accessLevel: 'admin' },
        ]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    expect(screen.getByText('Allowed Meta asset types: ad_account,page,instagram,dataset')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /select meta pages and instagram assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/save-assets'))
      ).toHaveLength(3);
    });

    const saveBodies = vi.mocked(fetch).mock.calls
      .filter(([url]) => String(url).includes('/save-assets'))
      .map(([, options]) => JSON.parse(String(options?.body)));
    expect(saveBodies).toEqual([
      expect.objectContaining({ platform: 'meta_ads', selectedAssets: expect.objectContaining({ pages: ['page_1'], instagramAccounts: ['ig_1'] }) }),
      expect.objectContaining({ platform: 'meta_pages', selectedAssets: expect.objectContaining({ pages: ['page_1'], instagramAccounts: ['ig_1'] }) }),
      expect.objectContaining({ platform: 'instagram', selectedAssets: expect.objectContaining({ pages: ['page_1'], instagramAccounts: ['ig_1'] }) }),
    ]);
  });

  it('saves a grouped Meta selection when Instagram has no selected accounts', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[
          { product: 'meta_ads', accessLevel: 'admin' },
          { product: 'meta_pages', accessLevel: 'admin' },
          { product: 'instagram', accessLevel: 'admin' },
        ]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });

    // Ads alone are enough. Empty pages/IG secondary products must not be POSTed.
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    // Wait for the post-save step so every sequential save has finished
    // before asserting which platforms were posted.
    await screen.findByText('Meta signed in');

    const saveBodies = vi.mocked(fetch).mock.calls
      .filter(([url]) => String(url).includes('/save-assets'))
      .map(([, options]) => JSON.parse(String(options?.body)));
    expect(saveBodies).toEqual([
      expect.objectContaining({
        platform: 'meta_ads',
        selectedAssets: expect.objectContaining({
          adAccounts: expect.arrayContaining(['act_1']),
          pages: [],
          instagramAccounts: [],
        }),
      }),
    ]);
  });

  it('still saves Instagram when Instagram accounts are selected', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[
          { product: 'meta_ads', accessLevel: 'admin' },
          { product: 'instagram', accessLevel: 'admin' },
        ]}
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

    await screen.findByText('Meta signed in');

    const saveBodies = vi.mocked(fetch).mock.calls
      .filter(([url]) => String(url).includes('/save-assets'))
      .map(([, options]) => JSON.parse(String(options?.body)));
    expect(saveBodies).toEqual([
      expect.objectContaining({
        platform: 'meta_ads',
        selectedAssets: expect.objectContaining({ pages: ['page_1'], instagramAccounts: ['ig_1'] }),
      }),
      expect.objectContaining({
        platform: 'instagram',
        selectedAssets: expect.objectContaining({ instagramAccounts: ['ig_1'] }),
      }),
    ]);
  });

  it('shows one Meta selection area for a grouped request and says what happens after sharing', async () => {
    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[
          { product: 'meta_ads', accessLevel: 'admin' },
          { product: 'meta_pages', accessLevel: 'admin' },
          { product: 'instagram', accessLevel: 'admin' },
        ]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    expect(screen.getAllByRole('button', { name: /select meta assets/i })).toHaveLength(1);
    expect(screen.queryByText(/Account selection is shared with/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/anything left to do .* next step/i)
    ).toBeInTheDocument();
  });

  it('selects and saves Instagram-only Meta assets', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'instagram', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    expect(screen.getByText('Allowed Meta asset types: instagram')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /select meta instagram assets/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    await waitFor(() => {
      const saveCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/save-assets'));
      expect(saveCall).toBeDefined();
      expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          platform: 'instagram',
          selectedAssets: expect.objectContaining({ instagramAccounts: ['ig_1'] }),
        })
      );
    });
  });

  it('clears the Instagram alias when Meta selection state resets', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'instagram', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta instagram assets/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /share access/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /reset meta selection only/i }));

    expect(screen.getByRole('button', { name: /share access/i })).toBeDisabled();
    expect(screen.getByText('Preparing your accounts')).toBeInTheDocument();
  });

  it('keeps the ad-account checklist item in an action state when manual verification is partial', async () => {
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

    // Save advances straight to the checklist step (confirm is decoupled
    // from completion), and the ad-account panel mounts with automation on.
    expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    expect(
      await screen.findByText(/Ad Account Sharing Instructions autostart:true/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /report partial meta share/i }));

    // A partial report flips the item state on the checklist step — it does
    // not navigate, and the Finish action stays enabled with its count.
    expect(screen.getByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    expect(screen.getByText('Needs you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish/i })).toBeEnabled();
  });

  it('keeps the Pages checklist item in an action state when any Page grant fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true }, error: null }),
    } as Response);

    render(
      <PlatformAuthWizard
        platform="meta"
        platformName="Meta"
        products={[{ product: 'meta_pages', accessLevel: 'admin' }]}
        accessRequestToken="token-1"
        onComplete={onCompleteMock}
        initialConnectionId="conn-1"
        initialStep={2}
        completionActionLabel="Finish request"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select meta pages only/i }));
    const shareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /return partial page results/i }));

    // The partial grant keeps the Pages item on an action state inside the
    // step-3 checklist — it does not navigate back to step 2.
    expect(screen.getByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    expect(screen.getByText('Needs you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^automatic pages grant$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /review access confirmation/i })
    ).not.toBeInTheDocument();
  });

  it('keeps the Instagram checklist item pending for direct verification on the checklist step', async () => {
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

    // The checklist step hosts the Instagram verification panel; the wizard
    // never parks the client on step 2 to wait for grants.
    expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /verify agency instagram access/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Needs you')).toBeInTheDocument();
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
        initialMetaSelections={{
          adAccounts: ['act_1', 'act_2'],
          pages: [],
          instagramAccounts: [],
          catalogs: [],
          datasets: [],
        }}
        completionActionLabel="Finish request"
      />
    );

    // Resumed saved state: the resumed selection lands saved and the advance
    // action takes over from the save action.
    fireEvent.click(await screen.findByRole('button', { name: /emit resumed meta selection/i }));
    expect(await screen.findByRole('button', { name: /^continue$/i })).toBeEnabled();

    // Post-save the client can still go back: a change-selection affordance
    // confirms with the selection count before clearing saved state.
    fireEvent.click(screen.getByRole('button', { name: /change selection/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: /clear selection and edit/i }));

    // Stale grant state clears and the wizard is not bricked.
    await waitFor(() => {
      expect(screen.queryByText(/Ad Account Sharing Instructions/)).not.toBeInTheDocument();
    });

    // The save CTA returns once the client selects assets again.
    fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
    const secondShareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(secondShareButton).toBeEnabled());

    // The full pipeline completes: a second save reaches the server and the
    // wizard lands on the checklist step.
    fireEvent.click(secondShareButton);
    expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    expect(
      await screen.findByText(/Ad Account Sharing Instructions autostart:true/)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2); // agency-business-id + the second save
    });
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.example.com/api/client/token-1/save-assets',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('clears saved and manual-grant checklist state when the selector resets after a switch', async () => {
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
        initialMetaSelections={{
          adAccounts: ['act_111'],
          pages: [],
          instagramAccounts: [],
          catalogs: [],
          datasets: [],
        }}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /emit resumed meta selection/i }));
    expect(await screen.findByRole('button', { name: /^continue$/i })).toBeEnabled();

    // The manual-grant checklist storage is selection-derived: the reset
    // (change-selection, then business switch) must clear it too.
    sessionStorage.setItem(manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-1'), '1');
    fireEvent.click(screen.getByRole('button', { name: /change selection/i }));
    fireEvent.click(await screen.findByRole('button', { name: /clear selection and edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch meta business/i }));

    expect(
      sessionStorage.getItem(manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-1'))
    ).toBeNull();

    // The save CTA returns after reselecting: the wizard was not bricked.
    fireEvent.click(screen.getByRole('button', { name: /select meta pages and instagram assets/i }));
    const reselectedShareButton = await screen.findByRole('button', { name: /share access/i });
    await waitFor(() => expect(reselectedShareButton).toBeEnabled());
    fireEvent.click(reselectedShareButton);

    // The save lands on the checklist step, which hosts the Instagram panel.
    expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /verify agency instagram access/i })
    ).toBeInTheDocument();
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

    it('stays in the neutral loading state until the selector reports assetsLoaded (#3)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      });

      // A blob that carries asset lists but no assetsLoaded flag mirrors the
      // selector's mount emission: lists are defined-empty until the fetch
      // resolves, so the CTA must remain a neutral loading state — never a
      // selection demand, and never enabled.
      fireEvent.click(screen.getByRole('button', { name: /emit unloaded meta selection blob/i }));

      expect(screen.getByText('Preparing your accounts')).toBeInTheDocument();
      expect(screen.queryByText(/select at least one/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share access/i })).toBeDisabled();

      // The post-fetch emission flips the gate and the resolver moves on.
      fireEvent.click(
        screen.getByRole('button', { name: /emit empty meta selection with available assets/i })
      );
      expect(await screen.findByText('Select at least one ad account to continue')).toBeInTheDocument();
    });

    it('deadline the save request with a retryable error instead of spinning forever (#2)', async () => {
      const hangOnSave = (url: string | URL, init?: RequestInit) => {
        if (String(url).includes('/save-assets')) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          });
        }
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ data: { businessId: 'biz_x' }, error: null }),
        } as Response);
      };
      vi.mocked(fetch).mockImplementation(hangOnSave as typeof fetch);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      const shareButton = screen.getByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());

      vi.useFakeTimers();
      try {
        fireEvent.click(shareButton);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(45_000);
        });
        expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('applies a popup-resume prefill that arrives after mount (#10)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      const { rerender } = render(
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

      // Popup OAuth resumes on the same mounted instance: the page updates
      // initialMetaSelections via router.replace, so the prefill must land
      // through props, not the useState initializer.
      rerender(
        <PlatformAuthWizard
          platform="meta"
          platformName="Meta"
          products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
          accessRequestToken="token-1"
          onComplete={onCompleteMock}
          initialConnectionId="conn-1"
          initialStep={2}
          initialMetaSelections={{
            adAccounts: ['act_r1', 'act_r2'],
            pages: [],
            instagramAccounts: [],
            catalogs: [],
            datasets: [],
          }}
        />
      );

      expect(await screen.findByText('Resume prefill: act_r1, act_r2')).toBeInTheDocument();
    });

    it('does not re-assert saved state when a business switch lands mid-save (#22)', async () => {
      let resolveSave: (response: Response) => void = () => {};
      vi.mocked(fetch).mockImplementation(((url: string | URL) => {
        if (String(url).includes('/save-assets')) {
          return new Promise<Response>((resolve) => {
            resolveSave = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ data: { businessId: 'biz_x' }, error: null }),
        } as Response);
      }) as typeof fetch);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      const shareButton = screen.getByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());
      fireEvent.click(shareButton);

      // The client switches business while the save is still in flight: the
      // reset clears the selection blob and the selector reports biz_2. While
      // the save is pending the resolver legitimately shows the saving state;
      // the race is what happens when the stale success lands.
      fireEvent.click(screen.getByRole('button', { name: /switch meta business/i }));
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/save-assets'))).toBe(true);

      resolveSave({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      // The stale success must not outrank the fresh reset: the new business
      // still demands its own selection, so the create-required reason stays.
      await waitFor(() => {
        expect(screen.getByText('Create an ad account in Client One to continue')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /share access/i })).toBeDisabled();
    });

    it('fires invite_cta_blocked once per reason kind — not per render (U11)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      });

      // Blocked while loading.
      await waitFor(() => {
        expect(trackInviteCtaBlockedMock).toHaveBeenCalledTimes(1);
      });
      expect(trackInviteCtaBlockedMock).toHaveBeenNthCalledWith(1, {
        platform: 'meta',
        reason_kind: 'loading',
      });

      // Blocked with the selection demand once assets are loaded.
      fireEvent.click(
        screen.getByRole('button', { name: /emit empty meta selection with available assets/i })
      );
      await screen.findByText('Select at least one ad account to continue');
      await waitFor(() => {
        expect(trackInviteCtaBlockedMock).toHaveBeenCalledTimes(2);
      });
      expect(trackInviteCtaBlockedMock).toHaveBeenNthCalledWith(2, {
        platform: 'meta',
        reason_kind: 'select_required',
      });

      // The action becomes enabled — no further blocked events.
      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share access/i })).toBeEnabled();
      });
      expect(trackInviteCtaBlockedMock).toHaveBeenCalledTimes(2);
      expect(trackInviteCtaBlockedMock.mock.calls.every(([properties]) =>
        ['loading', 'select_required'].includes(properties.reason_kind)
      )).toBe(true);
    });

    it('fires invite_selection_saved once per successful save (U11)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      const shareButton = await screen.findByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(trackInviteSelectionSavedMock).toHaveBeenCalledTimes(1);
      });
      expect(trackInviteSelectionSavedMock).toHaveBeenCalledWith({
        platform: 'meta',
        total_selected: 2,
        product_count: 1,
      });
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

    it('saves an explicit all-Meta decline with the schema-level decline field', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({ platform: 'meta', platformName: 'Meta', products: [{ product: 'meta_ads', accessLevel: 'admin' }] });

      fireEvent.click(screen.getByRole('button', { name: /decline all meta assets/i }));
      const shareButton = await screen.findByRole('button', { name: /share access/i });
      await waitFor(() => expect(shareButton).toBeEnabled());
      fireEvent.click(shareButton);

      await waitFor(() => {
        const saveCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/save-assets'));
        expect(saveCall).toBeDefined();
        expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual(
          expect.objectContaining({
            platform: 'meta_ads',
            declinedAssetKinds: ['ad_account', 'page', 'instagram_account', 'dataset'],
          })
        );
      });
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

      it('advances to the checklist step immediately after save', async () => {
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

      // Confirm is decoupled from completion: the save itself advances to
      // the checklist step, whatever grants are still pending. The pages and
      // Instagram panels host the pending work on this selection.
      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(
        await screen.findByRole('button', { name: /^automatic pages grant$/i })
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('button', { name: /verify agency instagram access/i })
      ).toBeInTheDocument();

      // No disabled advance anywhere: the checklist owns pending grants.
      expect(screen.queryByRole('button', { name: /share access/i })).not.toBeInTheDocument();
      expect(
        screen.queryByText(/access grants are still in progress/i)
      ).not.toBeInTheDocument();
      screen.getAllByRole('button').forEach((button) => {
        const label = button.textContent ?? '';
        if (/continue|finish/i.test(label)) expect(button).toBeEnabled();
      });
    });

    it('renders Done checklist states from server fulfillment rows without refiring the share start', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
        metaFulfillment: [
          fulfillmentRow({ assetId: 'act_1', status: 'verified' }),
          fulfillmentRow({ assetId: 'act_2', status: 'verified' }),
        ],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(await screen.findByText('Done')).toBeInTheDocument();

      // Server rows already describe both ad accounts: no automation refire,
      // and every remaining count is zeroed so the label is plain.
      expect(
        vi.mocked(fetch).mock.calls.filter(([url]) =>
          String(url).includes('/meta/manual-ad-account-share/start')
        )
      ).toHaveLength(0);
      expect(screen.getByRole('button', { name: /^finish( request)?$/i })).toBeInTheDocument();
    });

    it('renders checklist items from fulfillment rows when resuming straight to step 3', async () => {
      // Phase 3 resume: the client lands at step 3 without the selector ever
      // mounting, so the selection blob is empty. The server rows alone must
      // populate the checklist.
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
        initialStep: 3,
        metaFulfillment: [
          fulfillmentRow({ assetId: 'act_1', status: 'verified' }),
          fulfillmentRow({ assetKind: 'page', assetId: 'page_1', status: 'selected' }),
        ],
      });

      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(await screen.findByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Needs you')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /finish — 1 item left/i })
      ).toBeInTheDocument();
    });

    it('fires client_grant_checklist_viewed once with the remaining count on step-3 mount', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { success: true }, error: null }),
      } as Response);

      const { rerender } = render(
        <PlatformAuthWizard
          platform="meta"
          platformName="Meta"
          products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
          accessRequestToken="token-1"
          onComplete={onCompleteMock}
          initialConnectionId="conn-1"
          initialStep={3}
          completionActionLabel="Finish request"
          metaFulfillment={[
            fulfillmentRow({ assetId: 'act_1', status: 'verified' }),
            fulfillmentRow({ assetKind: 'page', assetId: 'page_1', status: 'selected' }),
          ]}
        />
      );

      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(trackClientGrantChecklistViewedMock).toHaveBeenCalledTimes(1);
      expect(trackClientGrantChecklistViewedMock).toHaveBeenCalledWith({ remaining_count: 1 });

      // Re-renders never re-fire the viewed event.
      rerender(
        <PlatformAuthWizard
          platform="meta"
          platformName="Meta"
          products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
          accessRequestToken="token-1"
          onComplete={onCompleteMock}
          initialConnectionId="conn-1"
          initialStep={3}
          completionActionLabel="Finish request"
          metaFulfillment={[
            fulfillmentRow({ assetId: 'act_1', status: 'verified' }),
            fulfillmentRow({ assetKind: 'page', assetId: 'page_1', status: 'selected' }),
          ]}
        />
      );
      expect(trackClientGrantChecklistViewedMock).toHaveBeenCalledTimes(1);
    });

    it('mounts the ad-account panel in verify mode when server rows show sharing already attempted', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
        metaFulfillment: [fulfillmentRow({ assetId: 'act_1', status: 'sharing_attempted' })],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(
        await screen.findByText(/autostart:false initialStatus:idle/)
      ).toBeInTheDocument();
      expect(
        vi.mocked(fetch).mock.calls.filter(([url]) =>
          String(url).includes('/meta/manual-ad-account-share/start')
        )
      ).toHaveLength(0);

      // 2 selected ad accounts, 0 verified rows: the count stays truthful.
      expect(
        screen.getByRole('button', { name: /finish — 2 items left/i })
      ).toBeInTheDocument();
    });

    it('does not claim access was granted while the checklist still has items left', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
        metaFulfillment: [fulfillmentRow({ assetId: 'act_1', status: 'sharing_attempted' })],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish — 2 items left/i })).toBeInTheDocument();
      expect(screen.getByText(/finish sharing below/i)).toBeInTheDocument();
      expect(
        screen.queryByText('Access granted to the accounts you selected.')
      ).not.toBeInTheDocument();
    });

    it('labels the finish action with the remaining checklist count', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta instagram assets/i }));
      fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /finish — 1 item left/i })
      ).toBeInTheDocument();
    });

    it('fires client_finish_clicked_with_pending when finishing with items left', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta instagram assets/i }));
      fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

      const finishButton = await screen.findByRole('button', {
        name: /finish — 1 item left/i,
      });
      fireEvent.click(finishButton);

      expect(trackClientFinishClickedWithPendingMock).toHaveBeenCalledTimes(1);
      expect(trackClientFinishClickedWithPendingMock).toHaveBeenCalledWith({ remaining_count: 1 });
      expect(onCompleteMock).toHaveBeenCalledTimes(1);
    });

    it('does not fire client_finish_clicked_with_pending when nothing is pending', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: { businessId: 'partner-bm-1', businessName: 'Agency Access' },
              error: null,
            }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          text: async () => JSON.stringify({ data: { success: true }, error: null }),
        } as Response);

      renderShareScreen({
        platform: 'meta',
        platformName: 'Meta',
        products: [{ product: 'meta_ads', accessLevel: 'admin' }],
        completionActionLabel: 'Finish request',
        metaFulfillment: [
          fulfillmentRow({ assetId: 'act_1', status: 'verified' }),
          fulfillmentRow({ assetId: 'act_2', status: 'verified' }),
        ],
      });

      fireEvent.click(screen.getByRole('button', { name: /select meta assets/i }));
      fireEvent.click(await screen.findByRole('button', { name: /share access/i }));

      fireEvent.click(await screen.findByRole('button', { name: /^finish( request)?$/i }));

      expect(trackClientFinishClickedWithPendingMock).not.toHaveBeenCalled();
      expect(onCompleteMock).toHaveBeenCalledTimes(1);
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
      expect(await screen.findByRole('heading', { name: /meta signed in|connected/i })).toBeInTheDocument();
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

      // The selector reports the fresh fetch with the client's saved
      // selections (the real selector pre-checks the pruned prefill).
      fireEvent.click(await screen.findByRole('button', { name: /emit resumed meta selection/i }));

      // Saved state without a save click: the action becomes the advance
      // action and stays enabled — confirm is decoupled from completion;
      // pending grants live in the step-3 checklist, not the CTA.
      const advanceButton = await screen.findByRole('button', { name: /continue/i });
      await waitFor(() => expect(advanceButton).toBeEnabled());

      // The wizard must not hit save-assets again on resume.
      expect(fetch).not.toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/save-assets',
        expect.anything()
      );
    });

    it('hydrates the step-three grant panel with the saved client business and assets', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { businessId: 'agency-business-1' }, error: null }),
      } as Response);

      render(
        <PlatformAuthWizard
          {...resumeProps}
          initialStep={3}
          initialMetaBusinessId="client-business-1"
          initialMetaSelections={{
            adAccounts: ['act_111'], pages: [], instagramAccounts: [], catalogs: [], datasets: [],
          }}
          metaFulfillment={[fulfillmentRow({ assetId: 'act_111', status: 'selected' })]}
        />
      );

      expect(await screen.findByText('Resume panel assets: act_111')).toBeInTheDocument();
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
