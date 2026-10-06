'use client';

/**
 * Visual QA fixture for ticket 07 — Automatic Pages grant + Manual fallback copy.
 * Route: /visual-qa/07-automatic-pages-partner-readback
 */

import { useEffect, useRef, useState } from 'react';
import { AutomaticPagesGrant } from '@/components/client-auth/AutomaticPagesGrant';

type ReadBackMode = 'idle' | 'granted' | 'failed';

export default function AutomaticPagesPartnerReadbackVisualQaPage() {
  const [mode, setMode] = useState<ReadBackMode>('idle');
  const [fixtureKey, setFixtureKey] = useState(0);
  const readBackModeRef = useRef<ReadBackMode>('idle');

  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/grant-meta-access')) {
        const currentMode = readBackModeRef.current;
        if (currentMode === 'granted') {
          return new Response(
            JSON.stringify({
              data: {
                assetGrantResults: [
                  { assetId: 'page_demo_1', assetType: 'page', status: 'verified' },
                ],
              },
              error: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (currentMode === 'failed') {
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
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
      return originalFetch(input, init);
    };
    return () => {
      global.fetch = originalFetch;
    };
  }, []);

  const startSimulation = (nextMode: Exclude<ReadBackMode, 'idle'>) => {
    readBackModeRef.current = nextMode;
    setMode(nextMode);
    setFixtureKey((value) => value + 1);
  };

  const resetFixture = () => {
    readBackModeRef.current = 'idle';
    setMode('idle');
    setFixtureKey((value) => value + 1);
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <p className="label-micro">Visual QA fixture · ticket 07</p>
      <p className="text-sm text-muted-foreground">
        Simulate read-back runs Grant Access with a mocked Meta response so success and failure states are visible
        without live OAuth.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-[44px] border-2 border-ink px-4 py-2 text-sm font-semibold"
          onClick={resetFixture}
        >
          Reset (idle)
        </button>
        <button
          type="button"
          className="min-h-[44px] border-2 border-ink px-4 py-2 text-sm font-semibold"
          onClick={() => startSimulation('granted')}
        >
          Simulate granted read-back
        </button>
        <button
          type="button"
          className="min-h-[44px] border-2 border-ink px-4 py-2 text-sm font-semibold"
          onClick={() => startSimulation('failed')}
        >
          Simulate failed read-back
        </button>
      </div>
      {mode !== 'idle' ? (
        <p className="text-sm font-medium text-ink" role="status">
          Fixture mode: {mode === 'granted' ? 'granted read-back' : 'failed read-back'}
        </p>
      ) : null}
      <AutomaticPagesGrant
        key={`${mode}-${fixtureKey}`}
        fixtureAutoGrantOnMount={mode !== 'idle'}
        selectedPages={[{ id: 'page_demo_1', name: 'Demo Page' }]}
        connectionId="visual-qa-conn"
        accessRequestToken="visual-qa-token"
        onGrantComplete={() => undefined}
      />
    </main>
  );
}
