import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataLayerGuard } from '@/components/DataLayerGuard';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';

// Mock the store to control currentProvider state
vi.mock('@/lib/data/dataProviderObservabilityStore', () => ({
  useDataProviderObservabilityStore: vi.fn(),
}));

describe('DataLayerGuard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render connecting UI when provider is not ready (null)', () => {
    // Stage: currentProvider = null
    (useDataProviderObservabilityStore as any).mockImplementation((selector: any) => selector({
      currentProvider: null
    }));

    render(
      <DataLayerGuard>
        <div data-testid="child-content">Ready!</div>
      </DataLayerGuard>
    );

    // Assert: Loading message is visible
    expect(screen.getByText(/データレイヤーに接続しています/)).toBeDefined();
    // Assert: Children are NOT rendered
    expect(screen.queryByTestId('child-content')).toBeNull();
  });

  it('should render children when provider is ready', () => {
    // Stage: currentProvider = 'local'
    (useDataProviderObservabilityStore as any).mockImplementation((selector: any) => selector({
      currentProvider: 'local'
    }));

    render(
      <DataLayerGuard>
        <div data-testid="child-content">Ready!</div>
      </DataLayerGuard>
    );

    // Assert: Loading message is GONE
    expect(screen.queryByText(/データレイヤーに接続しています/)).toBeNull();
    // Assert: Children ARE rendered
    expect(screen.getByTestId('child-content')).toBeDefined();
    expect(screen.getByText('Ready!')).toBeDefined();
  });
});
