
export type PendingOrderPolicy = 'userId';

export function getPendingUserOrder(args: {
  users: Array<{ UserID: string | number }>;
  pendingUserIds: string[];
  policy: PendingOrderPolicy;
}): string[] {
  const { pendingUserIds, policy } = args;

  if (policy === 'userId') {
    // Current behavior: stable string sorting
    return [...pendingUserIds].sort();
  }

  // Fallback to basic sort if policy is unknown
  return [...pendingUserIds].sort();
}
