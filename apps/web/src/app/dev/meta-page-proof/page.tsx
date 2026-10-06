'use client';

import { notFound } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';
import { MetaPageEngagementProof } from '@/components/client-auth/MetaPageEngagementProof';

function useMetaPageProofFetchMock(): void {
  useLayoutEffect(() => {
    const payload = {
      data: {
        page: {
          id: '100000000000001',
          name: 'App Review Demo Page',
          category: 'Local Business',
          managedTasks: ['MANAGE', 'ADVERTISE'],
          followerCount: 2400,
        },
        connectedInstagram: { id: '17841400000000001', username: 'appreviewdemo' },
        posts: [
          {
            id: 'post_demo_1',
            createdTime: '2026-09-21T12:00:00+0000',
            message: 'This caption must not appear in the UI',
            story: 'This story must not appear in the UI',
          },
          {
            id: 'post_demo_2',
            createdTime: '2026-09-15T08:30:00+0000',
            message: 'Second hidden caption',
          },
        ],
      },
      error: null,
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/meta-page-proof')) {
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
}

export default function MetaPageProofDevPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  useMetaPageProofFetchMock();

  useEffect(() => {
    document.body.dataset.metaPageProofHarness = 'ready';
  }, []);

  return (
    <main className="min-h-screen bg-[var(--paper)] px-6 py-10">
      <div className="mx-auto max-w-lg rounded-lg border-2 border-[var(--ink)] bg-white p-6 shadow-brutalist">
        <p className="mb-4 font-mono text-xs text-muted-foreground">Dev harness — ticket 05 Visual QA (mocked Meta API)</p>
        <MetaPageEngagementProof
          selectedPage={{ id: '100000000000001', name: 'App Review Demo Page' }}
          connectionId="dev-connection"
          accessRequestToken="dev-token"
        />
      </div>
    </main>
  );
}
