import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultGoogleProductSelection,
  isMetaGroupPlatform,
  isMetaPendingApproval,
  withoutMetaPlatforms,
} from '../meta-pending-approval';

const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const original = process.env[FLAG];

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
});

describe('isMetaPendingApproval', () => {
  it('is on only for the exact string "true"', () => {
    process.env[FLAG] = 'true';
    expect(isMetaPendingApproval()).toBe(true);
  });

  it.each([undefined, '', 'false', '1', 'TRUE', 'yes'])('is off for %s', (value) => {
    if (value === undefined) delete process.env[FLAG];
    else process.env[FLAG] = value;
    expect(isMetaPendingApproval()).toBe(false);
  });
});

describe('Meta selection helpers', () => {
  it('recognises the Meta group and its products', () => {
    expect(isMetaGroupPlatform('meta')).toBe(true);
    expect(isMetaGroupPlatform('meta_ads')).toBe(true);
    expect(isMetaGroupPlatform('instagram')).toBe(true);
    expect(isMetaGroupPlatform('google')).toBe(false);
    expect(isMetaGroupPlatform(null)).toBe(false);
  });

  it('drops every Meta entry and empty groups', () => {
    expect(
      withoutMetaPlatforms({ google: ['google_ads'], meta: ['meta_ads', 'instagram'], linkedin: [] })
    ).toEqual({ google: ['google_ads'] });
    expect(withoutMetaPlatforms({ meta: ['meta'] })).toEqual({});
  });

  it('defaults to every Google product', () => {
    const selection = defaultGoogleProductSelection();
    expect(Object.keys(selection)).toEqual(['google']);
    expect(selection.google).toContain('google_ads');
    expect(selection.google).toContain('ga4');
  });
});
