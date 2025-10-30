import type { EventMessage, EventType, IPublicClientApplication } from '@azure/msal-browser';

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

  instance.addEventCallback((event: EventMessage | null) => {
    if (!event) {
      return;
    }

    if (clearRoleEvents.has(event.eventType)) {
      try {
        window.localStorage.removeItem('role');
      } catch (error) {
        console.warn('[msal] failed to clear stored role', error);
      }
    }

    if (event.eventType === eventTypes.LOGIN_SUCCESS || event.eventType === eventTypes.ACQUIRE_TOKEN_SUCCESS) {
      const account = (event.payload as { account?: Parameters<IPublicClientApplication['setActiveAccount']>[0] })?.account;
      if (account) {
        instance.setActiveAccount(account);
      }
    }
  });
}
