// MSAL config (tolerant env reader + clear errors)
// - window.__ENV__ (main.tsx 注入) → import.meta.env の順で読む
// - VITE_MSAL_* / VITE_AAD_* の両方を許容
// - Redirect URI / Authority も __ENV__ を優先

import { PublicClientApplication } from '@azure/msal-browser';

declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

const PLACEHOLDER_CLIENT_IDS = new Set([
  'dummy-client-id',
  '<your_app_client_id>',
  '<your-client-id>',
  '__fill_me__',
]);
const PLACEHOLDER_TENANTS = new Set(['dummy-tenant', '<yourtenant>', '<tenant>', '__fill_me__']);

const isPlaceholder = (value: unknown, placeholders: Set<string>): boolean => {
  if (typeof value !== 'string') return false;
  return placeholders.has(value.trim().toLowerCase());
};

const getEnv = (): Record<string, string | undefined> => {
  const win = typeof window !== 'undefined' ? window : undefined;
  const injected = win?.__ENV__ ?? {};
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env ?? {};
  return { ...meta, ...injected };
};

const resolveClientId = (): string => {
  const env = getEnv();
  const raw = env.VITE_MSAL_CLIENT_ID ?? env.VITE_AAD_CLIENT_ID ?? '';
  if (!raw || isPlaceholder(raw, PLACEHOLDER_CLIENT_IDS)) {
    throw new Error(
      '[MSAL 設定エラー]\n' +
        'VITE_MSAL_CLIENT_ID が設定されていません。\n' +
        '例: VITE_MSAL_CLIENT_ID=00000000-0000-0000-0000-000000000000'
    );
  }
  return raw;
};

const resolveTenant = (): string => {
  const env = getEnv();
  const raw = env.VITE_MSAL_TENANT_ID ?? env.VITE_AAD_TENANT_ID ?? '';
  if (!raw || isPlaceholder(raw, PLACEHOLDER_TENANTS)) {
    throw new Error('[MSAL 設定エラー]\nVITE_MSAL_TENANT_ID が設定されていません。');
  }
  return raw;
};

const resolveAuthority = (): string => {
  const env = getEnv();
  const override = env.VITE_MSAL_AUTHORITY?.trim();
  if (override) {
    try {
      const url = new URL(override);
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
        throw new Error('Authority must use https (localhost can use http).');
      }
      return url.toString().replace(/\/+$/, '');
    } catch {
      throw new Error(
        `[MSAL 設定エラー]\nVITE_MSAL_AUTHORITY の形式が不正です: ${override}\nhttps:// で始まる有効な URL を指定してください。`
      );
    }
  }
  const tenant = resolveTenant();
  return `https://login.microsoftonline.com/${tenant}`;
};

const resolveRedirectUri = (): string => {
  const env = getEnv();
  const fallback =
    (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost:3000';
  const override = env.VITE_MSAL_REDIRECT_URI?.trim();
  if (!override) return fallback;
  try {
    const url = new URL(override, fallback);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
      throw new Error('Redirect URI must use https (localhost can use http).');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error(
      `[MSAL 設定エラー]\nVITE_MSAL_REDIRECT_URI が不正です: ${override}\nhttps:// で始まる有効な URI を指定してください。`
    );
  }
};

const getScopes = (value: string | undefined, fallback?: string): string[] => {
  const raw = (value ?? fallback ?? '').trim();
  if (!raw) return fallback ? [fallback] : [];
  return raw
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
};

export const AUTHORITY = resolveAuthority();
export const REDIRECT_URI = resolveRedirectUri();

export const LOGIN_SCOPES = getScopes(getEnv().VITE_LOGIN_SCOPES, 'openid profile');
export const MSAL_SCOPES = getScopes(getEnv().VITE_MSAL_SCOPES);

export const SP_RESOURCE = getEnv().VITE_SP_RESOURCE ?? import.meta.env.VITE_SP_RESOURCE;

export const msalConfig = {
  auth: {
    clientId: resolveClientId(),
    authority: AUTHORITY,
    redirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: () => {},
      piiLoggingEnabled: false,
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

