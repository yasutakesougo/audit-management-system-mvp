/**
 * Auth Notice UI Components — extracted from ProtectedRoute.tsx
 *
 * Contains:
 * - AuthDiagnosticsPanel: collapsible diagnostics panel
 * - AuthRedirectingNotice: shown when MSAL interaction is in progress
 * - AuthRequiredNotice: shown when user is not authenticated
 * - Shared helpers: buildDiagCopyText, copyToClipboard, clearMsalCache
 */
import type { FeatureFlagSnapshot } from '@/config/featureFlags';
import { authDiagnostics } from '@/features/auth/diagnostics/collector';
import { buildAuthDiagCopyText, type AuthDiagSummary } from '@/lib/authDiag';
import { getAppConfig } from '@/lib/env';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { NavigateProps } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────

export type AuthNoticeProps = {
  flag?: keyof FeatureFlagSnapshot;
  pendingPath: string;
  fallbackPath: NavigateProps['to'];
  onSignIn?: () => Promise<{ success: boolean }>;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  success?: boolean;
  diagSummary?: AuthDiagSummary;
  corrId?: string;
  msalInstance?: { logoutRedirect?: (options?: { postLogoutRedirectUri?: string }) => Promise<void> | void };
  logoutRedirect?: (options?: { postLogoutRedirectUri?: string }) => Promise<void> | void;
  postLogoutRedirectUri?: string;
};

type AuthDiagnosticsProps = {
  summary: AuthDiagSummary;
  corrId: string;
};

// ── Dev debug ──────────────────────────────────────────────────────────────

const debug = (...args: unknown[]) => {
  if (getAppConfig().isDev) {
    // eslint-disable-next-line no-console
    console.log('[ProtectedRoute]', ...args);
  }
};

// ── Shared helpers ─────────────────────────────────────────────────────────

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

export const clearMsalCache = (): number => {
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

// ── Shared auth action hooks ───────────────────────────────────────────────

function useAuthActions(props: AuthNoticeProps) {
  const { flag, pendingPath, fallbackPath, onSignIn, diagSummary, corrId, msalInstance } = props;
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
      console.error('[ProtectedRoute] cache clear/logout failed', error);
    } finally {
      setClearing(false);
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign(typeof fallbackPath === 'string' ? fallbackPath : '/');
    }
  };

  return { signingIn, clearing, handleForceSignIn, handleClearCache, handleGoHome };
}

// ── Components ─────────────────────────────────────────────────────────────

export const AuthDiagnosticsPanel = ({ summary, corrId }: AuthDiagnosticsProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const text = buildDiagCopyText(summary, corrId);
    const ok = await copyToClipboard(text);
    setCopied(ok);
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

/** Shown when MSAL interaction is in progress */
export const AuthRedirectingNotice = (props: AuthNoticeProps) => {
  const { diagSummary, corrId } = props;
  const { signingIn, clearing, handleForceSignIn, handleClearCache, handleGoHome } = useAuthActions(props);

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
          <Button variant="text" size="small" onClick={handleGoHome}>
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

/** Shown when user is not authenticated */
export const AuthRequiredNotice = (props: AuthNoticeProps) => {
  const { diagSummary, corrId } = props;
  const { signingIn, clearing, handleForceSignIn, handleClearCache, handleGoHome } = useAuthActions(props);

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
          <Button variant="text" size="small" onClick={handleGoHome}>
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
