import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDataProvider } from '@/lib/data/dataProvider.interface';

import { useRecordQualityRuntime } from './useRecordQualityRuntime';

const providerState = vi.hoisted(() => ({
  current: null as IDataProvider | null,
}));

vi.mock('@/lib/data/useDataProvider', () => ({
  useDataProvider: () => ({ provider: providerState.current, type: 'sharepoint' }),
}));

describe('useRecordQualityRuntime', () => {
  beforeEach(() => {
    providerState.current = createProvider();
  });

  it('keeps the same port instances while the data provider is unchanged', () => {
    const { result, rerender } = renderHook(() => useRecordQualityRuntime());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.reviewRepository).toBe(first.reviewRepository);
    expect(result.current.queueRepository).toBe(first.queueRepository);
  });

  it('rebuilds the port instances when the data provider changes', () => {
    const { result, rerender } = renderHook(() => useRecordQualityRuntime());
    const first = result.current;

    providerState.current = createProvider();
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current.reviewRepository).not.toBe(first.reviewRepository);
    expect(result.current.queueRepository).not.toBe(first.queueRepository);
  });
});

function createProvider(): IDataProvider {
  type Provider = IDataProvider;
  return {
    listItems: vi.fn(async <T,>() => [] as T[]) as Provider['listItems'],
    getItemById: vi.fn(async <T,>() => ({} as T)) as Provider['getItemById'],
    createItem: vi.fn(async <T,>() => ({} as T)) as Provider['createItem'],
    updateItem: vi.fn(async <T,>() => ({} as T)) as Provider['updateItem'],
    deleteItem: vi.fn(async () => undefined),
    getMetadata: vi.fn(async () => ({})),
    getResourceNames: vi.fn(async () => []),
    getFieldInternalNames: vi.fn(async () => new Set<string>()),
    ensureListExists: vi.fn(async () => undefined),
  };
}
