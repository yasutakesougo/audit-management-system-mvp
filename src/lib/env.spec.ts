import { describe, expect, it } from 'vitest';
import { getAppConfig } from './env';

describe('getAppConfig MSAL redirect URI', () => {
  it('exposes the configured MSAL redirect URI', () => {
    const config = getAppConfig({
      VITE_MSAL_REDIRECT_URI: 'https://audit-management-system-mvp.momosantanuki.workers.dev/auth/callback',
    });

    expect(config.VITE_MSAL_REDIRECT_URI).toBe(
      'https://audit-management-system-mvp.momosantanuki.workers.dev/auth/callback',
    );
  });

  it('falls back to the legacy Azure AD redirect URI alias', () => {
    const config = getAppConfig({
      VITE_MSAL_REDIRECT_URI: '',
      VITE_AZURE_AD_REDIRECT_URI: 'https://example.invalid/auth/callback',
    });

    expect(config.VITE_MSAL_REDIRECT_URI).toBe('https://example.invalid/auth/callback');
  });

  it('prefers the canonical redirect URI when both aliases are configured', () => {
    const config = getAppConfig({
      VITE_MSAL_REDIRECT_URI: 'https://canonical.example/auth/callback',
      VITE_AZURE_AD_REDIRECT_URI: 'https://legacy.example/auth/callback',
    });

    expect(config.VITE_MSAL_REDIRECT_URI).toBe('https://canonical.example/auth/callback');
  });

  it('returns an empty redirect URI when neither alias is configured', () => {
    const config = getAppConfig({
      VITE_MSAL_REDIRECT_URI: '',
      VITE_AZURE_AD_REDIRECT_URI: '',
    });

    expect(config.VITE_MSAL_REDIRECT_URI).toBe('');
  });
});
