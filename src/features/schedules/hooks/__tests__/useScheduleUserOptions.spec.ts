import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IUserMaster } from '@/features/users/types';
import { useUsersStore } from '@/features/users/store';
import { useScheduleUserOptions } from '../useScheduleUserOptions';

vi.mock('@/features/users/store', () => ({
  useUsersStore: vi.fn(),
}));

const mockedUseUsersStore = vi.mocked(useUsersStore);

const makeUser = (overrides: Partial<IUserMaster>): IUserMaster => ({
  Id: 1,
  UserID: 'U-001',
  FullName: '利用者A',
  ...overrides,
});

describe('useScheduleUserOptions', () => {
  beforeEach(() => {
    mockedUseUsersStore.mockReset();
  });

  it('active 判定が確定した利用者のみ候補に含める', () => {
    mockedUseUsersStore.mockReturnValue({
      data: [
        makeUser({ Id: 1, UserID: 'U-001', FullName: '利用中', IsActive: true }),
        makeUser({ Id: 2, UserID: 'U-002', FullName: '契約終了', UsageStatus: '契約終了' }),
        makeUser({ Id: 3, UserID: 'U-003', FullName: '判定不能', UsageStatus: null, IsActive: undefined, ServiceEndDate: null }),
      ],
    } as ReturnType<typeof useUsersStore>);

    const { result } = renderHook(() => useScheduleUserOptions());

    expect(result.current).toEqual([
      { id: 'U-001', name: '利用中', lookupId: '1' },
    ]);
  });
});
