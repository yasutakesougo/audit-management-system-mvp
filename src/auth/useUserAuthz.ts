import { useEffect, useMemo, useState } from 'react';
import { readOptionalEnv } from '@/lib/env';
import { fetchMyGroupIds } from '@/features/schedules/data/graphAdapter';
import { useAuth } from '@/auth/useAuth';
import { GRAPH_RESOURCE } from '@/auth/msalConfig';

type UserAuthz = {
  isReception: boolean;
  isAdmin: boolean;
  ready: boolean;
};

export const useUserAuthz = (): UserAuthz => {
  const { acquireToken } = useAuth();

  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const receptionGroupId = readOptionalEnv('VITE_RECEPTION_GROUP_ID');
  const adminGroupId = readOptionalEnv('VITE_SCHEDULE_ADMINS_GROUP_ID');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const ids = await fetchMyGroupIds(() => acquireToken(GRAPH_RESOURCE));
        if (!cancelled) setGroupIds(ids);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [acquireToken]);

  const value = useMemo(() => {
    const ids = groupIds ?? [];
    return {
      isReception: Boolean(receptionGroupId && ids.includes(receptionGroupId)),
      isAdmin: Boolean(adminGroupId && ids.includes(adminGroupId)),
      ready: groupIds !== null,
    };
  }, [groupIds, receptionGroupId, adminGroupId]);

  if (error) {
    // 権限判定が落ちてもアプリを壊さない（read-only にフォールバック）
    return { isReception: false, isAdmin: false, ready: true };
  }

  return value;
};
