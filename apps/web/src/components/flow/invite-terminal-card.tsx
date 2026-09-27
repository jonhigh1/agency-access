import { toDisplayName } from '@/lib/display-name';
import { type InviteTerminalKind } from '@/lib/invite/landing-state';

import { InviteSupportCard } from './invite-support-card';

/**
 * Terminal landing (R3, AE6): an expired, revoked, or vanished request ends
 * the flow. Agency contact path only — no retry, no "Check again", no
 * re-entry. Extracted from client-invite-page.tsx (review #1) so the page
 * composes its endings instead of owning their markup.
 */

const TERMINAL_LANDING_COPY: Record<InviteTerminalKind, { title: string; description: string }> = {
  expired: {
    title: 'This link has expired',
    description:
      'This access request expired, so access cannot be granted. Contact your agency to get a new link.',
  },
  revoked: {
    title: 'This request was revoked',
    description:
      'Your agency withdrew this access request. Contact them if this does not look right.',
  },
  unavailable: {
    title: 'This link is no longer available',
    description: 'We could not find this access request. Contact your agency for a new link.',
  },
};

export function InviteTerminalCard({
  kind,
  logoUrl,
  agencyName,
}: {
  kind: InviteTerminalKind;
  logoUrl?: string | null;
  agencyName?: string | null;
}) {
  const copy = TERMINAL_LANDING_COPY[kind];
  const displayName = toDisplayName(agencyName || '');

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-black bg-card p-8 text-center shadow-brutalist">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={displayName ? `${displayName} logo` : 'Agency logo'}
            className="mx-auto mb-4 h-10 w-auto max-h-10 object-contain"
          />
        ) : null}
        <h1 className="font-display text-2xl font-semibold text-ink text-balance">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        <p className="mt-2 text-sm leading-6 text-ink">
          Nothing has been shared yet. You can safely close this page.
        </p>
        <InviteSupportCard
          className="mt-6 text-left"
          title="Need a new link?"
          description="Contact your agency or support and they will send a fresh authorization link."
          linkLabel="Contact support"
        />
      </div>
    </div>
  );
}
