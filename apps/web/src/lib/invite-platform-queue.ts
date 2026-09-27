import type { ClientAccessRequestPlatformGroup, Platform } from '@agency-platform/shared';

interface BuildInvitePlatformQueueOptions {
  platforms: ClientAccessRequestPlatformGroup[];
  completedPlatforms: ReadonlySet<Platform>;
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

  const activePlatform =
    incomplete.find((group) => group.platformGroup === returningPlatform) || incomplete[0];

  const remainingPlatforms = incomplete.filter(
    (group) => group.platformGroup !== activePlatform.platformGroup
  );

  return {
    activePlatform,
    completedPlatforms: completed,
    remainingPlatforms,
    nextPlatform: remainingPlatforms[0] || null,
  };
}
