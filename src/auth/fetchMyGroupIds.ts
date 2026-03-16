/**
 * Fetch the list of group IDs the current user is a member of.
 * Used for authorization checks (reception, admin roles).
 *
 * Moved from features/schedules/data/graphAdapter.ts to auth/
 * because this is an authorization concern, not a schedules concern.
 *
 * Refactored to use graphFetch client (Phase 2).
 */

import { createGraphClient, type GetToken } from '@/lib/graph/graphFetch';

type GroupEntry = { id?: string };

export const fetchMyGroupIds = async (getToken: GetToken): Promise<string[]> => {
  // トークンが取得できない場合は未認証 — 空配列で返す（旧実装互換）
  const token = await getToken();
  if (!token) return [];

  const client = createGraphClient(async () => token);

  const endpoints = [
    '/me/transitiveMemberOf?$select=id',
    '/me/memberOf?$select=id',
  ];

  for (const endpoint of endpoints) {
    try {
      const entries = await client.fetchAllPages<GroupEntry>(endpoint);
      return entries
        .map((v) => v.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch (error) {
      if (endpoint === endpoints[endpoints.length - 1]) {
        throw error;
      }
    }
  }

  return [];
};
