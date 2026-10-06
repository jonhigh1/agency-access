import { describe, expect, it } from 'vitest';
import { META_GRANT_ACCESS } from '../meta-grant-access';

describe('META_GRANT_ACCESS', () => {
  it('defines manual partner-share copy and a system-user disclaimer in every locale', () => {
    (Object.keys(META_GRANT_ACCESS) as Array<keyof typeof META_GRANT_ACCESS>).forEach((locale) => {
      const manual = META_GRANT_ACCESS[locale].manual;
      expect(manual.title.length).toBeGreaterThan(0);
      expect(manual.subtitle).toMatch(/partner|socio|Partner/i);
      expect(manual.systemUserDisclaimer).toMatch(/system user|system user|system-user/i);
      expect(manual.systemUserDisclaimer).toMatch(/ads manager|Ads Manager/i);
    });
  });
});
