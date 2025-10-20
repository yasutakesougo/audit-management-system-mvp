import { type ReactElement, useEffect } from 'react';
import { Navigate, type NavigateProps } from 'react-router-dom';
import { readBool } from '@/lib/env';
import { useToast } from '@/hooks/useToast';

export type RoleRouteProps = {
  required: readonly string[];
  children: ReactElement;
  fallbackPath?: NavigateProps['to'];
};

function getCurrentRole(): string | undefined {
  try {
    const stored = window.localStorage.getItem('role');
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // ignore
  }
  const anyWin = typeof window !== 'undefined' ? (window as unknown as { __ROLE__?: string }) : undefined;
  if (anyWin?.__ROLE__) return anyWin.__ROLE__;
  return undefined;
}

export default function RoleRoute({ required, children, fallbackPath = '/' }: RoleRouteProps) {
  const { show } = useToast();
  const rbacEnabled = readBool('VITE_FEATURE_RBAC', false);

  if (!rbacEnabled) {
    return children;
  }

  const role = getCurrentRole();
  const ok = role ? required.includes(role) : false;

  useEffect(() => {
    if (!ok) {
      show('warning', 'アクセス権限がありません。管理者にお問い合わせください。');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  if (ok) {
    return children;
  }
  return <Navigate to={fallbackPath} replace />;
}

