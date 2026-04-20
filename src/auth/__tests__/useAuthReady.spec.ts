import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthReady } from '../useAuthReady';
import { useAuth } from '../useAuth';

// Mock useAuth
vi.mock('../useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('useAuthReady pure contract', () => {
  it('SHOULD return false when NOT authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthReady: false,
    } as any);

    const { result } = renderHook(() => useAuthReady());
    expect(result.current).toBe(false);
  });

  it('SHOULD return true when authenticated and ready', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthReady: true,
    } as any);

    const { result } = renderHook(() => useAuthReady());
    expect(result.current).toBe(true);
  });
});
