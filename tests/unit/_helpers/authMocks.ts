import { vi } from 'vitest';
import type { UseAuth } from '@/auth/useAuth';

/**
 * Creates a standard mock state for useAuth.
 * Standardizes isAuthReady and other auth properties to prevent type mismatches.
 */
export function createMockAuthState(overrides: Partial<UseAuth> = {}): UseAuth {
  return {
    isAuthenticated: false,
    isAuthReady: false,
    loading: true,
    shouldSkipLogin: false,
    account: null,
    tokenReady: false,
    getListReadyState: vi.fn(() => null),
    setListReadyState: vi.fn(),
    signIn: vi.fn(async () => ({ success: true })),
    signOut: vi.fn(async () => {}),
    acquireToken: vi.fn(async () => 'mock-token'),
    ...overrides,
  };
}

/**
 * Creates a mock state for a fully authenticated and ready user.
 */
export function mockAuthenticatedReadyUser(overrides: Partial<UseAuth> = {}): UseAuth {
  return createMockAuthState({
    isAuthenticated: true,
    isAuthReady: true,
    loading: false,
    tokenReady: true,
    account: {
      username: 'test@example.com',
      name: 'Test User',
      homeAccountId: 'test-home-id',
    },
    ...overrides,
  });
}

/**
 * Creates a mock state for an unauthenticated user who is done loading.
 */
export function mockUnauthenticatedUser(overrides: Partial<UseAuth> = {}): UseAuth {
  return createMockAuthState({
    isAuthenticated: false,
    isAuthReady: true, // auth check is done, but not authenticated
    loading: false,
    tokenReady: false,
    account: null,
    ...overrides,
  });
}
