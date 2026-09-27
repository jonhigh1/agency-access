import { m } from 'framer-motion';
import { PlatformIcon } from '@/components/ui';
import type { Platform } from '@agency-platform/shared';
import { InviteStatusChip, type InviteStatus } from './invite-status-chip';

interface InvitePlatformQueueItemProps {
  platform: Platform;
  platformName: string;
  description: string;
  status: InviteStatus;
}

/**
 * Numbered truth row. One list, not three sections. Row, not a card.
 * Position comes from list order only: no ordinals, no step counters (R3).
 */
export function InvitePlatformQueueItem({
  platform,
  platformName,
  description,
  status,
}: InvitePlatformQueueItemProps) {
  return (
    <m.div
      layout
      initial={false}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="flex min-h-[44px] items-center gap-3 border-b border-black/20 py-2.5 last:border-0"
    >
      <PlatformIcon platform={platform} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{platformName}</p>
        <p className="label-nano mt-0.5">{description}</p>
      </div>
      <InviteStatusChip status={status} />
    </m.div>
  );
}
