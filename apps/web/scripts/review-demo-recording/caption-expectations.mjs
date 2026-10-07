import { REVIEW_DEMO_RECORDING_PLAN, REVIEW_DEMO_RECORDING_STEPS } from './manifest.mjs';

/**
 * Primary burned-in caption line expected for a permission (from shot list).
 * @param {string} permission
 */
export function expectedCaptionPrimaryForPermission(permission) {
  const plan = REVIEW_DEMO_RECORDING_PLAN.find((step) => step.stepId === permission);
  if (!plan) {
    throw new Error(`Unknown review-demo permission: ${permission}`);
  }
  const captionAction = plan.actions.find((action) => action.type === 'caption');
  return captionAction?.primary ?? `Permission: ${permission}`;
}

/** @param {boolean} smoke */
export function requiredPermissionsForVerify(smoke) {
  return smoke ? REVIEW_DEMO_RECORDING_STEPS.slice(0, 1) : [...REVIEW_DEMO_RECORDING_STEPS];
}

export function permissionLabelDetectable(captionPrimary, permission) {
  if (!captionPrimary || typeof captionPrimary !== 'string') {
    return false;
  }
  const normalized = captionPrimary.toLowerCase();
  return normalized.includes(permission.toLowerCase()) || normalized.includes('permission:');
}
