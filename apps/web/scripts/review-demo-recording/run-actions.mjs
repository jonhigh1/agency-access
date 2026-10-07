import { setRecordingCaption } from './caption-overlay.mjs';

/** @param {import('playwright').Page} page @param {import('./manifest.mjs').RecordingAction} action */
export async function runRecordingAction(page, action) {
  switch (action.type) {
    case 'caption':
      await setRecordingCaption(page, action.primary ?? '', action.secondary ?? '');
      return;
    case 'click': {
      if (!action.testId) throw new Error('click action requires testId');
      await page.getByTestId(action.testId).click();
      return;
    }
    case 'wait': {
      if (!action.testId) throw new Error('wait action requires testId');
      await page.getByTestId(action.testId).waitFor({ state: 'visible', timeout: 30_000 });
      return;
    }
    case 'hold':
      await page.waitForTimeout(action.ms ?? 1000);
      return;
    case 'ensureAdPartner': {
      const button = page.getByTestId('review-demo-ensure-ad-partner');
      await button.waitFor({ state: 'visible', timeout: 30_000 });
      if (await button.isEnabled()) {
        await button.click();
      }
      return;
    }
    default: {
      const unknown = /** @type {never} */ (action.type);
      throw new Error(`Unknown recording action: ${String(unknown)}`);
    }
  }
}

/** @param {import('playwright').Page} page @param {import('./manifest.mjs').RecordingStepPlan} plan */
export async function runStepPlan(page, plan) {
  for (const action of plan.actions) {
    await runRecordingAction(page, action);
  }
}
