'use client';

/**
 * Visual QA fixture for ticket 04 — Manual ad-account partner share + Check access.
 * Route: /visual-qa/04-ads-management-honesty
 */

import { useEffect } from 'react';
import { MetaGrantChecklist } from '@/components/client-auth/MetaGrantChecklist';

export default function AdsManagementHonestyVisualQaPage() {
  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/meta/manual-ad-account-share/start')) {
        return new Response(
          JSON.stringify({
            data: {
              success: true,
              status: 'waiting_for_manual_share',
              partnerBusinessId: '123456789012345',
              verificationResults: [
                {
                  assetId: 'act_1001',
                  assetName: 'Demo Ad Account',
                  status: 'waiting_for_manual_share',
                },
              ],
            },
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };
    return () => {
      global.fetch = originalFetch;
    };
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <p className="label-micro mb-4">Visual QA fixture · ticket 04</p>
      <MetaGrantChecklist
        connectionId="visual-qa-conn"
        accessRequestToken="visual-qa-token"
        businessId="123456789012345"
        businessName="Demo Agency BM"
        selectedAssets={{
          adAccounts: ['act_1001'],
          pages: [],
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
