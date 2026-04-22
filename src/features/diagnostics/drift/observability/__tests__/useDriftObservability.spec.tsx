import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { IDriftEventRepository } from '../../domain/DriftEventRepository';
import { useDriftObservability } from '../useDriftObservability';

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<any>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => ({}),
    ensureConfig: () => ({ baseUrl: 'https://dummy.sharepoint.com' }),
  };
});

vi.mock('../../infra/driftEventRepositoryFactory', () => ({
  useDriftEventRepository: () => null,
}));

const createRepository = (): IDriftEventRepository => ({
  logEvent: vi.fn(async () => {}),
  getEvents: vi.fn(async () => []),
  markResolved: vi.fn(async () => {}),
});

describe('useDriftObservability — effect stability', () => {
  it('calls repository.getEvents exactly once when nowProvider is omitted, even across re-renders', async () => {
    const repository = createRepository();

    const { rerender } = renderHook(() => useDriftObservability({ repository }));

    await waitFor(() => {
      expect(repository.getEvents).toHaveBeenCalledTimes(1);
    });

    rerender();
    rerender();
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(repository.getEvents).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when the caller passes a stable nowProvider reference', async () => {
    const repository = createRepository();
    const nowProvider = () => new Date('2026-04-20T00:00:00.000Z');

    const { rerender } = renderHook(() => useDriftObservability({ repository, nowProvider }));

    await waitFor(() => {
      expect(repository.getEvents).toHaveBeenCalledTimes(1);
    });

    rerender();
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(repository.getEvents).toHaveBeenCalledTimes(1);
  });
});
