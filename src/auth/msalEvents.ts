import type { EventMessage, EventType, IPublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';
import { getAppConfig } from '@/lib/env';

const ROLE_STORAGE_KEY = 'role';

export type MsalEventMap = Pick<
  typeof import('@azure/msal-browser')['EventType'],
  | 'LOGOUT_SUCCESS'
  | 'ACCOUNT_REMOVED'
  | 'ACQUIRE_TOKEN_FAILURE'
  | 'LOGIN_SUCCESS'
  | 'ACQUIRE_TOKEN_SUCCESS'
>;

export function wireMsalRoleInvalidation(instance: IPublicClientApplication, eventTypes: MsalEventMap) {
  if (typeof instance?.addEventCallback !== 'function') {
    return;
  }

  const clearRoleEvents = new Set<EventType>([
    eventTypes.LOGOUT_SUCCESS,
    eventTypes.ACCOUNT_REMOVED,
    eventTypes.ACQUIRE_TOKEN_FAILURE,
  ]);

  const getPayloadAccount = (payload: unknown): AccountInfo | null => {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const candidate = payload as { account?: AccountInfo | null };
    return candidate.account ?? null;
  };

  const resolveAccount = (payload: unknown): AccountInfo | null => {
    const fromPayload = getPayloadAccount(payload);
    if (fromPayload) {
      return fromPayload;
    }
    const active = instance.getActiveAccount() as AccountInfo | null;
    if (active) {
      return active;
    }
    const [first] = instance.getAllAccounts() as AccountInfo[];
    return (first as AccountInfo | undefined) ?? null;
  };

  const { isDev: isDevEnv } = getAppConfig();

  const logAccounts = (reason: string, account?: AccountInfo | null): void => {
    if (!isDevEnv) {
      return;
    }
    try {
      const label = account?.username ?? account?.homeAccountId ?? '(unknown)';
      // eslint-disable-next-line no-console
      console.info(`[msal] ${reason} -> setActiveAccount`, label);
      const cache = (instance.getAllAccounts() as AccountInfo[]).map((a) => a.username ?? a.homeAccountId ?? '(unknown)');
      // eslint-disable-next-line no-console
      console.info('[msal] account cache', cache);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[msal] logAccounts failed', error);
    }
  };

  instance.addEventCallback((event: EventMessage | null) => {
    if (!event) {
      return;
    }

    if (clearRoleEvents.has(event.eventType) && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(ROLE_STORAGE_KEY);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[msal] failed to clear stored role', error);
      }
    }

    if (event.eventType === eventTypes.LOGIN_SUCCESS || event.eventType === eventTypes.ACQUIRE_TOKEN_SUCCESS) {
      const account = resolveAccount(event.payload);
      if (!account) {
        if (isDevEnv) {
          // eslint-disable-next-line no-console
          console.warn('[msal] auth event received but no accounts available yet');
        }
        return;
      }
      instance.setActiveAccount(account);
      logAccounts(event.eventType, account);
    }
  });
}
