import { useMsal } from '@azure/msal-react';
import { SP_RESOURCE } from './msalConfig';

// Simple global metrics object (not exposed on window unless debug)
const tokenMetrics = {
  acquireCount: 0,
  refreshCount: 0,
  lastRefreshEpoch: 0,
};

const debugEnabled = import.meta.env.VITE_AUDIT_DEBUG === '1';
function debugLog(...args: unknown[]) {
  if (debugEnabled) console.debug('[auth]', ...args);
}

export const useAuth = () => {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const acquireToken = async (): Promise<string | null> => {
    if (!account) return null;
    try {
      // Inspect cached token and expiry for soft refresh threshold
      const thresholdSec = Number(import.meta.env.VITE_MSAL_TOKEN_REFRESH_MIN || '300'); // default 5 min
  const cacheItems = (instance as any).getTokenCache()?.storage?.getAllTokens?.() || [];
      const spScope = `${SP_RESOURCE}/.default`;
      let exp = 0;
      for (const item of cacheItems) {
        if (item?.target?.includes(spScope) && item.expiresOn) {
          const date = new Date(item.expiresOn);
            exp = Math.floor(date.getTime() / 1000);
          break;
        }
      }
      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = exp ? exp - now : 0;
      const forceRefresh = secondsLeft > 0 && secondsLeft < thresholdSec;
      if (forceRefresh) debugLog('soft refresh triggered', { secondsLeft, thresholdSec });

      const result = await instance.acquireTokenSilent({
        scopes: [spScope],
        account,
        forceRefresh,
      });
      tokenMetrics.acquireCount += 1;
      if (forceRefresh) {
        tokenMetrics.refreshCount += 1;
        tokenMetrics.lastRefreshEpoch = now;
      }
      if (debugEnabled) {
        // expose for diagnostics
        (globalThis as any).__TOKEN_METRICS__ = tokenMetrics;
        debugLog('token metrics', tokenMetrics);
      }
      sessionStorage.setItem('spToken', result.accessToken);
      return result.accessToken;
    } catch (e) {
      // サイレント失敗時はリダイレクトで再認証
      sessionStorage.removeItem('spToken');
      await instance.acquireTokenRedirect({ scopes: [`${SP_RESOURCE}/.default`] });
      return null;
    }
  };

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
