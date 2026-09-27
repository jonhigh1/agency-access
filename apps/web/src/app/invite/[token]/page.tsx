import { Suspense } from 'react';

import { fetchClientInvitePayload } from '@/lib/server/fetch-client-invite-payload';

import ClientInvitePage from './client-invite-page';
import InviteTokenLoading from './loading';

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
