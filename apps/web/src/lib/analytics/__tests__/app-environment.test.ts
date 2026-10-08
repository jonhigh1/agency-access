// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyticsEnvironmentProperties,
  resolveAnalyticsEnvironment,
} from '@/lib/analytics/app-environment';

describe('analytics environment super-property (web)', () => {
  it('registers nothing for unset, blank or production', () => {
    for (const raw of [undefined, null, '', ' ', 'production', 'PRODUCTION']) {
      expect(resolveAnalyticsEnvironment(raw)).toBeNull();
      expect(analyticsEnvironmentProperties(raw)).toEqual({});
    }
  });

  it('returns { environment } for staging', () => {
    expect(analyticsEnvironmentProperties('staging')).toEqual({ environment: 'staging' });
    expect(analyticsEnvironmentProperties(' Staging ')).toEqual({ environment: 'staging' });
  });

  it('instrumentation-client registers it from NEXT_PUBLIC_APP_ENV only when non-empty', () => {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, '..', '..', '..', '..', 'instrumentation-client.ts'),
      'utf8'
    );
    expect(source).toContain('analyticsEnvironmentProperties(process.env.NEXT_PUBLIC_APP_ENV)');
    expect(source).toContain('posthog.register(environmentProperties)');
  });
});
