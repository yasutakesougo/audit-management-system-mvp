import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── module mocks (no top-level var references in factory) ──────────
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('@/auth/azureMsal', () => ({
  getPcaSingleton: vi.fn(() =>
    Promise.resolve({
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
      getActiveAccount: vi.fn(() => null),
      getAllAccounts: vi.fn(() => []),
      setActiveAccount: vi.fn(),
    }),
  ),
}));

import { getPcaSingleton } from '@/auth/azureMsal';
import { useNavigate } from 'react-router-dom';
import { AuthCallbackRoute } from '../AuthCallbackRoute';

// ── tests ──────────────────────────────────────────────────────────
describe('AuthCallbackRoute', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => store.set(key, val)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
      get length() { return store.size; },
      key: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── rendering ────────────────────────────────────────────────────

  it('renders the loading message', () => {
    render(React.createElement(AuthCallbackRoute));

    expect(screen.getByText('サインイン処理中…')).toBeDefined();
  });

  // ── redirect handling ────────────────────────────────────────────

  it('calls handleRedirectPromise on mount', async () => {
    const mockInstance = await vi.mocked(getPcaSingleton)();
    vi.mocked(getPcaSingleton).mockResolvedValue(mockInstance);

    render(React.createElement(AuthCallbackRoute));

    await waitFor(() => {
      expect(mockInstance.handleRedirectPromise).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates to /dashboard by default after redirect', async () => {
    render(React.createElement(AuthCallbackRoute));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('navigates to stored postLoginRedirect path', async () => {
    const store = new Map<string, string>();
    store.set('postLoginRedirect', '/schedules/week');
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(),
      get length() { return store.size; },
      key: vi.fn(),
    });

    render(React.createElement(AuthCallbackRoute));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/schedules/week', { replace: true });
    });
  });

  it('removes postLoginRedirect from sessionStorage after use', async () => {
    const store = new Map<string, string>();
    store.set('postLoginRedirect', '/some-path');
    const mockRemove = vi.fn((key: string) => store.delete(key));
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn(),
      removeItem: mockRemove,
      clear: vi.fn(),
      get length() { return store.size; },
      key: vi.fn(),
    });

    render(React.createElement(AuthCallbackRoute));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('postLoginRedirect');
    });
  });

  // ── error handling ───────────────────────────────────────────────

  it('navigates to /dashboard on error', async () => {
    const failingInstance = {
      handleRedirectPromise: vi.fn().mockRejectedValue(new Error('MSAL redirect failed')),
      getActiveAccount: vi.fn(() => null),
      getAllAccounts: vi.fn(() => []),
      setActiveAccount: vi.fn(),
    };
    vi.mocked(getPcaSingleton).mockResolvedValueOnce(failingInstance as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(React.createElement(AuthCallbackRoute));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('logs the error on failure', async () => {
    const error = new Error('MSAL hash parse failed');
    const failingInstance = {
      handleRedirectPromise: vi.fn().mockRejectedValue(error),
      getActiveAccount: vi.fn(() => null),
      getAllAccounts: vi.fn(() => []),
      setActiveAccount: vi.fn(),
    };
    vi.mocked(getPcaSingleton).mockResolvedValueOnce(failingInstance as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(React.createElement(AuthCallbackRoute));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
      const authErrors = errorSpy.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('[auth]'),
      );
      expect(authErrors.length).toBeGreaterThan(0);
    });
  });
});
