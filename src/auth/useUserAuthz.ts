import { useEffect, useMemo, useState } from 'react';
import { readOptionalEnv, isE2eMsalMockEnabled, shouldSkipLogin } from '@/lib/env';
import { getRuntimeEnv as getRuntimeEnvRoot } from '@/env';
import { fetchMyGroupIds } from '@/features/schedules/data/graphAdapter';
import { useAuth } from '@/auth/useAuth';
import { GRAPH_RESOURCE } from '@/auth/msalConfig';

type UserAuthz = {
  isReception: boolean;
  isAdmin: boolean;
  ready: boolean;
  reason?: 'missing-admin-group-id' | 'demo-default-full-access';
};

const MEMBER_OF_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const cacheKeyForUpn = (upn: string): string => `authz.memberOf.v1:${upn.trim().toLowerCase()}`;

type MemberOfCachePayload = {
  ts: number;
  ids: string[];
};

const safeReadMemberOfCache = (upn?: string | null): string[] | null => {
  if (!upn) return null;
  if (typeof window === 'undefined') return null;
  if (!window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKeyForUpn(upn));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MemberOfCachePayload>;
    if (!parsed || typeof parsed.ts !== 'number' || !Array.isArray(parsed.ids)) return null;
    if (Date.now() - parsed.ts > MEMBER_OF_CACHE_TTL_MS) return null;
    return parsed.ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  } catch {
    return null;
  }
};

const safeWriteMemberOfCache = (upn: string, ids: string[]): void => {
  if (!upn) return;
  if (typeof window === 'undefined') return;
  if (!window.sessionStorage) return;
  try {
    const payload: MemberOfCachePayload = { ts: Date.now(), ids };
    window.sessionStorage.setItem(cacheKeyForUpn(upn), JSON.stringify(payload));
  } catch {
    // ignore storage quota / disabled storage
  }
};

export const useUserAuthz = (): UserAuthz => {
  const { acquireToken, account } = useAuth();

  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const receptionGroupId = readOptionalEnv('VITE_RECEPTION_GROUP_ID');
  const adminGroupId = readOptionalEnv('VITE_SCHEDULE_ADMINS_GROUP_ID');

  const myUpnNormalized = useMemo(
    () => (account?.username ?? '').trim().toLowerCase(),
    [account?.username],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // 🟢 E2E / skip-login: bypass Graph entirely to prevent networkGuard failures
        const runtimeEnv = getRuntimeEnvRoot();
        if (isE2eMsalMockEnabled(runtimeEnv) || shouldSkipLogin(runtimeEnv)) {
          if (!cancelled) {
            // In E2E mode, grant admin access for comprehensive test coverage
            setGroupIds([adminGroupId || 'demo-admin-group-id']);
            setError(null);      // Clear any previous errors
          }
          return;
        }

        // 1) sessionStorage cache (per-user, 10min TTL)
        const cached = safeReadMemberOfCache(myUpnNormalized);
        if (cached) {
          if (!cancelled) {
            // Prevent infinite setState: only update if value changed
            setGroupIds(prev => {
              const same = prev && prev.length === cached.length && prev.every((id, i) => id === cached[i]);
              return same ? prev : cached;
            });
          }
          return;
        }

        // 2) fetch from Graph
        const ids = await fetchMyGroupIds(() => acquireToken(GRAPH_RESOURCE));
        if (!cancelled) {
          // Prevent infinite setState: only update if value changed
          setGroupIds(prev => {
            const same = prev && prev.length === ids.length && prev.every((id, i) => id === ids[i]);
            return same ? prev : ids;
          });
          // 3) write cache only on success
          if (myUpnNormalized) {
            safeWriteMemberOfCache(myUpnNormalized, ids);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [acquireToken, myUpnNormalized, adminGroupId]);

  const value = useMemo(() => {
    const ids = groupIds ?? [];
    const isDemoOrDev = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === '1';
    
    // Fail-closed for admin group: if not configured in PROD, deny access
    if (!adminGroupId && !isDemoOrDev) {
      console.warn('[useUserAuthz] CRITICAL: Admin group ID is not configured in PROD mode. All users will be denied admin access.');
      return {
        isReception: false,
        isAdmin: false,
        ready: true,
        reason: 'missing-admin-group-id',
      } satisfies UserAuthz;
    }

    // DEMO-only: grant full access if group ID is not set (convenience mode)
    if (!adminGroupId && isDemoOrDev) {
      return {
        isReception: true,
        isAdmin: true,
        ready: true,
        reason: 'demo-default-full-access',
      } satisfies UserAuthz;
    }

    const hasGroupConfig = Boolean(receptionGroupId) || Boolean(adminGroupId);

    // Default-open policy: if no group IDs are configured, do not block edit flows.
    const isReception = hasGroupConfig ? Boolean(receptionGroupId && ids.includes(receptionGroupId)) : true;
    const isAdmin = hasGroupConfig ? Boolean(adminGroupId && ids.includes(adminGroupId)) : true;
    const ready = hasGroupConfig ? groupIds !== null : true;

    return { isReception, isAdmin, ready } satisfies UserAuthz;
  }, [groupIds, receptionGroupId, adminGroupId]);

  if (error) {
    // 権限判定が落ちてもアプリを壊さない（read-only にフォールバック）
    return { isReception: false, isAdmin: false, ready: true };
  }

  return value;
};
