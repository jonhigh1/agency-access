/**
 * Data-driven shot list for Meta App Review `/review-demo` screencasts.
 * Step order matches packages/shared REVIEW_DEMO_STEP_ORDER (build spec #135 §C/D).
 */
export const REVIEW_DEMO_RECORDING_STEPS = [
  'pages_show_list',
  'pages_read_engagement',
  'ads_management',
  'business_management',
];

/** @typedef {'caption' | 'click' | 'wait' | 'hold' | 'pauseAd' | 'resumeAd'} RecordingActionType */

/**
 * @typedef {Object} RecordingAction
 * @property {RecordingActionType} type
 * @property {string} [testId]
 * @property {number} [ms]
 * @property {string} [primary]
 * @property {string} [secondary]
 */

/**
 * @typedef {Object} RecordingStepPlan
 * @property {string} stepId
 * @property {string} outputBasename Permission key used for artifact filenames
 * @property {RecordingAction[]} actions
 */

/** @type {RecordingStepPlan[]} */
export const REVIEW_DEMO_RECORDING_PLAN = [
  {
    stepId: 'pages_show_list',
    outputBasename: 'pages_show_list',
    actions: [
      {
        type: 'caption',
        primary: 'Permission: pages_show_list',
        secondary: 'Login → grant → list Facebook Pages (Review BM sandbox)',
      },
      { type: 'click', testId: 'review-demo-step-tab-pages_show_list' },
      { type: 'wait', testId: 'review-demo-pages-list' },
      { type: 'hold', ms: 2500 },
    ],
  },
  {
    stepId: 'pages_read_engagement',
    outputBasename: 'pages_read_engagement',
    actions: [
      {
        type: 'caption',
        primary: 'Permission: pages_read_engagement',
        secondary: 'Show Page posts and engagement-visible content',
      },
      { type: 'click', testId: 'review-demo-step-tab-pages_read_engagement' },
      { type: 'wait', testId: 'review-demo-posts-list' },
      { type: 'hold', ms: 2500 },
    ],
  },
  {
    stepId: 'ads_management',
    outputBasename: 'ads_management',
    actions: [
      {
        type: 'caption',
        primary: 'Permission: ads_management',
        secondary: 'List campaigns on test ad account → pause test ad (reversible)',
      },
      { type: 'click', testId: 'review-demo-step-tab-ads_management' },
      { type: 'wait', testId: 'review-demo-campaigns-list' },
      { type: 'pauseAd' },
      { type: 'wait', testId: 'review-demo-pause-proof' },
      { type: 'hold', ms: 2000 },
      {
        type: 'caption',
        primary: 'Permission: ads_management',
        secondary: 'Resume test ad after pause proof',
      },
      { type: 'resumeAd' },
      { type: 'hold', ms: 1500 },
    ],
  },
  {
    stepId: 'business_management',
    outputBasename: 'business_management',
    actions: [
      {
        type: 'caption',
        primary: 'Permission: business_management',
        secondary: 'Business Manager catalogs and owned assets (Review BM)',
      },
      { type: 'click', testId: 'review-demo-step-tab-business_management' },
      { type: 'wait', testId: 'review-demo-catalog-list' },
      { type: 'wait', testId: 'review-demo-bm-assets-list' },
      { type: 'hold', ms: 2500 },
    ],
  },
];

export function assertRecordingPlanMatchesSteps() {
  const planIds = REVIEW_DEMO_RECORDING_PLAN.map((step) => step.stepId);
  if (planIds.length !== REVIEW_DEMO_RECORDING_STEPS.length) {
    throw new Error('Recording plan step count does not match REVIEW_DEMO_RECORDING_STEPS');
  }
  for (let index = 0; index < REVIEW_DEMO_RECORDING_STEPS.length; index += 1) {
    if (planIds[index] !== REVIEW_DEMO_RECORDING_STEPS[index]) {
      throw new Error(
        `Recording plan order mismatch at index ${index}: expected ${REVIEW_DEMO_RECORDING_STEPS[index]}, got ${planIds[index]}`
      );
    }
    const plan = REVIEW_DEMO_RECORDING_PLAN[index];
    if (plan.outputBasename !== plan.stepId) {
      throw new Error(`outputBasename must equal permission key for ${plan.stepId}`);
    }
  }
}
