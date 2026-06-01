import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { clearAllFieldsCache } from '@/lib/sp/helpers';
import { DataLayerStatusBanner } from '../DataLayerStatusBanner';

vi.mock('@/lib/sp/helpers', () => ({
  clearAllFieldsCache: vi.fn(),
}));

describe('DataLayerStatusBanner', () => {
  const reload = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { reload },
      writable: true,
      configurable: true,
    });

    act(() => {
      useDataProviderObservabilityStore.setState({
        currentProvider: 'sharepoint',
        resolutions: {
          'BillingOrders:List3': {
            resourceName: 'BillingOrders:List3',
            status: 'schema_warning',
            severity: 'warn',
            resolvedTitle: 'List3',
            fields: [
              {
                key: 'paymentStatus',
                candidates: ['PaymentStatus'],
                isEssential: false,
                isResolved: false,
                isSilent: false,
              },
            ],
            lastAccessedAt: '2026-06-01T00:00:00.000Z',
          },
        },
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    act(() => {
      useDataProviderObservabilityStore.setState({
        currentProvider: null,
        resolutions: {},
      });
    });
  });

  it('clears SharePoint field cache before reloading from a schema warning', () => {
    render(<DataLayerStatusBanner />);

    fireEvent.click(screen.getByRole('button', { name: '再読込' }));

    expect(clearAllFieldsCache).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});
