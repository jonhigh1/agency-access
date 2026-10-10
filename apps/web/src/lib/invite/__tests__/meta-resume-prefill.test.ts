import { describe, expect, it } from 'vitest';
import {
  buildMetaGroupAssetsSeedFromPrefill,
  hasRetainedMetaSelection,
  invitePrefillSyncKey,
} from '../meta-resume-prefill';
import type { InviteSelectionPrefill } from '@/lib/invite/landing-state';

const prefill: InviteSelectionPrefill = {
  adAccounts: ['act-1'],
  pages: ['page-1'],
  instagramAccounts: ['ig-1'],
  catalogs: [],
  datasets: [],
};

describe('meta-resume-prefill', () => {
  it('reports retained selection only when every list matches', () => {
    expect(
      hasRetainedMetaSelection(prefill, {
        ...prefill,
        selectedBusinessId: 'biz-1',
      })
    ).toBe(true);

    expect(
      hasRetainedMetaSelection(prefill, {
        ...prefill,
        adAccounts: ['act-2'],
        selectedBusinessId: 'biz-1',
      })
    ).toBe(false);

    expect(hasRetainedMetaSelection(null, prefill as never)).toBe(false);
  });

  it('builds a sync key only when Meta grant step has selectable prefill', () => {
    expect(invitePrefillSyncKey(true, prefill)).toBe(JSON.stringify(prefill));
    expect(invitePrefillSyncKey(false, prefill)).toBe('');
    expect(
      invitePrefillSyncKey(true, {
        adAccounts: [],
        pages: [],
        instagramAccounts: [],
        catalogs: [],
        datasets: [],
      })
    ).toBe('');
  });

  it('seeds meta_ads / meta_pages / instagram from the same prefill blob', () => {
    const seed = buildMetaGroupAssetsSeedFromPrefill(prefill, 'biz-1');
    expect(seed.meta_ads?.selectedBusinessId).toBe('biz-1');
    expect(seed.meta_ads?.selectedAdAccountsWithNames).toEqual([{ id: 'act-1', name: 'act-1' }]);
    expect(seed.meta_pages).toBe(seed.meta_ads);
    expect(seed.instagram).toBe(seed.meta_ads);
  });
});
