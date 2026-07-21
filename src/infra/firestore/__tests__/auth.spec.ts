import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Stubs ──────────────────────────────────────────────────────────
const signInAnonymouslyMock = vi.fn().mockResolvedValue({
  user: { uid: 'anon-uid', isAnonymous: true },
});
const signInWithCustomTokenMock = vi.fn().mockResolvedValue({
  user: { uid: 'custom-uid', isAnonymous: false },
});
const getAuthMock = vi.fn();
const getFirebaseAppMock = vi.fn().mockReturnValue({});
const getPcaSingletonMock = vi.fn();

// ── Module mocks ───────────────────────────────────────────────────
vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => getAuthMock(...args),
  signInAnonymously: (...args: unknown[]) => signInAnonymouslyMock(...args),
  signInWithCustomToken: (...args: unknown[]) => signInWithCustomTokenMock(...args),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('../client', () => ({
  getFirebaseApp: () => getFirebaseAppMock(),
}));

vi.mock('@/auth/azureMsal', () => ({
  getPcaSingleton: () => getPcaSingletonMock(),
}));

const mockGet = vi.fn<(name: string, fallback?: string) => string>();
const mockGetFlag = vi.fn<(name: string, fallback?: boolean) => boolean>();

vi.mock('@/env', () => ({
  get: (...args: unknown[]) => mockGet(args[0] as string, args[1] as string),
  getFlag: (...args: unknown[]) => mockGetFlag(args[0] as string, args[1] as boolean),
  getRuntimeEnv: vi.fn(() => ({})),
  isDev: false,
}));

const mockShouldSkipLogin = vi.fn<() => boolean>();
vi.mock('@/lib/env', () => ({
  shouldSkipLogin: () => mockShouldSkipLogin(),
}));

// ── Helpers ────────────────────────────────────────────────────────
const setupEnv = (overrides: {
  apiKey?: string;
  authMode?: string;
  e2e?: boolean;
  anonFallback?: boolean;
  useEmulator?: boolean;
  skipLogin?: boolean;
}) => {
  mockGet.mockImplementation((name: string, fallback = '') => {
    if (name === 'VITE_FIREBASE_API_KEY') return overrides.apiKey ?? 'test-api-key';
    if (name === 'VITE_FIREBASE_AUTH_MODE') return overrides.authMode ?? 'anonymous';
    if (name === 'VITE_FIREBASE_TOKEN_EXCHANGE_URL') {
      return `${typeof window === 'undefined' ? 'https://app.example' : window.location.origin}/api/firebase/exchange`;
    }
    return fallback;
  });
  mockGetFlag.mockImplementation((name: string, fallback = false) => {
    if (name === 'VITE_E2E') return overrides.e2e ?? false;
    if (name === 'VITE_FIREBASE_AUTH_ALLOW_ANON_FALLBACK') return overrides.anonFallback ?? false;
    if (name === 'VITE_FIREBASE_AUTH_USE_EMULATOR') return overrides.useEmulator ?? false;
    if (name === 'DEV') return false;
    return fallback;
  });
  mockShouldSkipLogin.mockReturnValue(overrides.skipLogin ?? false);
};

describe('initFirebaseAuth', () => {
  let initFirebaseAuth: () => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();

    getAuthMock.mockReturnValue({
      currentUser: null,
      emulatorConfig: null,
    });

    // Default: valid API key, anonymous mode, no skip-login
    setupEnv({});
    getPcaSingletonMock.mockResolvedValue({
      getActiveAccount: () => ({ homeAccountId: 'home-account' }),
      getAllAccounts: () => [{ homeAccountId: 'home-account' }],
      acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'msal-access-token' }),
    });

    // Dynamic import to pick up mocks
    const mod = await import('../auth');
    initFirebaseAuth = mod.initFirebaseAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── E2E skip ────────────────────────────────────────────────────
  it('should skip auth in E2E mode', async () => {
    setupEnv({ e2e: true });

    await initFirebaseAuth();

    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
  });

  // ── Placeholder API key skip ────────────────────────────────────
  it.each([
    '',
    'dummy-api-key',
    'your-firebase-api-key',
    'changeme',
    'undefined',
  ])('should skip auth when API key is placeholder: "%s"', async (apiKey) => {
    setupEnv({ apiKey });

    await initFirebaseAuth();

    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
  });

  // ── Normal anonymous sign-in ────────────────────────────────────
  it('should sign in anonymously when mode is anonymous', async () => {
    setupEnv({ authMode: 'anonymous' });

    await initFirebaseAuth();

    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1);
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
  });

  // ── Already authenticated ──────────────────────────────────────
  it('should skip sign-in if already authenticated', async () => {
    getAuthMock.mockReturnValue({
      currentUser: { uid: 'existing-uid', isAnonymous: true },
      emulatorConfig: null,
    });
    setupEnv({});

    await initFirebaseAuth();

    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
  });

  // ── Self-healing guard: skip-login + customToken → anonymous ───
  it('should fallback to anonymous when customToken mode is requested in skip-login mode', async () => {
    setupEnv({ authMode: 'customToken', skipLogin: true });

    await initFirebaseAuth();

    // Should NOT attempt customToken exchange (MSAL is not available)
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
    // Should fall back to anonymous
    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1);
  });

  // ── No guard: skip-login + anonymous (already correct mode) ────
  it('should sign in anonymously normally in skip-login mode when mode is already anonymous', async () => {
    setupEnv({ authMode: 'anonymous', skipLogin: true });

    await initFirebaseAuth();

    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1);
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
  });

  // ── No guard: normal mode + customToken (MSAL should be available) ─
  // Note: We can't easily test a full customToken flow here because
  // it requires MSAL mocking. This test verifies the guard does NOT
  // activate when skipLogin is false.
  it('should NOT activate the self-healing guard when skipLogin is false', async () => {
    // If skipLogin=false and mode=customToken, it should attempt
    // the customToken path (which will fail without MSAL mock, 
    // but verifies the guard does not interfere)
    setupEnv({ authMode: 'customToken', skipLogin: false });

    // The call will fail because MSAL is not mocked for full flow,
    // but the error should NOT be "falling back to anonymous" from the guard
    await initFirebaseAuth();

    // The self-healing guard should NOT have triggered anonymous sign-in
    // Error is caught by the outer try-catch (non-fatal logging)
    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
  });

  it('should complete customToken authentication without anonymous fallback', async () => {
    setupEnv({ authMode: 'customToken' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      firebaseCustomToken: 'firebase-custom-token',
      orgId: 'tenant-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await initFirebaseAuth();

    expect(signInWithCustomTokenMock).toHaveBeenCalledWith(
      expect.anything(),
      'firebase-custom-token',
    );
    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
  });

  it('records exchange-request stage and does not fall back anonymously on fetch failure', async () => {
    setupEnv({ authMode: 'customToken' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await initFirebaseAuth();

    expect(consoleError).toHaveBeenCalledWith('[firebase-auth] ❌ initialization failed', expect.objectContaining({
      stage: 'exchange-request',
      reason: 'network-failure',
      host: window.location.host,
      path: '/api/firebase/exchange',
    }));
    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
  });

  it('records firebase-sign-in stage and does not fall back anonymously on Firebase sign-in failure', async () => {
    setupEnv({ authMode: 'customToken' });
    signInWithCustomTokenMock.mockRejectedValueOnce(Object.assign(new Error('invalid custom token'), { name: 'FirebaseError', code: 'auth/invalid-custom-token' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      firebaseCustomToken: 'firebase-custom-token',
    }), { status: 200 })));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await initFirebaseAuth();

    expect(consoleError).toHaveBeenCalledWith('[firebase-auth] ❌ initialization failed', expect.objectContaining({
      stage: 'firebase-sign-in',
      reason: 'auth/invalid-custom-token',
    }));
    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
  });
});
