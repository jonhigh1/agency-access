'use client';

/**
 * Visual QA fixture for ticket 11 — Partner durability + automation matrix copy.
 * Route: /visual-qa/11-partner-durability-copy
 */

import { MetaGrantChecklist } from '@/components/client-auth/MetaGrantChecklist';
import { MetaPartnerDurabilityPanel } from '@/components/meta/MetaPartnerDurabilityPanel';

export default function PartnerDurabilityCopyVisualQaPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <p className="label-micro">Visual QA fixture · ticket 11</p>
      <MetaPartnerDurabilityPanel />
      <MetaGrantChecklist
        connectionId="visual-qa-conn"
        accessRequestToken="visual-qa-token"
        businessId="3808519629379919"
        businessName="Demo Agency BM"
        selectedAssets={{
          adAccounts: ['act_1001'],
          pages: ['page_1001'],
          instagramAccounts: [],
          catalogs: [],
          datasets: [],
          selectedAdAccountsWithNames: [{ id: 'act_1001', name: 'Demo Ad Account' }],
        }}
        onItemSettled={() => undefined}
      />
    </main>
  );
}
