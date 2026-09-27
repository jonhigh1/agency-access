import { Suspense } from 'react';
import type { Metadata } from 'next';

import { fetchClientInvitePayload } from '@/lib/server/fetch-client-invite-payload';

import ClientInvitePage from './client-invite-page';
import InviteTokenLoading from './loading';

/**
 * KTD13: this page is reached through a logged-out bearer link, so the URL
 * contains a secret. A restrictive referrer policy keeps the token from
 * leaking through the Referer header on any outbound or cross-origin
 * navigation; PostHog URL scrubbing (instrumentation-client) covers analytics.
 */
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

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
