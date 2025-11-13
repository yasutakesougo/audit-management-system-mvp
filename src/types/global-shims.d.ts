/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "@/utils/cn" {
  export function cn(...cls: Array<string | number | undefined | null | false>): string;
  const cnDefault: typeof cn;
  export default cnDefault;
}

declare module "@azure/msal-browser" {
  export enum EventType {
    LOGIN_SUCCESS = "LOGIN_SUCCESS",
    LOGIN_FAILURE = "LOGIN_FAILURE",
    LOGOUT_SUCCESS = "LOGOUT_SUCCESS",
    ACCOUNT_REMOVED = "ACCOUNT_REMOVED",
    ACQUIRE_TOKEN_SUCCESS = "ACQUIRE_TOKEN_SUCCESS",
    ACQUIRE_TOKEN_FAILURE = "ACQUIRE_TOKEN_FAILURE"
  }

  export interface EventMessage {
    eventType: EventType;
    payload?: unknown;
  }

  export type PopupRequest = Record<string, unknown>;
  export class PublicClientApplication {
    constructor(config: Record<string, unknown>);
    loginPopup(req?: PopupRequest): Promise<{ account?: unknown }>;
    acquireTokenSilent(req: Record<string, unknown>): Promise<{ accessToken: string }>;
    acquireTokenRedirect(req: Record<string, unknown>): Promise<void>;
    loginRedirect(req?: Record<string, unknown>): Promise<void>;
    logoutRedirect(req?: Record<string, unknown>): Promise<void>;
    addEventCallback(callback: (event: EventMessage | null) => void): string | null;
    removeEventCallback(callbackId: string): void;
    setActiveAccount(account: unknown): void;
    getActiveAccount(): unknown;
    initialize(): Promise<void>;
  handleRedirectPromise(): Promise<{ account?: unknown } | null>;
    getAllAccounts(): unknown[];
  }

  export type IPublicClientApplication = PublicClientApplication;
}
