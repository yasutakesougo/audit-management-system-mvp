import { useAuth } from '@/auth/useAuth';
import { useFeatureFlags, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { getAppConfig, isDemoModeEnabled, readEnv } from '@/lib/env';
import { InteractionStatus } from '@/auth/interactionStatus';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { buildAuthDiagCopyText, createAuthCorrId, summarizeAuthBlockReason, type AuthDiagSummary } from '@/lib/authDiag';
import { authDiagnostics } from '@/features/auth/diagnostics/collector';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, type NavigateProps, useLocation } from 'react-router-dom';
import { useMsalContext } from '@/auth/MsalProvider';

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

const isSkipLoginEnabled = (): boolean => {
  const skipLogin = readEnv('VITE_SKIP_LOGIN', '0') === '1';
  const e2e = readEnv('VITE_E2E', '0') === '1';
  const msalMock = readEnv('VITE_E2E_MSAL_MOCK', '0') === '1';
  return skipLogin || e2e || msalMock;
};

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
  const flags = useFeatureFlags();
  const enabled = flag ? flags[flag] : true;
  const { isAuthenticated, loading, shouldSkipLogin, tokenReady: tokenReadyRaw, signIn, getListReadyState: _getListReadyState, setListReadyState, acquireToken } = useAuth();
  const tokenReady = tokenReadyRaw ?? false;
  const { accounts, inProgress, instance } = useMsalContext();
  const location = useLocation();
  const pendingPath = useMemo(() => `${location.pathname}${location.search ?? ''}`, [location.pathname, location.search]);
  const signInAttemptedRef = useRef(false);
  const [listGate, setListGate] = useState<ListGate>('idle');
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

  const isAutomationOrDemo = isAutomationRuntime() || isDemoModeEnabled();
  const allowBypass = isAutomationOrDemo || isSkipLoginEnabled() || !isMsalConfigured();

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
  useEffect(() => {
    if (isMsalInProgress) return;
    if (!tokenReady) return;
    if (flag !== 'schedules') return;
    if (listGate !== 'idle') return;

    setListGate('checking');

    const checkSchedulesListExistence = async () => {
      try {
        const spConfig = ensureConfig();
        const baseUrl = spConfig.baseUrl;
        if (!baseUrl) {
          debug('[schedules] No baseUrl (demo mode), skipping list check');
          setListGate('ready');
          return;
        }

        const listName = import.meta.env.VITE_SP_LIST_SCHEDULES || 'ScheduleEvents';
        // eslint-disable-next-line no-console
        console.log('[env-check] VITE_SP_LIST_SCHEDULES =', listName);
        debug(`[schedules] Checking list existence: ${listName}`);

        const client = createSpClient(acquireToken, baseUrl);
        const listNameStr = typeof listName === 'string' ? listName : 'ScheduleEvents';
        const metadata = await client.tryGetListMetadata(listNameStr);

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
        console.error('[ProtectedRoute] List existence check failed:', error);
        setListReadyState(false);
        setListGate('blocked');
      }
    };

    void checkSchedulesListExistence();
  }, [isMsalInProgress, tokenReady, flag, listGate, acquireToken, setListReadyState]);

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
    authDiagnostics.collect({
      route: pendingPath ?? '',
      reason: summary.code,
      outcome: 'blocked',
      correlationId: corrId,
      detail: summary.detail,
    });
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
    authDiagnostics.collect({
      route: pendingPath ?? '',
      reason: summary.code,
      outcome: 'blocked',
      correlationId: corrId,
      detail: summary.detail,
    });
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

  if (!isAuthenticated) {
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
    authDiagnostics.collect({
      route: pendingPath ?? '',
      reason: summary.code,
      outcome: 'blocked',
      correlationId: corrId,
      detail: summary.detail,
    });
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
    authDiagnostics.collect({
      route: pendingPath ?? '',
      reason: summary.code,
      outcome: 'blocked',
      correlationId: corrId,
      detail: summary.detail,
    });
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
      authDiagnostics.collect({
        route: pendingPath ?? '',
        reason: summary.code,
        outcome: 'blocked',
        correlationId: corrId,
        detail: summary.detail,
      });
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
    authDiagnostics.collect({
      route: pendingPath ?? '',
      reason: summary.code,
      outcome: 'blocked',
      correlationId: corrId,
      detail: summary.detail,
    });
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

type AuthNoticeProps = {
  flag?: keyof FeatureFlagSnapshot;
  pendingPath: string;
  fallbackPath: NavigateProps['to'];
  onSignIn?: () => Promise<{ success: boolean }>;
  diagSummary?: AuthDiagSummary;
  corrId?: string;
  msalInstance?: { logoutRedirect?: (options?: { postLogoutRedirectUri?: string }) => Promise<void> | void };
};

type AuthDiagnosticsProps = {
  summary: AuthDiagSummary;
  corrId: string;
};

const buildDiagCopyText = (summary: AuthDiagSummary, corrId: string): string => {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return buildAuthDiagCopyText({
    summary,
    corrId,
    url,
    userAgent,
    timestamp: new Date().toISOString(),
  });
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  return success;
};

const clearMsalCache = (): number => {
  if (typeof window === 'undefined') return 0;
  const storages = [window.sessionStorage, window.localStorage];
  const matcher = (key: string) => /^msal/i.test(key);
  let removed = 0;
  storages.forEach((storage) => {
    const keys = Object.keys(storage);
    keys.forEach((key) => {
      if (matcher(key)) {
        storage.removeItem(key);
        removed += 1;
      }
    });
  });
  return removed;
};

const AuthDiagnosticsPanel = ({ summary, corrId }: AuthDiagnosticsProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const text = buildDiagCopyText(summary, corrId);
    const ok = await copyToClipboard(text);
    setCopied(ok);
    // Collect manual-fix action (copying diagnostics for support)
    authDiagnostics.collect({
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      reason: summary.code,
      outcome: 'manual-fix',
      correlationId: corrId,
    });
  };
  return (
    <Stack spacing={1} alignItems="center" sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary">
        理由コード: {summary.code} / 診断ID: {corrId}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="text" size="small" onClick={() => setOpen((prev) => !prev)}>
          {open ? '詳細を隠す' : '詳細を表示'}
        </Button>
        <Button variant="outlined" size="small" onClick={handleCopy}>
          {copied ? 'コピーしました' : '診断情報をコピー'}
        </Button>
      </Stack>
      {open && (
        <Paper variant="outlined" sx={{ width: '100%', p: 1 }}>
          <Typography
            component="pre"
            variant="caption"
            sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', m: 0 }}
          >
            {JSON.stringify(summary.detail, null, 2)}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
};

const AuthRedirectingNotice = ({
  flag,
  pendingPath,
  onSignIn,
  fallbackPath,
  diagSummary,
  corrId,
  msalInstance,
}: AuthNoticeProps) => {
  const [signingIn, setSigningIn] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleForceSignIn = async () => {
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
      // Collect recovery attempt
      if (diagSummary && corrId) {
        authDiagnostics.collect({
          route: pendingPath ?? '',
          reason: diagSummary.code,
          outcome: 'recovered',
          correlationId: corrId,
        });
      }
      await onSignIn();
    } catch (error) {
      console.error('[ProtectedRoute] re-login failed', error);
    } finally {
      setSigningIn(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setClearing(true);
      const removed = clearMsalCache();
      console.info('[auth] msal cache cleared', { removed, corrId });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('postLoginRedirect', pendingPath);
      }
      // Collect cache clear recovery attempt
      if (diagSummary && corrId) {
        authDiagnostics.collect({
          route: pendingPath ?? '',
          reason: diagSummary.code,
          outcome: 'recovered',
          correlationId: corrId,
        });
      }
      if (msalInstance?.logoutRedirect) {
        await msalInstance.logoutRedirect({
          postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
        return;
      }
      if (typeof window !== 'undefined') {
        window.location.assign(typeof fallbackPath === 'string' ? fallbackPath : '/');
      }
    } catch (error) {
      console.error('[ProtectedRoute] cache clear logout failed', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 1rem' }}>
      <Paper elevation={1} sx={{ maxWidth: 520, width: '100%', padding: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography component="h1" variant="h6" fontWeight={700} textAlign="center">
            サインイン処理中です…
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            画面遷移の途中です。数分待っても進まない場合は再ログインしてください。
          </Typography>
          <Button
            variant="contained"
            onClick={handleForceSignIn}
            disabled={signingIn || clearing}
            sx={{ minWidth: 200 }}
          >
            {signingIn ? '再ログイン中…' : '強制再ログイン'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearCache}
            disabled={signingIn || clearing}
            sx={{ minWidth: 220 }}
          >
            {clearing ? 'キャッシュをクリア中…' : 'キャッシュクリアして再ログイン'}
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
          <Typography variant="caption" color="text.secondary" textAlign="center">
            ① 強制再ログイン → ② キャッシュクリア → ③ 診断IDを共有
          </Typography>
          {diagSummary && corrId && <AuthDiagnosticsPanel summary={diagSummary} corrId={corrId} />}
        </Stack>
      </Paper>
    </div>
  );
};

const AuthRequiredNotice = ({
  flag,
  pendingPath,
  onSignIn,
  fallbackPath,
  diagSummary,
  corrId,
  msalInstance,
}: AuthNoticeProps) => {
  const [signingIn, setSigningIn] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleForceSignIn = async () => {
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
      // Collect recovery attempt
      if (diagSummary && corrId) {
        authDiagnostics.collect({
          route: pendingPath ?? '',
          reason: diagSummary.code,
          outcome: 'recovered',
          correlationId: corrId,
        });
      }
      await onSignIn();
    } catch (error) {
      console.error('[ProtectedRoute] sign-in failed', error);
    } finally {
      setSigningIn(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setClearing(true);
      const removed = clearMsalCache();
      console.info('[auth] msal cache cleared', { removed, corrId });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('postLoginRedirect', pendingPath);
      }
      // Collect cache clear recovery attempt
      if (diagSummary && corrId) {
        authDiagnostics.collect({
          route: pendingPath ?? '',
          reason: diagSummary.code,
          outcome: 'recovered',
          correlationId: corrId,
        });
      }
      if (msalInstance?.logoutRedirect) {
        await msalInstance.logoutRedirect({
          postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
        return;
      }
      if (typeof window !== 'undefined') {
        window.location.assign(typeof fallbackPath === 'string' ? fallbackPath : '/');
      }
    } catch (error) {
      console.error('[ProtectedRoute] cache clear logout failed', error);
    } finally {
      setClearing(false);
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
            onClick={handleForceSignIn}
            disabled={signingIn || clearing}
            sx={{ minWidth: 180 }}
          >
            {signingIn ? 'サインイン処理中…' : '強制再ログイン'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearCache}
            disabled={signingIn || clearing}
            sx={{ minWidth: 220 }}
          >
            {clearing ? 'キャッシュをクリア中…' : 'キャッシュクリアして再ログイン'}
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
          <Typography variant="caption" color="text.secondary" textAlign="center">
            ① 強制再ログイン → ② キャッシュクリア → ③ 診断IDを共有
          </Typography>
          {diagSummary && corrId && <AuthDiagnosticsPanel summary={diagSummary} corrId={corrId} />}
        </Stack>
      </Paper>
    </div>
  );
};
