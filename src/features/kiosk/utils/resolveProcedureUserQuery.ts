import type { IUserMaster } from '@/sharepoint/fields';

/**
 * Consolidate the user query ID candidates to resolve procedures.
 * Ensures consistent inputs for `procedureRepo.getByUser()` on both the
 * List view and Detail view.
 * 
 * Under standard business logic:
 * 1. Prefer the canonical `UserID` (e.g. "U-006") from the loaded User Master record.
 * 2. Fall back to the raw `routeUserId` (e.g. "7" or "23").
 * 3. Never let transient numeric IDs mismatch when the master database maps them
 *    to completely distinct records (e.g. U-023 Fujita vs U-006 Nakamura).
 */
export function resolveProcedureUserQueryCandidates(
  user: IUserMaster | null,
  routeUserId: string | undefined,
  queryUserIdFromSearch?: string | null
): string {
  // If search query override is provided, respect it.
  if (queryUserIdFromSearch?.trim()) {
    return queryUserIdFromSearch.trim();
  }

  // Prefer canonical UserID (e.g., U-006)
  const canonical = String(user?.UserID ?? '').trim();
  if (canonical) {
    return canonical;
  }

  // Fall back to raw route identifier (e.g., "7")
  return String(routeUserId ?? '').trim();
}
