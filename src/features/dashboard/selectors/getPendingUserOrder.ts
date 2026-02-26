
export type PendingOrderPolicy = 'userId' | 'attendanceToday';

export function getPendingUserOrder(args: {
  users: Array<{ UserID: string | number }>;
  pendingUserIds: string[];
  policy: PendingOrderPolicy;
  attendanceOrderUserIds?: string[];
}): string[] {
  const { pendingUserIds, policy, attendanceOrderUserIds } = args;

  if (policy !== 'attendanceToday' || !attendanceOrderUserIds?.length) {
    // Current behavior: stable string sorting
    return [...pendingUserIds].sort();
  }

  const pendingSet = new Set(pendingUserIds);

  const orderedFromAttendance = attendanceOrderUserIds.filter(id => pendingSet.has(id));
  const orderedSet = new Set(orderedFromAttendance);

  const leftovers = pendingUserIds
    .filter(id => !orderedSet.has(id))
    .sort();

  return [...orderedFromAttendance, ...leftovers];
}
