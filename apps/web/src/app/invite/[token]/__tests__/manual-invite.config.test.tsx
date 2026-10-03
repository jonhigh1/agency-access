import { describe, expect, it } from 'vitest';
import {
  beehiivManualConfig,
  kitManualConfig,
  klaviyoManualConfig,
  mailchimpManualConfig,
  pinterestManualConfig,
  shopifyManualConfig,
  zapierManualConfig,
} from '../manual-invite.config';

describe('manual invite completion copy', () => {
  it('reports a submission for review instead of a completed connection', () => {
    for (const config of [
      beehiivManualConfig,
      kitManualConfig,
      klaviyoManualConfig,
      mailchimpManualConfig,
      pinterestManualConfig,
      shopifyManualConfig,
      zapierManualConfig,
    ]) {
      const copy = `${config.completion.title || ''} ${config.completion.description} ${config.completion.pendingMessage}`;

      expect(copy).toMatch(/review|verif/i);
      expect(copy).not.toMatch(/mark .*complete|finalize|^connected$/i);
    }
  });
});
