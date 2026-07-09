import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateEnv } from '@/config/envSchema';

let runtimeEnv: Record<string, string | undefined> = {};

vi.mock('@/env', () => ({
  getRuntimeEnv: () => runtimeEnv,
}));

const baseProductionEnv = (): Record<string, string | undefined> => ({
  MODE: 'production',
  VITE_MSAL_CLIENT_ID: 'msal-client-id',
  VITE_MSAL_TENANT_ID: 'msal-tenant-id',
  VITE_MSAL_REDIRECT_URI: 'https://localhost:5173',
  VITE_MSAL_AUTHORITY: 'https://login.microsoftonline.com/common',
});

describe('validateEnv', () => {
  beforeEach(() => {
    runtimeEnv = baseProductionEnv();
  });

  afterEach(() => {
    runtimeEnv = {};
  });

  it('throws when required MSAL identifiers are missing in production-like mode', () => {
    runtimeEnv.VITE_MSAL_CLIENT_ID = '';
    runtimeEnv.VITE_MSAL_TENANT_ID = '';
    expect(() => validateEnv()).toThrowError(/VITE_MSAL_CLIENT_ID|VITE_MSAL_TENANT_ID/);
  });

  it('throws when redirect URI is invalid in production-like mode', () => {
    runtimeEnv.VITE_MSAL_REDIRECT_URI = 'not-a-url';
    expect(() => validateEnv()).toThrowError(/VITE_MSAL_REDIRECT_URI/);
  });

  it('throws when redirect URI is missing in production-like mode', () => {
    delete runtimeEnv.VITE_MSAL_REDIRECT_URI;
    expect(() => validateEnv()).toThrowError(/VITE_MSAL_REDIRECT_URI/);
  });

  it('skips all validation under E2E mode', () => {
    runtimeEnv.VITE_E2E = '1';
    runtimeEnv.VITE_MSAL_CLIENT_ID = '';
    runtimeEnv.VITE_MSAL_TENANT_ID = '';
    runtimeEnv.VITE_MSAL_REDIRECT_URI = '';
    expect(() => validateEnv()).not.toThrow();
  });

  it('skips all validation under E2E MSAL mock mode', () => {
    runtimeEnv.VITE_E2E_MSAL_MOCK = '1';
    runtimeEnv.VITE_MSAL_CLIENT_ID = '';
    runtimeEnv.VITE_MSAL_TENANT_ID = '';
    expect(() => validateEnv()).not.toThrow();
  });

  it('skips validation in demo mode', () => {
    runtimeEnv.VITE_DEMO_MODE = '1';
    runtimeEnv.VITE_MSAL_CLIENT_ID = '';
    runtimeEnv.VITE_MSAL_TENANT_ID = '';
    expect(() => validateEnv()).not.toThrow();
  });

  it('accepts non-production mode even when redirect URI is missing', () => {
    runtimeEnv.MODE = 'development';
    runtimeEnv.VITE_MSAL_REDIRECT_URI = '';
    expect(() => validateEnv()).not.toThrow();
  });
});
