'use client';

/**
 * Visual QA fixture for ticket 07 — Automatic Pages grant + Manual fallback copy.
 * Route: /visual-qa/07-automatic-pages-partner-readback
 */

import { useEffect, useState } from 'react';
import { AutomaticPagesGrant } from '@/components/client-auth/AutomaticPagesGrant';

export default function AutomaticPagesPartnerReadbackVisualQaPage() {
  const [mode, setMode] = useState<'idle' | 'granted' | 'failed'>('idle');

  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/grant-meta-access')) {
        if (mode === 'granted') {
          return new Response(
            JSON.stringify({
              data: {
                assetGrantResults: [
                  { assetId: 'page_demo_1', assetType: 'page', status: 'verified' },
                ],
              },
              error: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (mode === 'failed') {
          return new Response(
            JSON.stringify({
              data: {
                assetGrantResults: [
                  {
                    assetId: 'page_demo_1',
                    assetType: 'page',
                    status: 'failed',
                    errorMessage: 'Meta returned fewer tasks than this request requires',
                  },
                ],
              },
              error: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      return originalFetch(input, init);
    };
    return () => {
      global.fetch = originalFetch;
    };
  }, [mode]);

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <p className="label-micro">Visual QA fixture · ticket 07</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-[44px] border-2 border-ink px-4 py-2 text-sm font-semibold"
          onClick={() => setMode('idle')}
        >
          Reset (idle)
        </button>
        <button
          type="button"
          className="min-h-[44px] border-2 border-ink px-4 py-2 text-sm font-semibold"
          onClick={() => setMode('granted')}
        >
          Simulate granted read-back
        </button>
        <button
          type="button"
          className="min-h-[44px] border-2 border-ink px-4 py-2 text-sm font-semibold"
          onClick={() => setMode('failed')}
        >
          Simulate failed read-back
        </button>
      </div>
      <AutomaticPagesGrant
        selectedPages={[{ id: 'page_demo_1', name: 'Demo Page' }]}
        connectionId="visual-qa-conn"
        accessRequestToken="visual-qa-token"
        onGrantComplete={() => undefined}
      />
    </main>
  );
}
