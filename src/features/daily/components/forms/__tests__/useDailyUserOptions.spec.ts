import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IUserMaster } from '@/features/users/types';
import { useUsersStore } from '@/features/users/store';
import { useDailyUserOptions } from '../useDailyUserOptions';

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

describe('useDailyUserOptions', () => {
  beforeEach(() => {
    mockedUseUsersStore.mockReset();
  });

  it('active 判定が確定した利用者のみ options に含める', () => {
    mockedUseUsersStore.mockReturnValue({
      data: [
        makeUser({
          Id: 1,
          UserID: 'U-001',
          FullName: '利用中',
          Furigana: 'りようちゅう',
          IsActive: true,
          TransportAdditionType: 'none',
          MealAddition: 'none',
        }),
        makeUser({
          Id: 2,
          UserID: 'U-002',
          FullName: '契約終了',
          UsageStatus: '契約終了',
        }),
        makeUser({
          Id: 3,
          UserID: 'U-003',
          FullName: '判定不能',
          UsageStatus: null,
          IsActive: undefined,
          ServiceEndDate: null,
        }),
      ],
    } as ReturnType<typeof useUsersStore>);

    const { result } = renderHook(() => useDailyUserOptions());

    expect(result.current.options).toEqual([
      {
        id: 'U-001',
        lookupId: 1,
        label: '利用中',
        furigana: 'りようちゅう',
        transportAdditionType: 'none',
        mealAddition: 'none',
      },
    ]);
  });
});
