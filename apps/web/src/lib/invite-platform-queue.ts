import type {
  ClientAccessRequestPlatformGroup,
  ClientUnresolvedProduct,
  Platform,
} from '@agency-platform/shared';
import { buildInvitePlatformChecklist } from './invite/platform-status';

interface BuildInvitePlatformQueueOptions {
  platforms: ClientAccessRequestPlatformGroup[];
  completedPlatforms: ReadonlySet<Platform>;
  unresolvedProducts?: ReadonlyArray<ClientUnresolvedProduct>;
  returningPlatform?: Platform | null;
}

export interface InvitePlatformQueueState {
  activePlatform: ClientAccessRequestPlatformGroup | null;
  completedPlatforms: ClientAccessRequestPlatformGroup[];
  remainingPlatforms: ClientAccessRequestPlatformGroup[];
  nextPlatform: ClientAccessRequestPlatformGroup | null;
}

export function buildInvitePlatformQueue({
  platforms,
  completedPlatforms,
  unresolvedProducts,
  returningPlatform = null,
}: BuildInvitePlatformQueueOptions): InvitePlatformQueueState {
  const completed = platforms.filter((group) =>
    completedPlatforms.has(group.platformGroup as Platform)
  );
  const incomplete = platforms.filter((group) => !completedPlatforms.has(group.platformGroup as Platform));

  if (incomplete.length === 0) {
    return {
      activePlatform: null,
      completedPlatforms: completed,
      remainingPlatforms: [],
      nextPlatform: null,
    };
  }

  const waitingPlatforms = new Set(
    buildInvitePlatformChecklist({ platforms, completedPlatforms, unresolvedProducts })
      .filter((entry) => entry.status === 'waiting-on-agency')
      .map((entry) => entry.platform)
  );
  const actionable = incomplete.filter(
    (group) => !waitingPlatforms.has(group.platformGroup as Platform)
  );

  if (actionable.length === 0) {
    return {
      activePlatform: null,
      completedPlatforms: completed,
      remainingPlatforms: [],
      nextPlatform: null,
    };
  }

  const activePlatform =
    actionable.find((group) => group.platformGroup === returningPlatform) || actionable[0];

  const remainingPlatforms = actionable.filter(
    (group) => group.platformGroup !== activePlatform.platformGroup
  );

  return {
    activePlatform,
    completedPlatforms: completed,
    remainingPlatforms,
    nextPlatform: remainingPlatforms[0] || null,
  };
}
