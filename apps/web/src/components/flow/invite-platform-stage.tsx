import type { ReactNode } from 'react';
import { PlatformIcon } from '@/components/ui';
import type { Platform } from '@agency-platform/shared';
import { InviteStatusChip } from './invite-status-chip';

export interface InviteStageIdentity {
  label: string;
  value: string;
}

interface InvitePlatformStageProps {
  platform: Platform;
  platformName: string;
  stepNumber: number;
  totalCount: number;
  description: string;
  exitNote: string;
  identities?: InviteStageIdentity[];
  children: ReactNode;
}

/**
 * The one active decision on screen: what to connect, who is asking,
 * what happens when you click. The platform wizard renders inside this card.
 */
export function InvitePlatformStage({
  platform,
  platformName,
  stepNumber,
  totalCount,
  description,
  exitNote,
  identities = [],
  children,
}: InvitePlatformStageProps) {
  return (
    <section
      className="border-2 border-black bg-card shadow-brutalist"
      aria-label={`Active platform: ${platformName}`}
    >
      <div className="border-b-2 border-black px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="label-micro">
            Now · step {stepNumber} of {totalCount}
          </p>
          <InviteStatusChip status="active" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <PlatformIcon platform={platform} size="md" />
          <h2 className="text-xl font-bold tracking-tight text-ink font-display">{platformName}</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        <p className="mt-2 text-sm leading-6 text-ink">{exitNote}</p>
      </div>

      {identities.length > 0 ? (
        <div className="border-b border-black/20 px-5 py-4 sm:px-6">
          <p className="label-micro">Verify before you approve</p>
          <p className="mt-2 break-words text-sm leading-6 text-ink">
            {identities.map((identity) => `${identity.label}: ${identity.value}`).join(' · ')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            If this does not match what your agency sent you, stop and contact them.
          </p>
        </div>
      ) : null}

      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
