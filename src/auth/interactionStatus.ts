export const InteractionStatus = {
  Startup: 'startup',
  Login: 'login',
  AcquireToken: 'acquireToken',
  SsoSilent: 'ssoSilent',
  HandleRedirect: 'handleRedirect',
  Logout: 'logout',
  None: 'none',
} as const;

export type InteractionStatus = (typeof InteractionStatus)[keyof typeof InteractionStatus];
