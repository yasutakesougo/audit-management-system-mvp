import { env, getAppConfig } from '../lib/env';

const appConfig = getAppConfig();

// NOTE: In CI/unit tests we don't require real MSAL IDs; allow safe placeholders.
const isTestEnv =
  (typeof process !== 'undefined' &&
    (process.env.VITEST === '1' ||
      process.env.VITEST === 'true' ||
      process.env.NODE_ENV === 'test')) ||
  // Vitest also exposes a global marker in the test runtime.
  (typeof globalThis !== 'undefined' && !!(globalThis as unknown as { __vitest__?: boolean }).__vitest__) ||
  // Vite/Vitest provides import.meta.env.MODE === 'test'
  ((import.meta as unknown as { env?: Record<string, unknown> })?.env?.MODE === 'test');

const config = env as unknown as Record<string, string | undefined>;

let effectiveClientId = config.VITE_MSAL_CLIENT_ID || config.VITE_AAD_CLIENT_ID || config.VITE_AZURE_CLIENT_ID;
let effectiveTenantId = config.VITE_MSAL_TENANT_ID || config.VITE_AAD_TENANT_ID || config.VITE_AZURE_TENANT_ID;

// Validation: MSAL config must have valid values (no dummy allowed)
if (!effectiveClientId || !effectiveTenantId) {
  if (isTestEnv) {
    // Placeholders for unit tests / CI where real MSAL config is not available.
    effectiveClientId = effectiveClientId || '00000000-0000-0000-0000-000000000000';
    effectiveTenantId = effectiveTenantId || '00000000-0000-0000-0000-000000000000';
  } else {
    const error = new Error(
      '[MSAL CONFIG] Missing CLIENT_ID/TENANT_ID. ' +
        'Set VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID (or VITE_AAD_CLIENT_ID/VITE_AAD_TENANT_ID) in .env.local or environment.',
    );
    // eslint-disable-next-line no-console
    console.error(error.message);
    throw error;
  }
}

export const SP_RESOURCE = appConfig.VITE_SP_RESOURCE;
export const GRAPH_RESOURCE = 'https://graph.microsoft.com';
export const GRAPH_SCOPES = ['User.Read', 'GroupMember.Read.All'] as const;
export const LOGIN_SCOPES = ['openid', 'profile', 'offline_access', ...GRAPH_SCOPES] as const;

const LOCAL_ORIGIN = 'http://localhost:5173';
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : LOCAL_ORIGIN;
const envRedirectUri = (config.VITE_MSAL_REDIRECT_URI || config.VITE_AZURE_AD_REDIRECT_URI)?.trim();

const resolveRedirectUri = (): string => {
  const fallback = `${runtimeOrigin}/callback`; // Standardized fallback
  if (!envRedirectUri) return fallback;
  try {
    const parsed = new URL(envRedirectUri);
    if (parsed.origin !== runtimeOrigin && !isTestEnv) return fallback;
    return envRedirectUri;
  } catch {
    return fallback;
  }
};

const redirectUri = resolveRedirectUri();

export const msalConfig = {
  auth: {
    clientId: effectiveClientId,
    authority: `https://login.microsoftonline.com/${effectiveTenantId}`,
    redirectUri,
    postLogoutRedirectUri: runtimeOrigin,
  },
  cache: {
    // iOS/Safari: prefer localStorage + cookie-backed state to avoid redirect loops.
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
};
