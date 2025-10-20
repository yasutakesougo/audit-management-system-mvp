import { EventType, type EventMessage, type IPublicClientApplication } from '@azure/msal-browser';
import { pushAudit } from '@/lib/audit';

const CLEAR_ROLE_EVENTS = new Set<EventType>([
  EventType.LOGOUT_SUCCESS,
  EventType.ACCOUNT_REMOVED,
  EventType.ACQUIRE_TOKEN_FAILURE,
]);

export function wireMsalRoleInvalidation(instance: IPublicClientApplication) {
  if (typeof instance?.addEventCallback !== 'function') {
    return;
  }

  instance.addEventCallback((event: EventMessage | null) => {
    if (!event) {
      return;
    }

    if (CLEAR_ROLE_EVENTS.has(event.eventType)) {
      try {
        window.localStorage.removeItem('role');
      } catch (error) {
        console.warn('[msal] failed to clear stored role', error);
      }
      try {
        pushAudit({ actor: 'current', action: 'AUTH_SIGN_OUT', entity: 'MSAL', channel: 'MSAL' });
      } catch {}
    }

    if (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
      const account = (event.payload as { account?: Parameters<IPublicClientApplication['setActiveAccount']>[0] })?.account;
      if (account) {
        instance.setActiveAccount(account);
      }
      try {
        pushAudit({ actor: 'current', action: 'AUTH_SIGN_IN', entity: 'MSAL', channel: 'MSAL' });
      } catch {}
    }
  });
}
