/**
 * Determine the next pending user to navigate to after saving a record.
 *
 * Design rationale (Issue #628):
 * - If currentUserId is in pendingUserIds, return the next one in the list.
 * - If currentUserId is NOT in pendingUserIds (e.g. concurrent staff editing),
 *   fail-safe to the first pending user.
 * - If no pending users remain, return undefined (signals end-of-queue).
 *
 * This is a pure function extracted from TodayOpsPage's handleSaveSuccess
 * to enable deterministic unit testing without React lifecycle mocking.
 */
export function resolveNextUser(
  currentUserId: string | null,
  pendingUserIds: string[],
): string | undefined {
  if (pendingUserIds.length === 0) {
    return undefined;
  }

  if (!currentUserId) {
    return pendingUserIds[0];
  }

  const idx = pendingUserIds.indexOf(currentUserId);

  // Current user found → return next in queue
  if (idx >= 0 && idx + 1 < pendingUserIds.length) {
    return pendingUserIds[idx + 1];
  }

  // Current user is last in queue → end-of-queue
  if (idx >= 0 && idx + 1 >= pendingUserIds.length) {
    return undefined;
  }

  // Current user not in pending list (concurrent edit) → fail-safe to first
  return pendingUserIds[0];
}
