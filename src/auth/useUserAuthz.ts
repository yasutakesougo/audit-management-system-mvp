import { fetchMyGroupIds } from '@/auth/fetchMyGroupIds';
import { GRAPH_RESOURCE } from '@/auth/msalConfig';
import type { Role } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import { useAuthReady } from '@/auth/useAuthReady';
import { getRuntimeEnv as getRuntimeEnvRoot } from '@/env';
import { type EnvRecord, isE2eMsalMockEnabled, readOptionalEnv, shouldSkipLogin } from '@/lib/env';
import { useEffect, useMemo, useState } from 'react';

type UserAuthz = {
  role: Role;
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

const extractGroupIdsFromAccountClaims = (account: unknown): string[] => {
  if (!account || typeof account !== 'object') return [];
  const candidate = account as { idTokenClaims?: unknown };
  const claims = candidate.idTokenClaims;
  if (!claims || typeof claims !== 'object') return [];
  const groupValues = (claims as { groups?: unknown }).groups;
  if (!Array.isArray(groupValues)) return [];
  return groupValues
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
};

export const useUserAuthz = (): UserAuthz => {
  const isAuthReady = useAuthReady();
  const { acquireToken, account } = useAuth();

  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const runtimeEnv = getRuntimeEnvRoot() as Record<string, unknown>;
  const readRuntime = (key: string): string | undefined => {
    const value = runtimeEnv[key];
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  };

  const readAny = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const runtimeValue = readRuntime(key);
      if (runtimeValue) return runtimeValue;

      const fallbackValue = readOptionalEnv(key);
      if (fallbackValue && fallbackValue.trim().length > 0) {
        return fallbackValue.trim();
      }
    }
    return undefined;
  };

  const receptionGroupId =
    // Prefer runtime rollout keys first to avoid stale build-time AAD values.
    readAny('VITE_RECEPTION_GROUP_ID', 'VITE_AAD_RECEPTION_GROUP_ID');

  const adminGroupId =
    // Prefer runtime rollout keys first to avoid stale build-time AAD values.
    readAny('VITE_ADMIN_GROUP_ID', 'VITE_SCHEDULE_ADMINS_GROUP_ID', 'VITE_AAD_ADMIN_GROUP_ID');
  const envReady =
    typeof window === 'undefined'
      ? true
      : Boolean((window as typeof window & { __ENV__?: unknown }).__ENV__);
  const testRoleRaw = readRuntime('VITE_TEST_ROLE') ?? readOptionalEnv('VITE_TEST_ROLE');
  const testRole =
    testRoleRaw === 'admin' || testRoleRaw === 'reception' || testRoleRaw === 'viewer'
      ? testRoleRaw
      : undefined;

  const myUpnNormalized = useMemo(
    () => (account?.username ?? '').trim().toLowerCase(),
    [account?.username],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // 🛑 認証情報が準備できていない場合は何もしない
      if (!isAuthReady || !account) {
        return;
      }
      try {
        // 🟢 E2E / skip-login: bypass Graph entirely to prevent networkGuard failures
        const runtimeEnv = getRuntimeEnvRoot();
        if (isE2eMsalMockEnabled(runtimeEnv) || shouldSkipLogin(runtimeEnv)) {
          if (!cancelled) {
            // In E2E mode, grant admin access for comprehensive test coverage
            const demoIds = [adminGroupId || 'demo-admin-group-id'];
            setGroupIds(prev => {
              const same = prev && prev.length === demoIds.length && prev.every((id, i) => id === demoIds[i]);
              return same ? prev : demoIds;
            });
            setError(prev => prev === null ? prev : null);
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
        if (!cancelled) {
          // Graph group lookup can fail due tenant consent/policy.
          // Fall back to idToken group claims when available to avoid false viewer downgrade.
          const claimIds = extractGroupIdsFromAccountClaims(account);
          if (claimIds.length > 0) {
            setGroupIds(prev => {
              const same = prev && prev.length === claimIds.length && prev.every((id, i) => id === claimIds[i]);
              return same ? prev : claimIds;
            });
            setError(prev => prev === null ? prev : null);
          } else {
            setError(e as Error);
          }
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, account?.homeAccountId, acquireToken, myUpnNormalized, adminGroupId]);

  const value = useMemo(() => {
    const ids = groupIds ?? [];
    const runtime = getRuntimeEnvRoot() as EnvRecord;
    const isDemoOrDev = import.meta.env.DEV || runtime.VITE_DEMO_MODE === '1' || runtime.VITE_DEMO === '1';
    const isE2E = runtime.VITE_E2E === '1';
    const skipLogin = shouldSkipLogin(runtime);

    // E2E: always grant admin access for test coverage (all nav items visible)
    if ((isE2E || skipLogin) && testRole) {
      return {
        role: testRole,
        ready: true,
      } satisfies UserAuthz;
    }

    if (isE2E || skipLogin) {
      return {
        role: 'admin',
        ready: true,
        reason: 'demo-default-full-access',
      } satisfies UserAuthz;
    }

    // Fail-closed for admin group: if not configured in PROD, deny access
    if (!envReady && !isDemoOrDev) {
      return {
        role: 'viewer',
        ready: false,
      } satisfies UserAuthz;
    }

    if (!adminGroupId && !isDemoOrDev) {
      console.warn('[useUserAuthz] CRITICAL: Admin group ID is not configured in PROD mode. All users will be denied admin access.');
      return {
        role: 'viewer',
        ready: true,
        reason: 'missing-admin-group-id',
      } satisfies UserAuthz;
    }

    // DEMO-only: grant full access if group ID is not set (convenience mode)
    if (!adminGroupId && isDemoOrDev) {
      return {
        role: 'admin',
        ready: true,
        reason: 'demo-default-full-access',
      } satisfies UserAuthz;
    }

    const hasGroupConfig = Boolean(receptionGroupId) || Boolean(adminGroupId);

    // Role resolution order is strict: admin > reception > viewer.
    // If membership cannot be resolved, fall back to viewer (handled by ready/error paths).
    const isReception = hasGroupConfig ? Boolean(receptionGroupId && ids.includes(receptionGroupId)) : true;
    const isAdmin = hasGroupConfig ? Boolean(adminGroupId && ids.includes(adminGroupId)) : true;
    const ready = hasGroupConfig ? groupIds !== null : true;

    const role: Role = isAdmin ? 'admin' : isReception ? 'reception' : 'viewer';

    return { role, ready } satisfies UserAuthz;
  }, [groupIds, receptionGroupId, adminGroupId, envReady, testRole]);

  if (error) {
    // 権限判定が落ちてもアプリを壊さない（read-only にフォールバック）
    return { role: 'viewer', ready: true };
  }

  return value;
};
