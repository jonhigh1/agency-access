'use client';

import type { ReactNode } from 'react';
import { InviteHeroHeader } from './invite-hero-header';

interface ManualInviteHeaderProps {
  agencyName: string;
  platformName: string;
  logoUrl?: string;
  backAction?: ReactNode;
  securityNote: string;
}

export function ManualInviteHeader({
  agencyName,
  platformName,
  logoUrl,
  backAction,
  securityNote,
}: ManualInviteHeaderProps) {
  return (
    <div className="space-y-4">
      {backAction ? <div className="flex justify-end">{backAction}</div> : null}
      <InviteHeroHeader
        title={`Complete ${platformName} access`}
        description={[
          `${agencyName} asked for ${platformName} access.`,
          securityNote,
          `Use ${platformName}'s native invite flow, finish the checklist, and return to the request.`,
        ].filter(Boolean).join(' ')}
        badge="Manual invite"
        logoUrl={logoUrl}
        logoAlt={`${agencyName} logo`}
      />
    </div>
  );
}

export type { ManualInviteHeaderProps };
