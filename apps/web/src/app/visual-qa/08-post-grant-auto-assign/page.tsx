'use client';

/**
 * Visual QA fixture — ticket 08 post-grant Auto-Assign (agency settings + results).
 * Route: /visual-qa/08-post-grant-auto-assign
 */

import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MetaAutoAssignSettings } from '@/components/meta-auto-assign-settings';
import { MetaAutoAssignCard } from '@/components/access-request-detail/meta-auto-assign-card';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

export default function PostGrantAutoAssignVisualQaPage() {
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const handleRunAutoAssign = useCallback(async () => {
    setRetryMessage('Fixture retry queued — live Graph assign still requires agency Meta OAuth.');
    return null;
  }, []);

  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('auto-assign-preferences')) {
        return new Response(
          JSON.stringify({
            data: {
              enabled: true,
              recipients: [{ type: 'human', id: '100', name: 'Agency Owner' }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('assignees')) {
        return new Response(
          JSON.stringify({
            data: [
              { type: 'human', id: '100', name: 'Agency Owner', role: 'ADMIN' },
              { type: 'system_user', id: '200', name: 'Automation Bot', role: 'EMPLOYEE' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };
    return () => {
      global.fetch = originalFetch;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-paper px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <header>
            <p className="label-micro text-muted-foreground">Visual QA · Ticket 08</p>
            <h1 className="font-dela text-2xl text-ink">Post-grant Auto-Assign</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Fixture Pass for picker + results surfaces, including a failed row with Retry failed assignments. Live Graph
              assign: Skip — Requires live Meta OAuth / agency BM.
            </p>
          </header>

          <section aria-label="Agency settings fixture">
            <MetaAutoAssignSettings agencyId="visual-qa-agency" />
          </section>

          <section aria-label="Post-grant results fixture">
            {retryMessage ? (
              <p
                className="mb-4 text-sm text-muted-foreground"
                role="status"
                data-testid="visual-qa-08-retry-status"
              >
                {retryMessage}
              </p>
            ) : null}
            <MetaAutoAssignCard
              partnerVerified
              autoAssignEnabled
              onRunAutoAssign={handleRunAutoAssign}
              results={[
                {
                  assetKind: 'page',
                  assetId: 'page_demo',
                  assetName: 'Client Page',
                  recipientType: 'human',
                  recipientId: '100',
                  recipientName: 'Agency Owner',
                  requestedTasks: ['ADVERTISE', 'ANALYZE'],
                  verifiedTasks: ['ADVERTISE', 'ANALYZE'],
                  status: 'verified',
                  attemptedAt: new Date().toISOString(),
                },
                {
                  assetKind: 'ad_account',
                  assetId: 'act_demo',
                  assetName: 'Client Ad Account',
                  recipientType: 'system_user',
                  recipientId: '200',
                  recipientName: 'Automation Bot',
                  requestedTasks: ['ADVERTISE'],
                  status: 'failed',
                  errorMessage: 'Requires live Meta OAuth (fixture)',
                  attemptedAt: new Date().toISOString(),
                },
              ]}
            />
          </section>
        </div>
      </main>
    </QueryClientProvider>
  );
}
