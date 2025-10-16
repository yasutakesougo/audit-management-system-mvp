/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMsal } from '@azure/msal-react';
import { useCallback } from 'react';
import { getAppConfig, isE2eMsalMockEnabled } from '../lib/env';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
import { SP_RESOURCE } from './msalConfig';

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
    };
  }

  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const acquireToken = useCallback(async (resource: string = SP_RESOURCE): Promise<string | null> => {
    if (!account) return null;

    // しきい値（秒）。既定 5 分。
    const thresholdSec = Number(authConfig.VITE_MSAL_TOKEN_REFRESH_MIN || '300') || 300;
    const scope = `${resource}/.default`;

    try {
      // 1回目: 通常のサイレント取得
      const first = await instance.acquireTokenSilent({
        scopes: [scope],
        account,
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
          account,
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

      // InteractionRequiredAuthError (MFA、同意、パスワード変更など)を詳細に判定
      const isInteractionRequired =
        error?.name === 'InteractionRequiredAuthError' ||
        error?.errorCode === 'interaction_required' ||
        error?.errorCode === 'consent_required' ||
        error?.errorCode === 'login_required' ||
        error?.errorCode === 'mfa_required';

      if (isInteractionRequired) {
        debugLog('Interaction required (MFA/consent/login), redirecting to authentication...');
        // MFA対応: 明示的な対話型認証が必要な場合はリダイレクト
        await instance.acquireTokenRedirect({ scopes: [scope] });
        return null;
      }

      // その他のエラー（ネットワークエラーなど）もリダイレクトで再認証
      debugLog('Other authentication error, redirecting...');
      await instance.acquireTokenRedirect({ scopes: [scope] });
      return null;
    }
  }, [instance, account]);

  return {
    isAuthenticated: !!account,
    account,
    signIn: () => instance.loginRedirect(),
    signOut: () => instance.logoutRedirect(),
    acquireToken,
  };
};

// IDE 補完用に公開フック型を輸出
export type UseAuth = ReturnType<typeof useAuth>;
