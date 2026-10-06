import ReactDOM from 'react-dom/client';
import {
  mapMetaGraphError,
  mapMetaOAuthIncompletePermissions,
  type MetaConnectionErrorPresentation,
} from '@agency-platform/shared';
import { PlatformAuthWizard } from '@/components/client-auth/PlatformAuthWizard';
import '@/app/globals.css';

type PreviewScenario =
  | 'portfolio-selection'
  | 'grant-in-progress'
  | 'verified-success'
  | 'partial-follow-up'
  | 'error-incomplete-permissions'
  | 'error-not-admin'
  | 'error-2fa-required'
  | 'error-page-ownership'
  | 'error-bm-mismatch';

const SCENARIOS: PreviewScenario[] = [
  'portfolio-selection',
  'grant-in-progress',
  'verified-success',
  'partial-follow-up',
  'error-incomplete-permissions',
  'error-not-admin',
  'error-2fa-required',
  'error-page-ownership',
  'error-bm-mismatch',
];

const AGENCY_BUSINESS = {
  businessId: '3808519629379919',
  businessName: 'Outdoor DIY',
};

const CLIENT_BUSINESSES = [
  { id: 'biz_client_1', name: 'DogTimez Holdings' },
  { id: 'biz_client_2', name: 'DogTimez Retail' },
];

function parseScenario(rawScenario: string | null): PreviewScenario {
  if (rawScenario && SCENARIOS.includes(rawScenario as PreviewScenario)) {
    return rawScenario as PreviewScenario;
  }

  return 'portfolio-selection';
}

function buildJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function isMetaConnectionErrorScenario(
  scenario: PreviewScenario,
): scenario is Extract<PreviewScenario, `error-${string}`> {
  return scenario.startsWith('error-');
}

function presentationForErrorScenario(scenario: PreviewScenario): MetaConnectionErrorPresentation {
  switch (scenario) {
    case 'error-incomplete-permissions':
      return mapMetaOAuthIncompletePermissions(['ads_management', 'business_management']);
    case 'error-not-admin':
      return mapMetaGraphError({
        message: '(#200) Permissions error: User must be an admin of the ad account',
        code: 200,
      })!;
    case 'error-2fa-required':
      return mapMetaGraphError({
        message: 'Two-factor authentication is required to access this ad account',
        code: 190,
        error_subcode: 1340092,
      })!;
    case 'error-page-ownership':
      return mapMetaGraphError({
        message: 'This Page is owned by another business and cannot be accessed',
        code: 100,
      })!;
    case 'error-bm-mismatch':
      return mapMetaGraphError({
        message: 'The Instagram account must belong to the same Business Manager as the ad account',
        code: 100,
      })!;
    default:
      return mapMetaOAuthIncompletePermissions(['ads_management']);
  }
}

function buildMetaAssetFetchError(scenario: PreviewScenario): Response {
  const presentation = presentationForErrorScenario(scenario);
  return buildJsonResponse(
    {
      data: null,
      error: {
        code: presentation.code,
        message: presentation.message,
        details: {
          title: presentation.title,
          nextSteps: [...presentation.nextSteps],
          supportCode: presentation.code,
        },
      },
    },
    presentation.httpStatus,
  );
}

function getMetaAssetsForScenario(scenario: PreviewScenario, businessId: string | null) {
  if (!businessId) {
    return {
      businesses: CLIENT_BUSINESSES,
      selectedBusinessId: null,
      selectedBusinessName: null,
      selectionRequired: true,
      adAccounts: [],
      pages: [],
      instagramAccounts: [],
    };
  }

  if (scenario === 'partial-follow-up') {
    return {
      businesses: CLIENT_BUSINESSES,
      selectedBusinessId: businessId,
      selectedBusinessName:
        CLIENT_BUSINESSES.find((business) => business.id === businessId)?.name || 'DogTimez Retail',
      selectionRequired: false,
      adAccounts: [
        {
          id: 'act_813104320370861',
          name: 'DogTimez Ads',
          status: 'ACTIVE',
        },
      ],
      pages: [
        {
          id: 'page_1001',
          name: 'DogTimez Facebook',
          category: 'Brand',
        },
      ],
      instagramAccounts: [
        {
          id: 'ig_1001',
          username: 'dogtimez.ig',
          name: 'DogTimez IG',
        },
      ],
    };
  }

  return {
    businesses: CLIENT_BUSINESSES,
    selectedBusinessId: businessId,
    selectedBusinessName:
      CLIENT_BUSINESSES.find((business) => business.id === businessId)?.name || 'DogTimez Retail',
    selectionRequired: false,
    adAccounts: [],
    pages: [
      {
        id: 'page_1001',
        name: 'DogTimez Facebook',
        category: 'Brand',
      },
    ],
    instagramAccounts: [],
  };
}

function installFetchMock(scenario: PreviewScenario): void {
  globalThis.fetch = async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const url = new URL(requestUrl, window.location.origin);
    const pathname = url.pathname;

    if (pathname.endsWith('/agency-business-id')) {
      return buildJsonResponse({
        data: AGENCY_BUSINESS,
        error: null,
      });
    }

    if (pathname.endsWith('/assets/meta_ads')) {
      if (isMetaConnectionErrorScenario(scenario)) {
        return buildMetaAssetFetchError(scenario);
      }

      return buildJsonResponse({
        data: getMetaAssetsForScenario(scenario, url.searchParams.get('businessId')),
        error: null,
      });
    }

    if (pathname.endsWith('/save-assets')) {
      return buildJsonResponse({
        data: { success: true },
        error: null,
      });
    }

    if (pathname.endsWith('/grant-meta-access')) {
      const body =
        init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const pageGrantResponse = {
        data: {
          assetGrantResults: [
            {
              assetId: 'page_1001',
              assetType: 'page',
              status: 'verified',
            },
          ],
        },
        error: null,
      };

      if (scenario === 'grant-in-progress' && Array.isArray(body?.assetTypes)) {
        return new Promise((resolve) => {
          window.setTimeout(() => resolve(buildJsonResponse(pageGrantResponse)), 10000);
        });
      }

      return buildJsonResponse(pageGrantResponse);
    }

    if (pathname.endsWith('/meta/manual-ad-account-share/start')) {
      return buildJsonResponse({
        data: {
          success: true,
          status: 'waiting_for_manual_share',
          partnerBusinessId: AGENCY_BUSINESS.businessId,
          partnerBusinessName: AGENCY_BUSINESS.businessName,
          verificationResults: [
            {
              assetId: 'act_813104320370861',
              assetName: 'DogTimez Ads',
              status: 'waiting_for_manual_share',
              errorMessage: 'Still pending verification',
            },
          ],
        },
        error: null,
      });
    }

    if (pathname.endsWith('/meta/manual-ad-account-share/verify')) {
      return buildJsonResponse({
        data: {
          success: false,
          partial: true,
          status: 'partial',
          partnerBusinessId: AGENCY_BUSINESS.businessId,
          partnerBusinessName: AGENCY_BUSINESS.businessName,
          verificationResults: [
            {
              assetId: 'act_813104320370861',
              assetName: 'DogTimez Ads',
              status: 'unresolved',
              errorMessage: 'Ad account has not been shared to the agency business portfolio yet',
            },
          ],
        },
        error: null,
      });
    }

    return buildJsonResponse({ data: {}, error: null });
  };
}

function PreviewChrome({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Meta Invite Evidence Harness
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>

        {children}
      </div>
    </div>
  );
}

function getScenarioCopy(scenario: PreviewScenario) {
  switch (scenario) {
    case 'grant-in-progress':
      return {
        title: 'Meta Grant In Progress',
        description:
          'Step 2 after the client selects a business and page, with automatic Facebook Page access actively being granted.',
      };
    case 'verified-success':
      return {
        title: 'Meta Verified Success',
        description:
          'Final confirmation state after the client selects a business and the Facebook Page grant verifies successfully.',
      };
    case 'partial-follow-up':
      return {
        title: 'Meta Partial Follow-Up',
        description:
          'Final confirmation state after page verification succeeds but Meta ad-account sharing and Instagram support still need follow-up.',
      };
    case 'error-incomplete-permissions':
      return {
        title: 'Meta connection error — incomplete permissions',
        description: 'Fixture API returns META_CONNECTION_INCOMPLETE_PERMISSIONS on asset discovery.',
      };
    case 'error-not-admin':
      return {
        title: 'Meta connection error — not admin',
        description: 'Fixture API returns META_CONNECTION_NOT_ADMIN on asset discovery.',
      };
    case 'error-2fa-required':
      return {
        title: 'Meta connection error — 2FA required',
        description: 'Fixture API returns META_CONNECTION_2FA_REQUIRED on asset discovery.',
      };
    case 'error-page-ownership':
      return {
        title: 'Meta connection error — Page ownership',
        description: 'Fixture API returns META_CONNECTION_PAGE_OWNERSHIP on asset discovery.',
      };
    case 'error-bm-mismatch':
      return {
        title: 'Meta connection error — BM mismatch',
        description: 'Fixture API returns META_CONNECTION_BM_MISMATCH on asset discovery.',
      };
    case 'portfolio-selection':
    default:
      return {
        title: 'Meta Business Portfolio Selection',
        description:
          'Step 2 state requiring the client to choose the Business Portfolio before assets can be loaded.',
      };
  }
}

function MetaInvitePreview() {
  const scenario = parseScenario(new URLSearchParams(window.location.search).get('scenario'));
  const copy = getScenarioCopy(scenario);

  return (
    <PreviewChrome title={copy.title} description={copy.description}>
      <div className="mx-auto max-w-5xl">
        <PlatformAuthWizard
          platform="meta"
          platformName="Meta"
          products={[{ product: 'meta_ads', accessLevel: 'admin' }]}
          accessRequestToken="preview-token"
          initialConnectionId="preview-meta-connection"
          initialStep={2}
          completionActionLabel="Finish preview"
          onComplete={() => undefined}
        />
      </div>
    </PreviewChrome>
  );
}

const scenario = parseScenario(new URLSearchParams(window.location.search).get('scenario'));

(globalThis as any).process = (globalThis as any).process || { env: {} };
(globalThis as any).process.env = {
  ...((globalThis as any).process.env || {}),
  NODE_ENV: 'development',
  NEXT_PUBLIC_API_URL: window.location.origin,
};

installFetchMock(scenario);

ReactDOM.createRoot(document.getElementById('root')!).render(<MetaInvitePreview />);
