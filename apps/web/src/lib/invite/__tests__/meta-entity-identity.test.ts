import { describe, expect, it } from 'vitest';
import {
  buildMetaSelectedIdentityRows,
  formatMetaEntityIdentity,
  formatMetaPageChipDisplay,
  metaAssetOptionDescription,
} from '../meta-entity-identity';

describe('meta-entity-identity', () => {
  it('formats name and id on one stable line', () => {
    expect(formatMetaEntityIdentity('DogTimez Ads', 'act_813104320370861')).toBe(
      'DogTimez Ads · ID act_813104320370861'
    );
  });

  it('prefers page name on chips and keeps full id in title', () => {
    expect(formatMetaPageChipDisplay('Demo Page', 'page_demo_1')).toEqual({
      label: 'Demo Page',
      title: 'Demo Page · ID page_demo_1',
    });
    expect(formatMetaPageChipDisplay('3315067890123', '3315067890123').label).toBe('3315067890123');
  });

  it('builds combobox descriptions with required Meta object id', () => {
    expect(metaAssetOptionDescription('page_1001', 'Brand')).toBe('ID page_1001 · Brand');
    expect(metaAssetOptionDescription('act_1')).toBe('ID act_1');
  });

  it('builds selected identity rows including client Business Portfolio', () => {
    const rows = buildMetaSelectedIdentityRows({
      clientBusiness: { name: 'DogTimez Retail', id: 'biz_client_2' },
      pages: [{ name: 'DogTimez Facebook', id: 'page_1001' }],
      adAccounts: [{ name: 'DogTimez Ads', id: 'act_813104320370861' }],
    });

    expect(rows).toEqual([
      { kind: 'Business Portfolio', name: 'DogTimez Retail', id: 'biz_client_2' },
      { kind: 'Ad account', name: 'DogTimez Ads', id: 'act_813104320370861' },
      { kind: 'Page', name: 'DogTimez Facebook', id: 'page_1001' },
    ]);
  });
});
