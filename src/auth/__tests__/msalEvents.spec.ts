import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── module mocks (before imports) ───────────────────────────────────
vi.mock('@/lib/env', () => ({
  getAppConfig: vi.fn(() => ({ isDev: false })),
}));

import { getAppConfig } from '@/lib/env';
import type { EventMessage, IPublicClientApplication } from '@azure/msal-browser';
import { EventType } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';
import type { MsalEventMap } from '../msalEvents';
import { wireMsalRoleInvalidation } from '../msalEvents';

// ── helpers ────────────────────────────────────────────────────────
const fakeEventTypes: MsalEventMap = {
  LOGOUT_SUCCESS: EventType.LOGOUT_SUCCESS,
  ACCOUNT_REMOVED: EventType.ACCOUNT_REMOVED,
  ACQUIRE_TOKEN_FAILURE: EventType.ACQUIRE_TOKEN_FAILURE,
  LOGIN_SUCCESS: EventType.LOGIN_SUCCESS,
  ACQUIRE_TOKEN_SUCCESS: EventType.ACQUIRE_TOKEN_SUCCESS,
};

const makeAccount = (username = 'user@example.com'): AccountInfo =>
  ({
    homeAccountId: `${username}-home`,
    localAccountId: `${username}-local`,
    environment: 'login.microsoftonline.com',
    tenantId: 'tenant-id',
    username,
  }) as AccountInfo;

/**
 * Creates a minimal mock MSAL instance with `addEventCallback` support.
 * The captured callback can be invoked directly in tests.
 */
const createMockInstance = () => {
  let capturedCallback: ((event: EventMessage | null) => void) | null = null;
  const instance = {
    addEventCallback: vi.fn((cb: (event: EventMessage | null) => void) => {
      capturedCallback = cb;
    }),
    getActiveAccount: vi.fn<() => AccountInfo | null>(() => null),
    getAllAccounts: vi.fn<() => AccountInfo[]>(() => []),
    setActiveAccount: vi.fn(),
  } as unknown as IPublicClientApplication & {
    addEventCallback: ReturnType<typeof vi.fn>;
    getActiveAccount: ReturnType<typeof vi.fn>;
    getAllAccounts: ReturnType<typeof vi.fn>;
    setActiveAccount: ReturnType<typeof vi.fn>;
  };
  return {
    instance,
    fireEvent: (event: EventMessage | null) => {
      if (!capturedCallback) throw new Error('No callback registered');
      capturedCallback(event);
    },
  };
};

const makeEvent = (eventType: EventType, payload?: unknown): EventMessage =>
  ({
    eventType,
    payload: payload ?? null,
    error: null,
    interactionType: null,
    timestamp: Date.now(),
  }) as EventMessage;

// ── tests ──────────────────────────────────────────────────────────
describe('msalEvents – wireMsalRoleInvalidation', () => {
  beforeEach(() => {
    vi.mocked(getAppConfig).mockReturnValue({ isDev: false } as ReturnType<typeof getAppConfig>);
    // Provide a real localStorage for role-clearing tests
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── guard clauses ────────────────────────────────────────────────

  it('does nothing when instance has no addEventCallback method', () => {
    const noOp = {} as IPublicClientApplication;
    expect(() => wireMsalRoleInvalidation(noOp, fakeEventTypes)).not.toThrow();
  });

  it('registers exactly one event callback', () => {
    const { instance } = createMockInstance();
    wireMsalRoleInvalidation(instance, fakeEventTypes);
    expect(instance.addEventCallback).toHaveBeenCalledTimes(1);
  });

  // ── null event ───────────────────────────────────────────────────

  it('ignores null events', () => {
    const { instance, fireEvent } = createMockInstance();
    wireMsalRoleInvalidation(instance, fakeEventTypes);
    expect(() => fireEvent(null)).not.toThrow();
    expect(instance.setActiveAccount).not.toHaveBeenCalled();
  });

  // ── role-clearing events ─────────────────────────────────────────

  it.each([
    ['LOGOUT_SUCCESS', fakeEventTypes.LOGOUT_SUCCESS],
    ['ACCOUNT_REMOVED', fakeEventTypes.ACCOUNT_REMOVED],
    ['ACQUIRE_TOKEN_FAILURE', fakeEventTypes.ACQUIRE_TOKEN_FAILURE],
  ] as const)('clears stored role on %s', (_label, eventType) => {
    const { instance, fireEvent } = createMockInstance();
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(eventType));

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('role');
  });

  it('does not clear role for non-clearing events (LOGIN_SUCCESS)', () => {
    const account = makeAccount();
    const { instance, fireEvent } = createMockInstance();
    (instance.getActiveAccount as ReturnType<typeof vi.fn>).mockReturnValue(account);
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, { account }));

    expect(window.localStorage.removeItem).not.toHaveBeenCalledWith('role');
  });

  // ── account activation on LOGIN_SUCCESS ──────────────────────────

  it('sets active account from event payload on LOGIN_SUCCESS', () => {
    const account = makeAccount('alice@corp.com');
    const { instance, fireEvent } = createMockInstance();
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, { account }));

    expect(instance.setActiveAccount).toHaveBeenCalledWith(account);
  });

  it('sets active account from event payload on ACQUIRE_TOKEN_SUCCESS', () => {
    const account = makeAccount('bob@corp.com');
    const { instance, fireEvent } = createMockInstance();
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.ACQUIRE_TOKEN_SUCCESS, { account }));

    expect(instance.setActiveAccount).toHaveBeenCalledWith(account);
  });

  // ── account resolution fallbacks ─────────────────────────────────

  it('falls back to getActiveAccount when payload has no account', () => {
    const activeAccount = makeAccount('active@corp.com');
    const { instance, fireEvent } = createMockInstance();
    (instance.getActiveAccount as ReturnType<typeof vi.fn>).mockReturnValue(activeAccount);
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, {}));

    expect(instance.setActiveAccount).toHaveBeenCalledWith(activeAccount);
  });

  it('falls back to first account from getAllAccounts when no active account', () => {
    const firstAccount = makeAccount('first@corp.com');
    const { instance, fireEvent } = createMockInstance();
    (instance.getActiveAccount as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (instance.getAllAccounts as ReturnType<typeof vi.fn>).mockReturnValue([firstAccount]);
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, {}));

    expect(instance.setActiveAccount).toHaveBeenCalledWith(firstAccount);
  });

  it('does NOT call setActiveAccount when no account is resolvable', () => {
    const { instance, fireEvent } = createMockInstance();
    (instance.getActiveAccount as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (instance.getAllAccounts as ReturnType<typeof vi.fn>).mockReturnValue([]);
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, {}));

    expect(instance.setActiveAccount).not.toHaveBeenCalled();
  });

  // ── dev-mode logging ─────────────────────────────────────────────

  it('logs account info in dev mode on LOGIN_SUCCESS', () => {
    vi.mocked(getAppConfig).mockReturnValue({ isDev: true } as ReturnType<typeof getAppConfig>);
    const account = makeAccount('dev@corp.com');
    const { instance, fireEvent } = createMockInstance();
    (instance.getAllAccounts as ReturnType<typeof vi.fn>).mockReturnValue([account]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, { account }));

    expect(infoSpy).toHaveBeenCalled();
    const allLogMessages = infoSpy.mock.calls.map((c) => c[0]);
    expect(allLogMessages.some((msg) => typeof msg === 'string' && msg.includes('[msal]'))).toBe(true);
  });

  it('does NOT log in production mode', () => {
    vi.mocked(getAppConfig).mockReturnValue({ isDev: false } as ReturnType<typeof getAppConfig>);
    const account = makeAccount();
    const { instance, fireEvent } = createMockInstance();
    (instance.getAllAccounts as ReturnType<typeof vi.fn>).mockReturnValue([account]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, { account }));

    // In prod mode, no [msal] info logs should appear
    const msalLogs = infoSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('[msal]'),
    );
    expect(msalLogs).toHaveLength(0);
  });

  // ── dev-mode warning when no account ─────────────────────────────

  it('warns in dev mode when LOGIN_SUCCESS but no account is resolvable', () => {
    vi.mocked(getAppConfig).mockReturnValue({ isDev: true } as ReturnType<typeof getAppConfig>);
    const { instance, fireEvent } = createMockInstance();
    (instance.getActiveAccount as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (instance.getAllAccounts as ReturnType<typeof vi.fn>).mockReturnValue([]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    wireMsalRoleInvalidation(instance, fakeEventTypes);

    fireEvent(makeEvent(fakeEventTypes.LOGIN_SUCCESS, {}));

    expect(warnSpy).toHaveBeenCalled();
    expect(instance.setActiveAccount).not.toHaveBeenCalled();
  });
});
