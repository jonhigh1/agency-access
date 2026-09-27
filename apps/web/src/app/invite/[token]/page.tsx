import { Suspense } from 'react';

import { fetchClientInvitePayload } from '@/lib/server/fetch-client-invite-payload';

import ClientInvitePage from './client-invite-page';
import InviteTokenLoading from './loading';

// KTD13: this page is reached through a logged-out bearer link, so the URL
// contains a secret. The restrictive referrer policy lives in this segment's
// layout.tsx (it also covers the nested manual-invite routes); PostHog URL
// scrubbing (instrumentation-client) covers analytics.

async function InviteTokenInner({ token }: { token: string }) {
  const result = await fetchClientInvitePayload(token);

  const serverInviteResult = result.ok
    ? ({ status: 'ok' as const, payload: result.payload })
    : ({ status: 'error' as const, message: result.message, code: result.code });

  return <ClientInvitePage token={token} serverInviteResult={serverInviteResult} />;
}

/**
 * Server-fetches public invite payload so HTML can stream after Suspense resolves,
 * improving LCP vs a client-only fetch after hydration.
 */
export default async function InviteTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <Suspense fallback={<InviteTokenLoading />}>
      <InviteTokenInner token={token} />
    </Suspense>
  );
}
