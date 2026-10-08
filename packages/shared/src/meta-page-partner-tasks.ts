const PROFILE_PLUS_PREFIX = 'PROFILE_PLUS_';

/** Normalize Meta Page agency `permitted_tasks` names for comparison (PROFILE_PLUS_X ↔ X). */
export function normalizeMetaPagePartnerTaskName(task: string): string {
  const trimmed = task.trim();
  if (trimmed.startsWith(PROFILE_PLUS_PREFIX)) {
    return trimmed.slice(PROFILE_PLUS_PREFIX.length);
  }
  return trimmed;
}

/** True when every required Page partner task is present in assigned tasks after normalization. */
export function metaPagePartnerPermittedTasksSatisfyRequired(
  assignedPermittedTasks: readonly string[],
  requiredTasks: readonly string[]
): boolean {
  const normalizedAssigned = new Set(
    assignedPermittedTasks.map((task) => normalizeMetaPagePartnerTaskName(task))
  );
  return requiredTasks.every((task) =>
    normalizedAssigned.has(normalizeMetaPagePartnerTaskName(task))
  );
}
