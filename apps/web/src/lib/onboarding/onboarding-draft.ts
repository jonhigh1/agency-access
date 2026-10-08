/**
 * Onboarding draft persistence (per browser tab).
 *
 * The unified onboarding wizard keeps its pre-link state (agency profile,
 * client, platform selection, current step) in React state only, so a reload
 * or the agency Meta OAuth round-trip used to drop it: the platform selection
 * reset to Google-only and the wizard fell back to the client step.
 *
 * We persist a small draft in sessionStorage (tab-scoped, cleared once the
 * first access link exists) keyed by the Clerk principal, and a separate
 * short-lived "return intent" so /platforms/callback can send the agency back
 * to the onboarding step it left from instead of /connections.
 */

export type DraftPlatformSelection = Record<string, string[]>;

export interface OnboardingDraft {
  v: 1;
  savedAt: number;
  currentStep: number;
  agencyName?: string;
  agencySettings?: {
    timezone?: string;
    industry?: string;
    website?: string;
  };
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  selectedPlatforms: DraftPlatformSelection;
}

export interface OnboardingReturnIntent {
  v: 1;
  path: '/onboarding/unified';
  step: number;
  platform: 'meta';
  createdAt: number;
}

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Steps 1-3 are the only pre-link steps worth restoring (3 = Choose Platforms). */
export const MAX_RESTORABLE_STEP = 3;
export const ONBOARDING_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const ONBOARDING_RETURN_INTENT_TTL_MS = 60 * 60 * 1000;
export const ONBOARDING_RETURN_INTENT_KEY = 'authhub:onboarding-return:v1';

const DRAFT_KEY_PREFIX = 'authhub:onboarding-draft:v1:';
const PLATFORM_TOKEN = /^[a-z0-9_]{1,40}$/;
const MAX_PLATFORMS_PER_GROUP = 20;
const MAX_GROUPS = 20;
const MAX_TEXT = 320;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getSessionDraftStorage(): DraftStorage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function onboardingDraftKey(principalId: string): string {
  return `${DRAFT_KEY_PREFIX}${principalId}`;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length <= MAX_TEXT ? value : value.slice(0, MAX_TEXT);
}

/**
 * Keep only `{ group: [platform, ...] }` entries made of short lowercase
 * tokens. Returns null when nothing valid is left.
 */
export function sanitizeSelectedPlatforms(value: unknown): DraftPlatformSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const result: DraftPlatformSelection = {};
  for (const [group, platforms] of Object.entries(value as Record<string, unknown>).slice(0, MAX_GROUPS)) {
    if (!PLATFORM_TOKEN.test(group) || !Array.isArray(platforms)) continue;
    const valid = Array.from(
      new Set(platforms.filter((p): p is string => typeof p === 'string' && PLATFORM_TOKEN.test(p)))
    ).slice(0, MAX_PLATFORMS_PER_GROUP);
    if (valid.length > 0) result[group] = valid;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function hasValidDraftClient(draft: Pick<OnboardingDraft, 'clientName' | 'clientEmail'>): boolean {
  const name = draft.clientName?.trim() ?? '';
  const email = draft.clientEmail?.trim() ?? '';
  return name.length >= 2 && EMAIL_REGEX.test(email);
}

/** The step to resume on: never past Choose Platforms, and never past the client step without a valid client. */
export function resolveRestoredStep(draft: Pick<OnboardingDraft, 'currentStep' | 'clientName' | 'clientEmail'>): number {
  const step = Math.max(0, Math.min(Math.trunc(draft.currentStep), MAX_RESTORABLE_STEP));
  if (step >= 3 && !hasValidDraftClient(draft)) return 2;
  return step;
}

export function parseOnboardingDraft(raw: string | null, now: number): OnboardingDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Record<string, unknown>;

  if (value.v !== 1 || typeof value.savedAt !== 'number' || typeof value.currentStep !== 'number') return null;
  if (!Number.isFinite(value.savedAt) || now - value.savedAt > ONBOARDING_DRAFT_TTL_MS || value.savedAt > now + 60_000) {
    return null;
  }

  const selectedPlatforms = sanitizeSelectedPlatforms(value.selectedPlatforms);
  if (!selectedPlatforms) return null;

  const settings = value.agencySettings && typeof value.agencySettings === 'object'
    ? (value.agencySettings as Record<string, unknown>)
    : null;

  return {
    v: 1,
    savedAt: value.savedAt,
    currentStep: Number.isFinite(value.currentStep) ? value.currentStep : 0,
    agencyName: optionalText(value.agencyName),
    agencySettings: settings
      ? {
          timezone: optionalText(settings.timezone),
          industry: optionalText(settings.industry),
          website: optionalText(settings.website),
        }
      : undefined,
    clientId: optionalText(value.clientId),
    clientName: optionalText(value.clientName),
    clientEmail: optionalText(value.clientEmail),
    selectedPlatforms,
  };
}

export function loadOnboardingDraft(
  storage: DraftStorage | null,
  principalId: string | null | undefined,
  now: number = Date.now()
): OnboardingDraft | null {
  if (!storage || !principalId) return null;
  try {
    const draft = parseOnboardingDraft(storage.getItem(onboardingDraftKey(principalId)), now);
    if (!draft) storage.removeItem(onboardingDraftKey(principalId));
    return draft;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(
  storage: DraftStorage | null,
  principalId: string | null | undefined,
  draft: Omit<OnboardingDraft, 'v' | 'savedAt'>,
  now: number = Date.now()
): void {
  if (!storage || !principalId) return;
  const selectedPlatforms = sanitizeSelectedPlatforms(draft.selectedPlatforms);
  if (!selectedPlatforms) return;
  try {
    const value: OnboardingDraft = { ...draft, selectedPlatforms, v: 1, savedAt: now };
    storage.setItem(onboardingDraftKey(principalId), JSON.stringify(value));
  } catch {
    // Storage full or blocked: onboarding still works, it just won't survive a reload.
  }
}

export function clearOnboardingDraft(storage: DraftStorage | null, principalId: string | null | undefined): void {
  if (!storage || !principalId) return;
  try {
    storage.removeItem(onboardingDraftKey(principalId));
  } catch {
    // ignore
  }
}

export function setOnboardingReturnIntent(
  storage: DraftStorage | null,
  input: { step: number; platform: 'meta' },
  now: number = Date.now()
): void {
  if (!storage) return;
  const intent: OnboardingReturnIntent = {
    v: 1,
    path: '/onboarding/unified',
    step: input.step,
    platform: input.platform,
    createdAt: now,
  };
  try {
    storage.setItem(ONBOARDING_RETURN_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // ignore
  }
}

export function peekOnboardingReturnIntent(
  storage: DraftStorage | null,
  now: number = Date.now()
): OnboardingReturnIntent | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ONBOARDING_RETURN_INTENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<OnboardingReturnIntent>;
    if (
      value?.v !== 1 ||
      value.path !== '/onboarding/unified' ||
      value.platform !== 'meta' ||
      typeof value.step !== 'number' ||
      typeof value.createdAt !== 'number' ||
      now - value.createdAt > ONBOARDING_RETURN_INTENT_TTL_MS ||
      value.createdAt > now + 60_000
    ) {
      storage.removeItem(ONBOARDING_RETURN_INTENT_KEY);
      return null;
    }
    return value as OnboardingReturnIntent;
  } catch {
    return null;
  }
}

export function clearOnboardingReturnIntent(storage: DraftStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(ONBOARDING_RETURN_INTENT_KEY);
  } catch {
    // ignore
  }
}

/** Read and remove the intent (one-shot). */
export function consumeOnboardingReturnIntent(
  storage: DraftStorage | null,
  now: number = Date.now()
): OnboardingReturnIntent | null {
  const intent = peekOnboardingReturnIntent(storage, now);
  if (intent) clearOnboardingReturnIntent(storage);
  return intent;
}

export type OnboardingMetaOutcome = 'connected' | 'error' | 'cancelled';

export function isOnboardingMetaOutcome(value: unknown): value is OnboardingMetaOutcome {
  return value === 'connected' || value === 'error' || value === 'cancelled';
}

/** Where /platforms/callback sends the agency after the Meta portfolio is saved, fails, or is abandoned. */
export function onboardingReturnUrl(outcome: OnboardingMetaOutcome): string {
  return `/onboarding/unified?meta=${outcome}`;
}
