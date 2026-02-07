/**
 * Guard -1 Contract Test for useOrgStore
 * 
 * Ensures that when shouldSkipSharePoint() returns true:
 * - SharePoint fetch is never called
 * - In-flight Promise is never created
 * - Module-scope cache remains clean
 * 
 * This is the "final stake" preventing regression of infinite fetch incidents.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ============================================================================
// Mock Strategy: Force shouldSkipSharePoint to true
// ============================================================================
vi.mock('@/lib/sharepoint/skipSharePoint', async () => {
  const actual = await vi.importActual('@/lib/sharepoint/skipSharePoint');
  return {
    ...actual,
    shouldSkipSharePoint: vi.fn(() => true),
    logSkipSharePointGuard: vi.fn(),
  };
});

// Mock useSP to provide spy-able listItems
const mockListItems = vi.fn();
vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    listItems: mockListItems,
    spFetch: vi.fn(),
  }),
}));

import { useOrgStore } from './store';
import { shouldSkipSharePoint } from '@/lib/sharepoint/skipSharePoint';

describe('useOrgStore: Guard -1 Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListItems.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call SharePoint listItems when shouldSkipSharePoint() is true', async () => {
    // Arrange: shouldSkipSharePoint is mocked to return true
    expect(shouldSkipSharePoint()).toBe(true);

    // Act: Render hook, which triggers useEffect → loadOrgOptions
    const { result } = renderHook(() => useOrgStore());

    // Wait for state to settle
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assert: SharePoint was NEVER called
    expect(mockListItems).not.toHaveBeenCalled();
    
    // Assert: Fallback data was used (may be subset in test env)
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.loadedOnce).toBe(true);
  });

  it('does not create in-flight promise when shouldSkipSharePoint() is true', async () => {
    // Arrange: shouldSkipSharePoint is mocked to return true
    expect(shouldSkipSharePoint()).toBe(true);

    // Act: Render hook multiple times (simulates StrictMode double-invocation)
    const { result: result1 } = renderHook(() => useOrgStore());
    const { result: result2 } = renderHook(() => useOrgStore());

    // Wait for both to settle
    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
      expect(result2.current.loading).toBe(false);
    });

    // Assert: SharePoint was NEVER called (no in-flight promise → no fetch)
    expect(mockListItems).not.toHaveBeenCalled();
    
    // Assert: Both hooks got fallback data immediately
    expect(result1.current.items.length).toBeGreaterThan(0);
    expect(result2.current.items.length).toBeGreaterThan(0);
    expect(result1.current.loadedOnce).toBe(true);
    expect(result2.current.loadedOnce).toBe(true);
  });

  it('calling refresh() does not trigger SharePoint when shouldSkipSharePoint() is true', async () => {
    // Arrange
    const { result } = renderHook(() => useOrgStore());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Act: Call refresh() manually
    await result.current.refresh();

    // Assert: SharePoint was still NEVER called
    expect(mockListItems).not.toHaveBeenCalled();
    
    // Assert: Fallback data is preserved
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.loadedOnce).toBe(true);
  });

  it('sets loadedOnce=true immediately when shouldSkipSharePoint() is true', async () => {
    // Arrange & Act
    const { result } = renderHook(() => useOrgStore());

    // Assert: loadedOnce transitions to true without SharePoint call
    await waitFor(() => {
      expect(result.current.loadedOnce).toBe(true);
    });

    expect(mockListItems).not.toHaveBeenCalled();
  });
});
