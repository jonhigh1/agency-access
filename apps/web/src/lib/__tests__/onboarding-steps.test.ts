import { describe, it, expect } from 'vitest';
import { ONBOARDING_TOTAL_STEPS, formatOnboardingStepLabel } from '../onboarding-steps';

describe('onboarding-steps', () => {
  it('counts all seven screens including welcome (steps 0-6)', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(7);
  });

  it('formats step labels with 1-based index and total of seven', () => {
    expect(formatOnboardingStepLabel(0)).toBe('Step 1 of 7');
    expect(formatOnboardingStepLabel(2)).toBe('Step 3 of 7');
    expect(formatOnboardingStepLabel(5, true)).toBe('Step 6 of 7 (Optional)');
  });
});
