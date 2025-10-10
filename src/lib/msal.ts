import type { AccountInfo } from '@azure/msal-common';

export const createE2EMsalAccount = (): AccountInfo => ({
  homeAccountId: 'e2e-home-account',
  localAccountId: 'e2e-local-account',
  environment: 'e2e-mock',
  tenantId: 'e2e-tenant',
  username: 'e2e.user@example.com',
  name: 'E2E Mock User',
});

export const persistMsalToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('spToken', token);
  } catch {
    /* ignore storage errors in sandboxed environments */
  }
};

