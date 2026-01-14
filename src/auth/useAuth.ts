/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IPublicClientApplication } from '@azure/msal-browser';
import { InteractionStatus } from './interactionStatus';
import { useCallback, useEffect } from 'react';
import { getAppConfig, isE2eMsalMockEnabled, shouldSkipLogin } from '../lib/env';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
import { SP_RESOURCE } from './msalConfig';
import { useMsalContext } from './MsalProvider';

// Simple global metrics object (not exposed on window unless debug)
const tokenMetrics = {
  acquireCount: 0,
  refreshCount: 0,
  lastRefreshEpoch: 0,
};

const authConfig = getAppConfig();
const debugEnabled = authConfig.VITE_AUDIT_DEBUG === '1' || authConfig.VITE_AUDIT_DEBUG === 'true';
function debugLog(...args: unknown[]) {
  if (debugEnabled) console.debug('[auth]', ...args);
}

type BasicAccountInfo = {
  username?: string;
  homeAccountId?: string;
};

const ensureActiveAccount = (instance: IPublicClientApplication) => {
  let account = instance.getActiveAccount() as BasicAccountInfo | null;
  if (!account) {
    const all = (instance.getAllAccounts() as BasicAccountInfo[]) ?? [];
    if (all.length > 0) {
      const firstAccount = all[0];
      instance.setActiveAccount(firstAccount);
      account = firstAccount;
      if (authConfig.isDev) {
        const accountLabel = firstAccount.username ?? firstAccount.homeAccountId ?? '(unknown account)';
        console.info('[MSAL] Active account auto-set:', accountLabel);
      }
    }
  }
  return account;
};

const isInteractionRequiredError = (err: unknown): boolean => {
  const code = typeof err === 'object' && err && 'errorCode' in err ? String((err as { errorCode?: unknown }).errorCode) : '';
  const name = typeof err === 'object' && err && 'name' in err ? String((err as { name?: unknown }).name) : '';
  if (name === 'InteractionRequiredAuthError') return true;
  return ['interaction_required', 'login_required', 'consent_required', 'user_null'].includes(code);
};

export const useAuth = () => {
  if (isE2eMsalMockEnabled()) {
    const account = createE2EMsalAccount();
    const acquireToken = useCallback(async (resource: string = SP_RESOURCE): Promise<string> => {
      const scopeBase = resource.replace(/\/+$/, '');
      const token = `mock-token:${scopeBase}/.default`;
      persistMsalToken(token);
      return token;
    }, []);

    return {
      isAuthenticated: true,
      account,
      signIn: () => Promise.resolve(),
      signOut: () => Promise.resolve(),
      acquireToken,
      loading: false,
      shouldSkipLogin: true,
    };
  }

  const { instance, accounts, inProgress } = useMsalContext();
  const skipLogin = shouldSkipLogin();

  useEffect(() => {
    if (skipLogin) {
      return;
    }
    const current = instance.getActiveAccount();
    if (!current && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, skipLogin]);

  if (skipLogin) {
    return {
      isAuthenticated: true,
      account: null,
      signIn: () => Promise.resolve(),
      signOut: () => Promise.resolve(),
      acquireToken: () => Promise.resolve(null),
      loading: false,
      shouldSkipLogin: true,
    };
  }

  const normalizeResource = (resource: string): string => resource.replace(/\/+$/, '');
  const ensureResource = (resource?: string): string => normalizeResource(resource ?? SP_RESOURCE);
  const defaultScope = `${ensureResource()}/.default`;

  const acquireToken = useCallback(async (resource?: string): Promise<string | null> => {
    const activeAccount = ensureActiveAccount(instance) ?? (accounts[0] as BasicAccountInfo | undefined) ?? null;
    if (!activeAccount) return null;

    // しきい値（秒）。既定 5 分。
    const thresholdSec = Number(authConfig.VITE_MSAL_TOKEN_REFRESH_MIN || '300') || 300;
    const scope = `${ensureResource(resource)}/.default`;

    try {
      // 1回目: 通常のサイレント取得
      const first = await instance.acquireTokenSilent({
        scopes: [scope],
        account: activeAccount,
        forceRefresh: false,
      });
      tokenMetrics.acquireCount += 1;

      const nowSec = Math.floor(Date.now() / 1000);
      const firstResult = first as { expiresOn?: Date | null };
      const expSec = firstResult.expiresOn
        ? Math.floor(firstResult.expiresOn.getTime() / 1000)
        : 0;
      const secondsLeft = expSec ? expSec - nowSec : 0;

      // 有効期限が近い場合だけ 2回目: 強制リフレッシュ
      if (secondsLeft > 0 && secondsLeft < thresholdSec) {
        debugLog('soft refresh triggered', { secondsLeft, thresholdSec });
        const refreshed = await instance.acquireTokenSilent({
          scopes: [scope],
          account: activeAccount,
          forceRefresh: true,
        });
        tokenMetrics.acquireCount += 1;
        tokenMetrics.refreshCount += 1;
        tokenMetrics.lastRefreshEpoch = nowSec;

        if (debugEnabled) {
          (globalThis as { __TOKEN_METRICS__?: typeof tokenMetrics }).__TOKEN_METRICS__ =
            tokenMetrics;
          debugLog('token metrics', tokenMetrics);
        }

        sessionStorage.setItem('spToken', refreshed.accessToken);
        return refreshed.accessToken;
      }

      if (debugEnabled) {
        (globalThis as { __TOKEN_METRICS__?: typeof tokenMetrics }).__TOKEN_METRICS__ =
          tokenMetrics;
        debugLog('token metrics', tokenMetrics);
      }

      sessionStorage.setItem('spToken', first.accessToken);
      return first.accessToken;
    } catch (error: any) {
      // MSAL エラーの詳細な処理
      debugLog('acquireTokenSilent failed', {
        errorName: error?.name,
        errorCode: error?.errorCode,
        message: error?.message || 'Unknown error'
      });

      sessionStorage.removeItem('spToken');
      if (isInteractionRequiredError(error)) {
        debugLog('Token silent failed: interaction required -> return null');
        return null;
      }

      console.warn('[auth] acquireTokenSilent failed', error);
      return null;
    }
  }, [instance, accounts]);

  const resolvedAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
  const isAuthenticated = !!resolvedAccount;

  return {
    isAuthenticated,
    account: resolvedAccount,
    signIn: async () => {
      try {
        const canInteract = inProgress === InteractionStatus.None || inProgress === 'none';
        if (!canInteract) {
          debugLog('loginPopup skipped because another interaction is in progress');
          return;
        }
        const result = await instance.loginPopup({ scopes: [defaultScope], prompt: 'select_account' });
        if (result?.account) {
          instance.setActiveAccount(result.account);
        }
      } catch (error: any) {
        const popupIssues = new Set([
          'user_cancelled',
          'popup_window_error',
          'monitor_window_timeout',
        ]);

        const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
        const coopBlocked = message.includes('cross-origin-opener-policy') || message.includes('window.closed');

        if (popupIssues.has(error?.errorCode) || coopBlocked) {
          debugLog('loginPopup failed; falling back to redirect', {
            name: error?.name,
            code: error?.errorCode,
          });
          const canInteractRedirect = inProgress === InteractionStatus.None || inProgress === 'none';
          if (canInteractRedirect) {
            await instance.loginRedirect({ scopes: [defaultScope], prompt: 'select_account' });
          } else {
            debugLog('loginRedirect skipped because another interaction is in progress');
          }
          return;
        }

        throw error;
      }
    },
    signOut: () => instance.logoutRedirect(),
    acquireToken,
    loading: inProgress !== 'none',
    shouldSkipLogin: false,
  };
};

// IDE 補完用に公開フック型を輸出
export type UseAuth = ReturnType<typeof useAuth>;
