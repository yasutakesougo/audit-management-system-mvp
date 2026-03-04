import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── module mocks ───────────────────────────────────────────────────
vi.mock('@/lib/env', () => ({
  isE2eMsalMockEnabled: vi.fn(() => false),
}));

vi.mock('@/features/auth/diagnostics', () => ({
  authDiagnostics: {
    collect: vi.fn(),
    snapshot: vi.fn(() => ({ total: 0 })),
    getRecent: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
    clear: vi.fn(),
  },
}));

import { __msalContextMock, MsalProvider, useMsalContext } from '../MsalProvider';

// ── tests ──────────────────────────────────────────────────────────
describe('MsalProvider', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── __msalContextMock availability ───────────────────────────────

  describe('__msalContextMock', () => {
    it('is defined in Vitest environment', () => {
      // In Vitest, process.env.VITEST === 'true', so __msalContextMock should be available
      expect(__msalContextMock).toBeDefined();
    });

    it('has a useMsalContext mock function', () => {
      expect(__msalContextMock?.useMsalContext).toBeDefined();
      expect(typeof __msalContextMock?.useMsalContext).toBe('function');
    });

    it('returns default mock values from useMsalContext', () => {
      const value = __msalContextMock?.useMsalContext();

      expect(value).toBeDefined();
      expect(value?.accounts).toEqual([]);
      expect(value?.inProgress).toBe('none');
      expect(value?.authReady).toBe(true);
      expect(value?.instance).toBeDefined();
    });

    it('mock instance has required methods', () => {
      const value = __msalContextMock?.useMsalContext();
      const instance = value?.instance;

      expect(typeof instance?.getAllAccounts).toBe('function');
      expect(typeof instance?.getActiveAccount).toBe('function');
      expect(typeof instance?.setActiveAccount).toBe('function');
    });

    it('mock instance methods return safe defaults', () => {
      const value = __msalContextMock?.useMsalContext();
      const instance = value?.instance;

      expect(instance?.getAllAccounts()).toEqual([]);
      expect(instance?.getActiveAccount()).toBeNull();
      expect(instance?.setActiveAccount(null as never)).toBeUndefined();
    });
  });

  // ── useMsalContext in test mode ──────────────────────────────────

  describe('useMsalContext (Vitest mode)', () => {
    it('returns the mock context in Vitest environment', () => {
      // useMsalContext checks isVitest and delegates to __msalContextMock
      const result = useMsalContext();

      expect(result).toBeDefined();
      expect(result.accounts).toEqual([]);
      expect(result.inProgress).toBe('none');
      expect(result.authReady).toBe(true);
    });

    it('can be overridden via __msalContextMock for testing', () => {
      const customContext = {
        instance: {
          getAllAccounts: vi.fn(() => []),
          getActiveAccount: vi.fn(() => ({ username: 'test@corp.com' })),
          setActiveAccount: vi.fn(),
        } as never,
        accounts: [{ username: 'test@corp.com' }] as never,
        inProgress: 'none' as const,
        authReady: true,
      };

      __msalContextMock?.useMsalContext.mockReturnValueOnce(customContext);

      const result = useMsalContext();
      expect(result.accounts).toHaveLength(1);
    });
  });

  // ── MsalProvider rendering ───────────────────────────────────────

  describe('MsalProvider rendering', () => {
    it('renders children in Vitest/mock mode', () => {
      render(
        React.createElement(
          MsalProvider,
          null,
          React.createElement('div', { 'data-testid': 'child' }, 'Hello from child'),
        ),
      );

      expect(screen.getByTestId('child')).toBeDefined();
      expect(screen.getByText('Hello from child')).toBeDefined();
    });

    it('renders multiple children', () => {
      render(
        React.createElement(
          MsalProvider,
          null,
          React.createElement('span', { 'data-testid': 'first' }, 'First'),
          React.createElement('span', { 'data-testid': 'second' }, 'Second'),
        ),
      );

      expect(screen.getByTestId('first')).toBeDefined();
      expect(screen.getByTestId('second')).toBeDefined();
    });
  });
});
