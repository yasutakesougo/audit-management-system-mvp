import { describe, expect, test } from 'vitest';
import { readMsalEnv } from '@/env/msalEnv';

describe('MSAL env guard', () => {
  test('throws on invalid authority (http instead of https)', () => {
    expect(() =>
      readMsalEnv({
        VITE_AZURE_AD_CLIENT_ID: 'aaaaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        VITE_AZURE_AD_TENANT_ID: 'organizations',
        VITE_AZURE_AD_AUTHORITY: 'http://login.microsoftonline.com/organizations',
        VITE_AZURE_AD_REDIRECT_URI: 'http://localhost:5173',
      })
    ).toThrow();
  });

  test('accepts valid MSAL environment values', () => {
    const env = readMsalEnv({
      VITE_AZURE_AD_CLIENT_ID: 'aaaaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      VITE_AZURE_AD_TENANT_ID: 'organizations',
      VITE_AZURE_AD_AUTHORITY: 'https://login.microsoftonline.com/organizations',
      VITE_AZURE_AD_REDIRECT_URI: 'http://localhost:5173',
    });
    expect(env).not.toBeNull();
    if (!env) {
      throw new Error('Expected readMsalEnv to return a value');
    }
    expect(env.VITE_AZURE_AD_AUTHORITY).toContain('https://');
    expect(env.VITE_AZURE_AD_CLIENT_ID).toBe('aaaaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
