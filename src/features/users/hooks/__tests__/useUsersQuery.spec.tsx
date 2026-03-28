import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserRepository } from '@/features/users/repositoryFactory';
import type { UserRepository } from '@/features/users/domain/UserRepository';
import { useUsersQuery } from '../useUsersQuery';

vi.mock('@/features/users/repositoryFactory', () => ({
  useUserRepository: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const makeWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'UseUsersQueryTestWrapper';
  return Wrapper;
};

describe('useUsersQuery', () => {
  const getAll = vi.fn();

  const repositoryStub: UserRepository = {
    getAll,
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    terminate: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserRepository).mockReturnValue(repositoryStub);
  });

  it('dedupes fetches when multiple consumers subscribe to the same query key', async () => {
    getAll.mockResolvedValue([
      { Id: 1, UserID: 'U-001', FullName: '山田 太郎', IsActive: true },
    ]);

    const wrapper = makeWrapper(createTestQueryClient());
    const { result } = renderHook(() => {
      const summaryUsers = useUsersQuery();
      const quickActionUsers = useUsersQuery();
      return { summaryUsers, quickActionUsers };
    }, { wrapper });

    await waitFor(() => {
      expect(result.current.summaryUsers.status).toBe('success');
      expect(result.current.quickActionUsers.status).toBe('success');
    });

    expect(getAll).toHaveBeenCalledTimes(1);
  });

  it('fetches independently when query params differ', async () => {
    getAll.mockResolvedValue([
      { Id: 1, UserID: 'U-001', FullName: '山田 太郎', IsActive: true },
    ]);

    const wrapper = makeWrapper(createTestQueryClient());
    const { result } = renderHook(() => {
      const allUsers = useUsersQuery();
      const activeOnlyUsers = useUsersQuery({ filters: { isActive: true } });
      return { allUsers, activeOnlyUsers };
    }, { wrapper });

    await waitFor(() => {
      expect(result.current.allUsers.status).toBe('success');
      expect(result.current.activeOnlyUsers.status).toBe('success');
    });

    expect(getAll).toHaveBeenCalledTimes(2);
    const callParams = getAll.mock.calls.map((call) => call[0]);
    expect(callParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        expect.objectContaining({
          filters: { isActive: true },
          signal: expect.any(AbortSignal),
        }),
      ]),
    );
  });
});
