import { InteractionStatus } from '@/auth/interactionStatus';
import { useMsalContext } from '@/auth/MsalProvider';
import { useAuth } from '@/auth/useAuth';
import { useFeatureFlags, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { authDiagnostics } from '@/features/auth/diagnostics/collector';
import { getSchedulesListTitle } from '@/features/schedules/data/spSchema';
import { createAuthCorrId, summarizeAuthBlockReason, type AuthDiagSummary } from '@/lib/authDiag';
import { getAppConfig } from '@/lib/env';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Navigate, useLocation, type NavigateProps } from 'react-router-dom';
import { AuthDiagnosticsPanel, AuthRedirectingNotice, AuthRequiredNotice } from './AuthNotices';

export type ProtectedRouteProps = {
  flag?: keyof FeatureFlagSnapshot;
  children: ReactElement;
  fallbackPath?: NavigateProps['to'];
};

type ListGate = 'idle' | 'checking' | 'ready' | 'blocked';

/**
 * Development-only debug logging to avoid production noise
 */
const debug = (...args: unknown[]) => {
  if (getAppConfig().isDev) {
    // eslint-disable-next-line no-console
    console.log('[ProtectedRoute]', ...args);
  }
};

import { getAuthGuardState } from '@/lib/auth/guardResolution';

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
  const flags = useFeatureFlags();
  const enabled = flag ? flags[flag] : true;
  const { isAuthenticated, loading, shouldSkipLogin, tokenReady: tokenReadyRaw, signIn, getListReadyState: _getListReadyState, setListReadyState, acquireToken } = useAuth();
  const tokenReady = tokenReadyRaw ?? false;
  const { accounts, inProgress, instance, authReady } = useMsalContext();
  const location = useLocation();
  const pendingPath = useMemo(() => `${location.pathname}${location.search ?? ''}`, [location.pathname, location.search]);
  const signInAttemptedRef = useRef(false);
  const [listGate, setListGate] = useState<ListGate>('idle');
  const [forceReauth, setForceReauth] = useState(false);

  useEffect(() => {
    const handleReauth = () => {
      debug('msal-interaction-required event caught. Forcing AuthRequiredNotice.');
      setForceReauth(true);
    };
    window.addEventListener('msal-interaction-required', handleReauth);
    return () => window.removeEventListener('msal-interaction-required', handleReauth);
  }, []);

  const isMsalInProgress = inProgress !== InteractionStatus.None && inProgress !== 'none';
  const corrIdRef = useRef<string | null>(null);
  const lastDiagCodeRef = useRef<AuthDiagSummary['code'] | null>(null);
  if (!corrIdRef.current) {
    corrIdRef.current = createAuthCorrId('AUTH');
  }
  const corrId = corrIdRef.current;

  const logAuthDiag = (summary: AuthDiagSummary) => {
    if (lastDiagCodeRef.current === summary.code) return;
    lastDiagCodeRef.current = summary.code;
    console.info('[auth]', {
      code: summary.code,
      inProgress,
      route: pendingPath,
      corrId,
      detail: summary.detail,
    });
  };

  const guardState = getAuthGuardState();
  const allowBypass = guardState.shouldBypass;

  // Log bypass reason in DEV mode for visibility
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[auth-guard]', guardState);
    }
  }, [guardState.shouldBypass, guardState.reason]);

  // ① Auto-stop patch: Remove auto sign-in from useEffect
  // Sign-in is now button-click only (moved to AuthRequiredNotice/AuthRedirectingNotice handlers)
  // This prevents automatic popup loops on route load or state changes
  useEffect(() => {
    // Just reset the flag when user accounts change (for fresh attempts on next user interaction)
    if (accounts.length > 0) {
      signInAttemptedRef.current = false;
    }
  }, [accounts.length]);

  // List existence check: trigger when tokenReady + schedules flag
  const listCheckRetryRef = useRef(0);
  useEffect(() => {
    if (isMsalInProgress) return;
    if (!tokenReady) return;
    if (flag !== 'schedules') return;
    if (listGate !== 'idle') return;

    setListGate('checking');

    const LIST_CHECK_TIMEOUT_MS = 15_000;
    const MAX_RETRIES = 2;
    let cancelled = false;

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`List check timed out after ${ms}ms`)), ms),
        ),
      ]);

    const checkSchedulesListExistence = async () => {
      try {
        const spConfig = ensureConfig();
        const baseUrl = spConfig.baseUrl;
        if (!baseUrl) {
          debug('[schedules] No baseUrl (demo mode), skipping list check');
          if (!cancelled) setListGate('ready');
          return;
        }

        const listName = getSchedulesListTitle();
        // eslint-disable-next-line no-console
        console.log('[env-check] schedules list title =', listName);
        debug(`[schedules] Checking list existence: ${listName}`);

        const client = createSpClient(acquireToken, baseUrl);
        const metadata = await withTimeout(
          client.tryGetListMetadata(listName),
          LIST_CHECK_TIMEOUT_MS,
        );

        if (cancelled) return;

        if (metadata) {
          debug('[schedules] List exists:', listName);
          setListReadyState(true);
          setListGate('ready');
        } else {
          debug('[schedules] List NOT found:', listName);
          setListReadyState(false);
          setListGate('blocked');
        }
      } catch (error) {
        if (cancelled) return;
        const isTimeout = error instanceof Error && error.message.includes('timed out');
        const attempt = listCheckRetryRef.current;
        console.error(`[ProtectedRoute] List existence check failed (attempt ${attempt + 1}):`, error);

        if (isTimeout && attempt < MAX_RETRIES) {
          // Retry: reset to idle so the effect re-fires
          listCheckRetryRef.current = attempt + 1;
          debug(`[schedules] Retrying list check (attempt ${attempt + 2}/${MAX_RETRIES + 1})`);
          setListGate('idle');
          return;
        }

        if (isTimeout) {
          // All retries exhausted on timeout — fall through optimistically
          // The actual data hooks will handle 404 gracefully
          console.warn('[ProtectedRoute] List check timed out after all retries; proceeding optimistically');
          setListReadyState(true);
          setListGate('ready');
        } else {
          setListReadyState(false);
          setListGate('blocked');
        }
      }
    };

    void checkSchedulesListExistence();
    return () => { cancelled = true; };
  }, [isMsalInProgress, tokenReady, flag, listGate, acquireToken, setListReadyState]);

  // Collect diagnostics when the blocking reason changes
  // This must be in useEffect to avoid render-phase setState warnings
  useEffect(() => {
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate: flag === 'schedules' ? listGate : undefined,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });

    // Only collect if the reason has changed
    if (lastDiagCodeRef.current !== summary.code) {
      lastDiagCodeRef.current = summary.code;
      authDiagnostics.collect({
        route: pendingPath ?? '',
        reason: summary.code,
        outcome: 'blocked',
        correlationId: corrId,
        detail: summary.detail,
      });
    }
  }, [inProgress, isAuthenticated, loading, tokenReady, listGate, enabled, accounts.length, pendingPath, corrId, flag]);

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
  if (flag && isE2E && shouldBypassInE2E(flag)) {
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

  if (!authReady) {
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate: flag === 'schedules' ? listGate : undefined,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });
    logAuthDiag(summary);
    debug('MSAL redirect handling not ready; waiting before auth prompt');
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          サインイン処理中です…
        </Typography>
        <AuthDiagnosticsPanel summary={summary} corrId={corrId} />
      </div>
    );
  }

  if (isMsalInProgress) {
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate: flag === 'schedules' ? listGate : undefined,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });
    logAuthDiag(summary);
    debug('MSAL interaction in progress for flag:', flag, 'status:', inProgress);
    return (
      <AuthRedirectingNotice
        flag={flag}
        pendingPath={pendingPath}
        fallbackPath={fallbackPath}
        onSignIn={signIn}
        diagSummary={summary}
        corrId={corrId}
        msalInstance={instance}
      />
    );
  }

  if (loading) {
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate: flag === 'schedules' ? listGate : undefined,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });
    logAuthDiag(summary);
    debug('Auth still loading for flag:', flag);
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          認証情報を確認しています…
        </Typography>
        <AuthDiagnosticsPanel summary={summary} corrId={corrId} />
      </div>
    );
  }

  if (!isAuthenticated || forceReauth) {
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate: flag === 'schedules' ? listGate : undefined,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });
    logAuthDiag(summary);
    debug('User not authenticated for flag:', flag, '- prompting sign-in');
    return (
      <AuthRequiredNotice
        flag={flag}
        onSignIn={signIn}
        fallbackPath={fallbackPath}
        pendingPath={pendingPath}
        diagSummary={summary}
        corrId={corrId}
        msalInstance={instance}
      />
    );
  }

  // Gate: Ensure SharePoint token is ready before rendering children
  // This prevents API calls from auto-triggering MSAL popups
  if (!tokenReady) {
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate: flag === 'schedules' ? listGate : undefined,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });
    logAuthDiag(summary);
    debug('Token acquisition in progress; waiting for completion for flag:', flag);
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          アクセス権限を確認しています…
        </Typography>
        <AuthDiagnosticsPanel summary={summary} corrId={corrId} />
      </div>
    );
  }

  // Gate: Ensure list exists before rendering children (prevents 404 cascade)
  // For schedules flag, listGate must be 'ready' before allowing children
  if (flag === 'schedules' && listGate !== 'ready') {
    if (listGate === 'blocked') {
      const summary = summarizeAuthBlockReason({
        inProgress,
        isAuthenticated,
        loading,
        tokenReady,
        listGate,
        enabled,
        accounts: accounts.length,
        route: pendingPath,
      });
      logAuthDiag(summary);
      debug('List check failed (404/error) for flag:', flag);
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            スケジュール用の SharePoint リストが見つかりません
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>
            管理者に連絡してください
          </Typography>
          <AuthDiagnosticsPanel summary={summary} corrId={corrId} />
        </div>
      );
    }
    // idle or checking
    const summary = summarizeAuthBlockReason({
      inProgress,
      isAuthenticated,
      loading,
      tokenReady,
      listGate,
      enabled,
      accounts: accounts.length,
      route: pendingPath,
    });
    logAuthDiag(summary);
    debug('List existence check in progress for flag:', flag);
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          スケジュール用リストを確認しています…
        </Typography>
        <AuthDiagnosticsPanel summary={summary} corrId={corrId} />
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
