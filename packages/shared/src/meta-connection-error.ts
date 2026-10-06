import { META_CORE_PERMISSIONS } from './types.js';

export const META_CONNECTION_ERROR_CODES = [
  'META_CONNECTION_INCOMPLETE_PERMISSIONS',
  'META_CONNECTION_NOT_ADMIN',
  'META_CONNECTION_2FA_REQUIRED',
  'META_CONNECTION_PAGE_OWNERSHIP',
  'META_CONNECTION_BM_MISMATCH',
  'META_CONNECTION_UNKNOWN',
] as const;

export type MetaConnectionErrorCode = (typeof META_CONNECTION_ERROR_CODES)[number];

export interface MetaGraphErrorPayload {
  message?: string;
  code?: number;
  error_subcode?: number;
  type?: string;
}

export interface MetaConnectionErrorPresentation {
  code: MetaConnectionErrorCode;
  title: string;
  message: string;
  nextSteps: readonly string[];
  httpStatus: number;
}

const PERMISSION_LABELS: Record<string, string> = {
  ads_management: 'Ads management',
  business_management: 'Business management',
  pages_read_engagement: 'Page engagement read',
  pages_show_list: 'Page list',
};

function permissionLabel(scope: string): string {
  return PERMISSION_LABELS[scope] ?? scope.replace(/_/g, ' ');
}

export function mapMetaOAuthIncompletePermissions(
  missingScopes: readonly string[],
): MetaConnectionErrorPresentation {
  const labels = missingScopes.map(permissionLabel);
  const missingList =
    labels.length > 0 ? labels.join(', ') : 'one or more required Meta permissions';

  return {
    code: 'META_CONNECTION_INCOMPLETE_PERMISSIONS',
    title: 'Meta permissions incomplete',
    message: `AuthHub is missing required Meta permissions (${missingList}). Partial consent cannot load or share the requested assets.`,
    nextSteps: [
      'Disconnect Meta in this invite, then connect again.',
      'On the Meta consent screen, enable every permission AuthHub requests — do not uncheck optional items.',
      'Return here and retry account discovery.',
    ],
    httpStatus: 403,
  };
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function mapFromGraphSignals(input: MetaGraphErrorPayload): MetaConnectionErrorPresentation | null {
  const message = input.message ?? '';
  const normalized = normalizeMessage(message);
  const metaCode = input.code;
  const metaSubcode = input.error_subcode;

  const mentionsTwoFactor =
    normalized.includes('two-factor') ||
    normalized.includes('two factor') ||
    normalized.includes('2-factor') ||
    normalized.includes('two step') ||
    metaSubcode === 1340092;

  if (mentionsTwoFactor) {
    return {
      code: 'META_CONNECTION_2FA_REQUIRED',
      title: 'Meta two-factor authentication required',
      message:
        'Meta requires two-factor authentication on this account before ad accounts or Business assets can be shared.',
      nextSteps: [
        'Sign in to Meta and turn on two-factor authentication for your personal Facebook login.',
        'Complete Meta’s security check, then return to this invite and try again.',
        'If an ad account admin manages security, ask them to enable 2FA or forward this invite link to them.',
      ],
      httpStatus: 403,
    };
  }

  const pageOwnedByOtherBusiness =
    normalized.includes('owned by another business') ||
    normalized.includes('page is owned by') ||
    normalized.includes('page is managed by another business') ||
    (normalized.includes('page') &&
      normalized.includes('business') &&
      (normalized.includes('owned') || normalized.includes('claim')));

  if (pageOwnedByOtherBusiness) {
    return {
      code: 'META_CONNECTION_PAGE_OWNERSHIP',
      title: 'Page owned by another Business',
      message:
        'Meta reports this Page is owned by a different Business Portfolio. AuthHub cannot grant access until ownership matches the portfolio you selected.',
      nextSteps: [
        'In Meta Business Settings, confirm which Business Portfolio owns the Page.',
        'Transfer or claim the Page into the portfolio you are sharing from, or select the portfolio that already owns it.',
        'Retry discovery after ownership is corrected, or forward this invite to a Page admin who can fix it.',
      ],
      httpStatus: 403,
    };
  }

  const bmMismatch =
    normalized.includes('business manager') &&
    (normalized.includes('match') ||
      normalized.includes('same business') ||
      normalized.includes('must belong') ||
      normalized.includes('different business'));

  const assetFamilyMismatch =
    normalized.includes('instagram') &&
    normalized.includes('business') &&
    (normalized.includes('match') ||
      normalized.includes('same business manager') ||
      normalized.includes('belong to the same'));

  const pixelBmMismatch =
    normalized.includes('pixel') &&
    (normalized.includes('business') || normalized.includes('portfolio')) &&
    (normalized.includes('match') || normalized.includes('same'));

  if (bmMismatch || assetFamilyMismatch || pixelBmMismatch) {
    return {
      code: 'META_CONNECTION_BM_MISMATCH',
      title: 'Business Portfolio mismatch',
      message:
        'The ad account, Page, Instagram, or Pixel you selected do not belong to the same Business Portfolio in Meta. AuthHub cannot complete grant until assets are aligned.',
      nextSteps: [
        'In Meta Business Settings, move the assets into one Business Portfolio or pick assets that already share a portfolio.',
        'Reload accounts here after Meta shows a single portfolio for the whole set.',
        'If you cannot change portfolios, forward this invite to someone who administers the correct Business Manager.',
      ],
      httpStatus: 409,
    };
  }

  const adminPhrases = [
    'must be an admin',
    'requires admin',
    'not an admin',
    'need to be an admin',
    'does not have permission',
    'insufficient permission',
    '(#200)',
  ] as const;

  const notAdmin =
    metaCode === 200 ||
    metaCode === 10 ||
    adminPhrases.some((phrase) => normalized.includes(phrase));

  if (notAdmin && !mentionsTwoFactor) {
    return {
      code: 'META_CONNECTION_NOT_ADMIN',
      title: 'Admin access required',
      message:
        'Your Meta login does not have admin access to the Business Portfolio or assets needed for this request.',
      nextSteps: [
        'Forward this invite link to a colleague who is an admin on the Business Portfolio, Page, or ad account in Meta.',
        'Ask them to connect with their Facebook login and complete the steps.',
        'If you should have access, confirm your role in Meta Business Settings under People, then retry.',
      ],
      httpStatus: 403,
    };
  }

  return null;
}

export function parseMetaGraphErrorBody(body: string): MetaGraphErrorPayload | null {
  try {
    const parsed = JSON.parse(body) as { error?: MetaGraphErrorPayload };
    if (!parsed?.error || typeof parsed.error !== 'object') return null;
    return parsed.error;
  } catch {
    return null;
  }
}

export function mapMetaGraphError(input: MetaGraphErrorPayload): MetaConnectionErrorPresentation | null {
  return mapFromGraphSignals(input);
}

export function mapMetaConnectionErrorFromApi(
  code: string,
  message?: string,
  details?: unknown,
): MetaConnectionErrorPresentation {
  if (code === 'META_CONNECTION_INCOMPLETE_PERMISSIONS') {
    const missing =
      details &&
      typeof details === 'object' &&
      Array.isArray((details as { missingOAuthScopes?: unknown }).missingOAuthScopes)
        ? ((details as { missingOAuthScopes: string[] }).missingOAuthScopes as string[])
        : [];
    return mapMetaOAuthIncompletePermissions(missing.length > 0 ? missing : [...META_CORE_PERMISSIONS]);
  }

  const knownCodes: Record<string, MetaConnectionErrorCode> = {
    META_CONNECTION_NOT_ADMIN: 'META_CONNECTION_NOT_ADMIN',
    META_CONNECTION_2FA_REQUIRED: 'META_CONNECTION_2FA_REQUIRED',
    META_CONNECTION_PAGE_OWNERSHIP: 'META_CONNECTION_PAGE_OWNERSHIP',
    META_CONNECTION_BM_MISMATCH: 'META_CONNECTION_BM_MISMATCH',
    META_CONNECTION_INCOMPLETE_PERMISSIONS: 'META_CONNECTION_INCOMPLETE_PERMISSIONS',
    META_ASSET_NOT_IN_SELECTED_BUSINESS: 'META_CONNECTION_BM_MISMATCH',
    INVALID_META_BUSINESS_PORTFOLIO: 'META_CONNECTION_BM_MISMATCH',
    META_BUSINESS_SELECTION_MISMATCH: 'META_CONNECTION_BM_MISMATCH',
  };

  const mappedCode = knownCodes[code];
  if (mappedCode && mappedCode !== 'META_CONNECTION_UNKNOWN') {
    const fromGraph = mapFromGraphSignals({ message: message ?? '' });
    if (fromGraph && fromGraph.code === mappedCode) return fromGraph;

    const catalog: Record<
      Exclude<MetaConnectionErrorCode, 'META_CONNECTION_UNKNOWN'>,
      MetaConnectionErrorPresentation
    > = {
      META_CONNECTION_INCOMPLETE_PERMISSIONS: mapMetaOAuthIncompletePermissions([...META_CORE_PERMISSIONS]),
      META_CONNECTION_NOT_ADMIN: {
        code: 'META_CONNECTION_NOT_ADMIN',
        title: 'Admin access required',
        message:
          'Your Meta login does not have admin access to the Business Portfolio or assets needed for this request.',
        nextSteps: [
          'Forward this invite link to a colleague who is an admin on the Business Portfolio, Page, or ad account in Meta.',
          'Ask them to connect with their Facebook login and complete the steps.',
          'If you should have access, confirm your role in Meta Business Settings under People, then retry.',
        ],
        httpStatus: 403,
      },
      META_CONNECTION_2FA_REQUIRED: {
        code: 'META_CONNECTION_2FA_REQUIRED',
        title: 'Meta two-factor authentication required',
        message:
          'Meta requires two-factor authentication on this account before ad accounts or Business assets can be shared.',
        nextSteps: [
          'Sign in to Meta and turn on two-factor authentication for your personal Facebook login.',
          'Complete Meta’s security check, then return to this invite and try again.',
          'If an ad account admin manages security, ask them to enable 2FA or forward this invite link to them.',
        ],
        httpStatus: 403,
      },
      META_CONNECTION_PAGE_OWNERSHIP: {
        code: 'META_CONNECTION_PAGE_OWNERSHIP',
        title: 'Page owned by another Business',
        message:
          'Meta reports this Page is owned by a different Business Portfolio. AuthHub cannot grant access until ownership matches the portfolio you selected.',
        nextSteps: [
          'In Meta Business Settings, confirm which Business Portfolio owns the Page.',
          'Transfer or claim the Page into the portfolio you are sharing from, or select the portfolio that already owns it.',
          'Retry discovery after ownership is corrected, or forward this invite to a Page admin who can fix it.',
        ],
        httpStatus: 403,
      },
      META_CONNECTION_BM_MISMATCH: {
        code: 'META_CONNECTION_BM_MISMATCH',
        title: 'Business Portfolio mismatch',
        message:
          'The ad account, Page, Instagram, or Pixel you selected do not belong to the same Business Portfolio in Meta. AuthHub cannot complete grant until assets are aligned.',
        nextSteps: [
          'In Meta Business Settings, move the assets into one Business Portfolio or pick assets that already share a portfolio.',
          'Reload accounts here after Meta shows a single portfolio for the whole set.',
          'If you cannot change portfolios, forward this invite to someone who administers the correct Business Manager.',
        ],
        httpStatus: 409,
      },
    };

    return catalog[mappedCode];
  }

  const graphPayload =
    details &&
    typeof details === 'object' &&
    (details as { meta?: MetaGraphErrorPayload }).meta
      ? (details as { meta: MetaGraphErrorPayload }).meta
      : parseMetaGraphErrorBody(message ?? '');

  if (graphPayload) {
    const mapped = mapMetaGraphError(graphPayload);
    if (mapped) return mapped;
  }

  if (message) {
    const mapped = mapFromGraphSignals({ message });
    if (mapped) return mapped;
  }

  return {
    code: 'META_CONNECTION_UNKNOWN',
    title: 'Meta connection issue',
    message: 'AuthHub could not complete Meta account discovery. Try again or contact support with the code below.',
    nextSteps: [
      'Use Try again after confirming you are signed into the correct Facebook profile.',
      'If the problem continues, forward this invite to a Meta Business admin.',
      'Share the support code with AuthHub support so they can look up this failure category.',
    ],
    httpStatus: 502,
  };
}

export class MetaConnectionError extends Error {
  readonly presentation: MetaConnectionErrorPresentation;

  constructor(presentation: MetaConnectionErrorPresentation) {
    super(presentation.message);
    this.name = 'MetaConnectionError';
    this.presentation = presentation;
  }
}

export function tryMapThrownMetaError(error: unknown): MetaConnectionError | null {
  if (error instanceof MetaConnectionError) return error;

  if (error instanceof Error) {
    const graphPayload = parseMetaGraphErrorBody(error.message);
    if (graphPayload) {
      const mapped = mapMetaGraphError(graphPayload);
      if (mapped) return new MetaConnectionError(mapped);
    }

    const mapped = mapFromGraphSignals({ message: error.message });
    if (mapped) return new MetaConnectionError(mapped);
  }

  return null;
}
