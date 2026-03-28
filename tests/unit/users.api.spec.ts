import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../src/features/users/domain/UserRepository';
import type { IUserMaster, IUserMasterCreateDto } from '../../src/sharepoint/fields';

// ---------------------------------------------------------------------------
// Mock repository — useUsersApi now delegates to UserRepository via factory
// ---------------------------------------------------------------------------

const mockRepo: {
  [K in keyof UserRepository]: ReturnType<typeof vi.fn>;
} = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  terminate: vi.fn(),
  remove: vi.fn(),
};

vi.mock('../../src/features/users/repositoryFactory', () => ({
  useUserRepository: () => mockRepo,
}));

import { useUsersApi } from '../../src/features/users/api';

describe('useUsersApi (repository-backed)', () => {
  beforeEach(() => {
    Object.values(mockRepo).forEach((fn) => fn.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getUsers delegates to repo.getAll', async () => {
    const rowsMock: IUserMaster[] = [{ Id: 1, UserID: '1', FullName: 'User A' } as IUserMaster];
    mockRepo.getAll.mockResolvedValueOnce(rowsMock);
    const { result } = renderHook(() => useUsersApi());

    const rows = await result.current.getUsers(undefined, { top: 25 });

    expect(rows).toEqual(rowsMock);
    expect(mockRepo.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ top: 25 }),
    );
  });

  it('getUserById delegates to repo.getById', async () => {
    mockRepo.getById.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useUsersApi());

    const user = await result.current.getUserById(42);

    expect(user).toBeNull();
    expect(mockRepo.getById).toHaveBeenCalledWith(42);
  });

  it('createUser delegates to repo.create', async () => {
    const created = { Id: 9, FullName: 'Created User' } as IUserMaster;
    mockRepo.create.mockResolvedValueOnce(created);
    const { result } = renderHook(() => useUsersApi());

    const dto: IUserMasterCreateDto = {
      FullName: 'Created User',
      IsHighIntensitySupportTarget: true,
      ServiceStartDate: '2025-01-02',
    };

    const res = await result.current.createUser(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(res).toEqual(created);
  });

  it('updateUser delegates to repo.update', async () => {
    const updated = { Id: 5, FullName: 'Updated' } as IUserMaster;
    mockRepo.update.mockResolvedValueOnce(updated);
    const { result } = renderHook(() => useUsersApi());

    const patch: Partial<IUserMasterCreateDto> = { FullName: 'Updated' };
    const res = await result.current.updateUser(5, patch);

    expect(mockRepo.update).toHaveBeenCalledWith(5, patch);
    expect(res).toEqual(updated);
  });

  it('deleteUser delegates to repo.remove', async () => {
    mockRepo.remove.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUsersApi());

    await result.current.deleteUser(12);

    expect(mockRepo.remove).toHaveBeenCalledWith(12);
  });

  it('terminateUser delegates to repo.terminate', async () => {
    const terminated = { Id: 7, FullName: 'Terminated User' } as IUserMaster;
    mockRepo.terminate.mockResolvedValueOnce(terminated);
    const { result } = renderHook(() => useUsersApi());

    const res = await result.current.terminateUser(7);

    expect(mockRepo.terminate).toHaveBeenCalledWith(7);
    expect(res).toEqual(terminated);
  });
});
