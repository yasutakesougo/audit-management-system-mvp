
import { normalizeUserId } from '@/lib/normalizeUserId';

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

  // Normalize to canonical form for comparison (e.g. "U-001" → "U001")
  const pendingByNorm = new Map<string, string>();
  for (const id of pendingUserIds) {
    pendingByNorm.set(normalizeUserId(id), id);
  }

  const orderedOriginals: string[] = [];
  const matchedNorms = new Set<string>();

  for (const attId of attendanceOrderUserIds) {
    const norm = normalizeUserId(attId);
    const original = pendingByNorm.get(norm);
    if (original && !matchedNorms.has(norm)) {
      orderedOriginals.push(original);
      matchedNorms.add(norm);
    }
  }

  const leftovers = pendingUserIds
    .filter(id => !matchedNorms.has(normalizeUserId(id)))
    .sort();

  return [...orderedOriginals, ...leftovers];
}
