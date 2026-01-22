import { useAuth } from '@/auth/useAuth';
import { useFeatureFlag, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { getAppConfig, isDemoModeEnabled, readEnv } from '@/lib/env';
import { InteractionStatus } from '@/auth/interactionStatus';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, type NavigateProps, useLocation } from 'react-router-dom';
import { useMsalContext } from '@/auth/MsalProvider';

export type ProtectedRouteProps = {
  flag: keyof FeatureFlagSnapshot;
  children: ReactElement;
  fallbackPath?: NavigateProps['to'];
};

/**
 * Development-only debug logging to avoid production noise
 */
const debug = (...args: unknown[]) => {
  if (getAppConfig().isDev) {
    // eslint-disable-next-line no-console
    console.log('[ProtectedRoute]', ...args);
  }
};

const isAutomationRuntime = (): boolean => {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  if (typeof window !== 'undefined') {
    const automationHints = window as Window & { __PLAYWRIGHT__?: unknown; Cypress?: unknown };
    if (automationHints.__PLAYWRIGHT__ || automationHints.Cypress) return true;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITEST === '1' || process.env.PLAYWRIGHT_TEST === '1') return true;
  }
  return false;
};

const isSkipLoginEnabled = (): boolean => readEnv('VITE_SKIP_LOGIN', '0') === '1';

const isMsalConfigured = (): boolean => {
  const clientId = readEnv('VITE_MSAL_CLIENT_ID', readEnv('VITE_AAD_CLIENT_ID', '')).trim();
  const tenantId = readEnv('VITE_MSAL_TENANT_ID', readEnv('VITE_AAD_TENANT_ID', '')).trim();
  if (!clientId || !tenantId) return false;
  if (clientId.toLowerCase().includes('dummy')) return false;
  if (tenantId.toLowerCase().includes('dummy')) return false;
  return true;
};

/**
 * Determine if a feature flag should be bypassed in E2E environment.
 * Critical flags that need E2E testing should return false.
 */
const shouldBypassInE2E = (flag: keyof FeatureFlagSnapshot): boolean => {
  // These flags require proper E2E testing of access control
  const criticalFlags: (keyof FeatureFlagSnapshot)[] = [
    // 'schedules', // Uncomment if schedule access control needs E2E testing
    // 'schedulesCreate', // Uncomment if creation control needs E2E testing
  ];

  return !criticalFlags.includes(flag);
};

export default function ProtectedRoute({ flag, children, fallbackPath = '/' }: ProtectedRouteProps) {
  const enabled = useFeatureFlag(flag);
  const { isAuthenticated, loading, shouldSkipLogin, tokenReady, signIn } = useAuth();
  const { accounts, inProgress } = useMsalContext();
  const location = useLocation();
  const pendingPath = useMemo(() => `${location.pathname}${location.search ?? ''}`, [location.pathname, location.search]);
  const signInAttemptedRef = useRef(false);

  const isAutomationOrDemo = isAutomationRuntime() || isDemoModeEnabled();
  const allowBypass = isAutomationOrDemo || isSkipLoginEnabled() || !isMsalConfigured();

  // One-shot auto sign-in to avoid interaction_in_progress from multiple triggers
  useEffect(() => {
    if (allowBypass) return;
    if (accounts.length > 0) {
      signInAttemptedRef.current = false;
      return;
    }
    if (inProgress !== InteractionStatus.None && inProgress !== 'none') return;
    if (signInAttemptedRef.current) return;
    signInAttemptedRef.current = true;
    void signIn();
  }, [accounts.length, allowBypass, inProgress, signIn]);

  // Automation / Demo / Skip-login / 未設定MSALでは認証ガードをバイパス（フラグは尊重）
  if (allowBypass) {
    if (!enabled) {
      debug('Bypass blocked: feature disabled for flag:', flag, '- redirecting to', fallbackPath);
      return <Navigate to={fallbackPath} replace />;
    }
    debug('Bypass enabled (automation/demo/skip-login/msal-missing) for flag:', flag);
    return children;
  }

  // E2E環境では、重要でないフラグは bypass して画面テストを優先
  if (isE2E && shouldBypassInE2E(flag)) {
    debug('E2E bypass enabled for flag:', flag);
    return children;
  }

  if (shouldSkipLogin) {
    if (!enabled) {
      debug('Skip-login active but feature disabled for flag:', flag, '- redirecting to', fallbackPath);
      return <Navigate to={fallbackPath} replace />;
    }
    debug('Skip-login active; bypassing auth for flag:', flag);
    return children;
  }

  if (!enabled) {
    debug('Access denied for flag:', flag, '- redirecting to', fallbackPath);
    return <Navigate to={fallbackPath} replace />;
  }

  if (loading) {
    debug('Auth still loading for flag:', flag);
    return <div style={{ padding: '2rem', textAlign: 'center' }}>認証情報を確認しています…</div>;
  }

  if (!isAuthenticated) {
    debug('User not authenticated for flag:', flag, '- prompting sign-in');
    return (
      <AuthRequiredNotice
        flag={flag}
        onSignIn={signIn}
        fallbackPath={fallbackPath}
        pendingPath={pendingPath}
      />
    );
  }

  // Gate: Ensure SharePoint token is ready before rendering children
  // This prevents API calls from auto-triggering MSAL popups
  if (!tokenReady) {
    debug('Token acquisition in progress; waiting for completion for flag:', flag);
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        アクセス権限を確認しています…
      </div>
    );
  }

  // Gate: Ensure list exists before rendering children (prevents 404 cascade)
  const { getListReadyState } = useAuth();
  const listReady = getListReadyState();
  if (listReady === false) {
    debug('List check failed (404/error) for flag:', flag);
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          スケジュール用の SharePoint リストが見つかりません
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>
          管理者に連絡してください
        </Typography>
      </div>
    );
  }
  if (listReady === null && flag === 'schedules') {
    debug('List existence check in progress for flag:', flag);
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        スケジュール用リストを確認しています…
      </div>
    );
  }

  if (typeof window !== 'undefined') {
    const postLoginTarget = window.sessionStorage.getItem('postLoginRedirect');
    if (postLoginTarget) {
      window.sessionStorage.removeItem('postLoginRedirect');
      if (postLoginTarget !== pendingPath) {
        debug('Redirecting to stored post-login path:', postLoginTarget);
        return <Navigate to={postLoginTarget} replace />;
      }
    }
  }

  debug('Access granted for flag:', flag);
  return children;
}

type AuthNoticeProps = {
  flag: keyof FeatureFlagSnapshot;
  pendingPath: string;
  fallbackPath: NavigateProps['to'];
  onSignIn?: () => Promise<{ success: boolean }>;
};

const AuthRequiredNotice = ({ flag, pendingPath, onSignIn, fallbackPath }: AuthNoticeProps) => {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!onSignIn) {
      debug('Sign-in handler missing; redirecting to fallback for flag:', flag);
      if (typeof window !== 'undefined') {
        window.location.assign(typeof fallbackPath === 'string' ? fallbackPath : '/');
      }
      return;
    }
    try {
      setSigningIn(true);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('postLoginRedirect', pendingPath);
      }
      await onSignIn();
    } catch (error) {
      console.error('[ProtectedRoute] sign-in failed', error);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 1rem' }}>
      <Paper elevation={1} sx={{ maxWidth: 480, width: '100%', padding: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography component="h1" variant="h6" fontWeight={700} textAlign="center">
            スケジュールを表示するには、サインインが必要です。
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Microsoft アカウントでサインインすると、スケジュール画面（/schedules/week）に自動的に戻ります。
          </Typography>
          <Button
            variant="contained"
            onClick={handleSignIn}
            disabled={signingIn}
            sx={{ minWidth: 180 }}
          >
            {signingIn ? 'サインイン処理中…' : 'サインインする'}
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.assign(typeof fallbackPath === 'string' ? fallbackPath : '/');
              }
            }}
          >
            ホームに戻る
          </Button>
        </Stack>
      </Paper>
    </div>
  );
};
