import { PublicClientApplication } from '@azure/msal-browser';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '../auth/msalConfig';
import { publishMsalMock } from '@/e2e/hooks';
import { initMsalMock, resetMsalMockSignal } from '@/auth/msalMock';
import { wireMsalRoleInvalidation } from '../auth/msalEvents';
import { isE2eMsalMockEnabled } from './env';

const globalWithMock = globalThis as typeof globalThis & {
  __createMsalMock?: () => IPublicClientApplication;
};

export const msalInstance = globalWithMock.__createMsalMock
  ? globalWithMock.__createMsalMock()
  : new PublicClientApplication(msalConfig);

wireMsalRoleInvalidation(msalInstance);

const enableE2EMock = isE2eMsalMockEnabled();

if (enableE2EMock) {
  resetMsalMockSignal();
  publishMsalMock(msalInstance);
}

// 初期化 → リダイレクト処理 → ActiveAccount 設定
// （順序をまとめておくと利用側のレースを避けられます）
let msalInitPromise: Promise<void> | null = null;

const bootstrapMsal = async () => {
  await msalInstance.initialize();

  try {
    const response = await msalInstance.handleRedirectPromise();
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
    } else if (!msalInstance.getActiveAccount()) {
      const [first] = msalInstance.getAllAccounts();
      if (first) msalInstance.setActiveAccount(first);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[msal] handleRedirectPromise failed', error);
  }

  if (enableE2EMock) {
    try {
      await initMsalMock(msalInstance);
    } catch (error) {
      console.warn('[msal] initMsalMock failed', error);
    }
  }
};

export const initializeMsalOnce = (): Promise<void> => {
  if (!msalInitPromise) {
    msalInitPromise = bootstrapMsal();
  }
  return msalInitPromise;
};

export const msalReady = initializeMsalOnce();
