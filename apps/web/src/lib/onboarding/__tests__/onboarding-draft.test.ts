import { beforeEach, describe, expect, it } from 'vitest';
import {
  ONBOARDING_DRAFT_TTL_MS,
  ONBOARDING_RETURN_INTENT_KEY,
  ONBOARDING_RETURN_INTENT_TTL_MS,
  clearOnboardingDraft,
  consumeOnboardingReturnIntent,
  loadOnboardingDraft,
  onboardingDraftKey,
  onboardingReturnUrl,
  peekOnboardingReturnIntent,
  resolveRestoredStep,
  sanitizeSelectedPlatforms,
  saveOnboardingDraft,
  setOnboardingReturnIntent,
  type DraftStorage,
} from '../onboarding-draft';

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const NOW = 1_800_000_000_000;
const baseDraft = {
  currentStep: 3,
  agencyName: 'Example Agency',
  agencySettings: { timezone: 'UTC', industry: 'other', website: '' },
  clientName: 'Example Client',
  clientEmail: 'client@example.com',
  selectedPlatforms: { google: ['google'], meta: ['meta'] },
};

describe('onboarding draft persistence', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('round-trips the Meta selection per principal', () => {
    saveOnboardingDraft(storage, 'user_a', baseDraft, NOW);

    const restored = loadOnboardingDraft(storage, 'user_a', NOW + 1000);
    expect(restored?.selectedPlatforms).toEqual({ google: ['google'], meta: ['meta'] });
    expect(restored?.currentStep).toBe(3);
    expect(restored?.clientEmail).toBe('client@example.com');
    expect(loadOnboardingDraft(storage, 'user_b', NOW)).toBeNull();
  });

  it('expires stale drafts and removes them', () => {
    saveOnboardingDraft(storage, 'user_a', baseDraft, NOW);
    expect(loadOnboardingDraft(storage, 'user_a', NOW + ONBOARDING_DRAFT_TTL_MS + 1)).toBeNull();
    expect(storage.data.has(onboardingDraftKey('user_a'))).toBe(false);
  });

  it('rejects corrupt or tampered drafts', () => {
    storage.setItem(onboardingDraftKey('user_a'), '{not json');
    expect(loadOnboardingDraft(storage, 'user_a', NOW)).toBeNull();

    storage.setItem(
      onboardingDraftKey('user_a'),
      JSON.stringify({ v: 1, savedAt: NOW, currentStep: 3, selectedPlatforms: { meta: ['<script>'] } })
    );
    expect(loadOnboardingDraft(storage, 'user_a', NOW)).toBeNull();
  });

  it('sanitises platform selections', () => {
    expect(sanitizeSelectedPlatforms({ google: ['google', 'google', 7], meta: ['meta'], 'Bad Key': ['x'] })).toEqual({
      google: ['google'],
      meta: ['meta'],
    });
    expect(sanitizeSelectedPlatforms(['google'])).toBeNull();
    expect(sanitizeSelectedPlatforms({ google: [] })).toBeNull();
  });

  it('clears a draft', () => {
    saveOnboardingDraft(storage, 'user_a', baseDraft, NOW);
    clearOnboardingDraft(storage, 'user_a');
    expect(loadOnboardingDraft(storage, 'user_a', NOW)).toBeNull();
  });

  it('never restores past the platform step, nor past the client step without a valid client', () => {
    expect(resolveRestoredStep({ currentStep: 5, clientName: 'Example', clientEmail: 'a@example.com' })).toBe(3);
    expect(resolveRestoredStep({ currentStep: 3, clientName: 'Example', clientEmail: 'nope' })).toBe(2);
    expect(resolveRestoredStep({ currentStep: 1 })).toBe(1);
    expect(resolveRestoredStep({ currentStep: -2 })).toBe(0);
  });

  it('tolerates storage that throws', () => {
    const throwing: DraftStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => saveOnboardingDraft(throwing, 'user_a', baseDraft, NOW)).not.toThrow();
    expect(loadOnboardingDraft(throwing, 'user_a', NOW)).toBeNull();
    expect(peekOnboardingReturnIntent(throwing, NOW)).toBeNull();
  });
});

describe('onboarding return intent', () => {
  it('is one-shot and points back to the platform step', () => {
    const storage = memoryStorage();
    setOnboardingReturnIntent(storage, { step: 3, platform: 'meta' }, NOW);

    expect(peekOnboardingReturnIntent(storage, NOW + 1000)).toMatchObject({ step: 3, platform: 'meta' });
    expect(consumeOnboardingReturnIntent(storage, NOW + 1000)).toMatchObject({ path: '/onboarding/unified' });
    expect(consumeOnboardingReturnIntent(storage, NOW + 1000)).toBeNull();
  });

  it('expires after an hour', () => {
    const storage = memoryStorage();
    setOnboardingReturnIntent(storage, { step: 3, platform: 'meta' }, NOW);
    expect(consumeOnboardingReturnIntent(storage, NOW + ONBOARDING_RETURN_INTENT_TTL_MS + 1)).toBeNull();
    expect(storage.data.has(ONBOARDING_RETURN_INTENT_KEY)).toBe(false);
  });

  it('builds same-origin return urls only', () => {
    expect(onboardingReturnUrl('connected')).toBe('/onboarding/unified?meta=connected');
    expect(onboardingReturnUrl('error')).toBe('/onboarding/unified?meta=error');
  });
});
