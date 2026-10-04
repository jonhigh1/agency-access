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

  it('blocks every email invite flow when its agency target is unavailable', () => {
    const payload = {
      agencyName: 'Demo Agency',
      clientName: 'Client',
      clientEmail: 'client@example.com',
      manualInviteTargets: {},
    } as any;

    for (const config of [
      beehiivManualConfig,
      kitManualConfig,
      klaviyoManualConfig,
      mailchimpManualConfig,
      zapierManualConfig,
    ]) {
      const data = config.parseData(payload);
      expect((data as any).agencyEmail).toBe('');
      expect(config.unavailableMessage?.(data as any)).toMatch(/not configured.*invite email.*contact your agency/i);
    }
  });
});
