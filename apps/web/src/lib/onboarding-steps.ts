/** Unified PLG onboarding: steps 0–6 (Welcome through Final Success). */
export const ONBOARDING_TOTAL_STEPS = 7;

export function formatOnboardingStepLabel(stepIndex: number, optional = false): string {
  const label = `Step ${stepIndex + 1} of ${ONBOARDING_TOTAL_STEPS}`;
  return optional ? `${label} (Optional)` : label;
}
