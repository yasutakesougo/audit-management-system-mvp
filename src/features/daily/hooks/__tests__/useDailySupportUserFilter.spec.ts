import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { IUserMaster } from '@/features/users/types';
import { useDailySupportUserFilter } from '../useDailySupportUserFilter';

const makeUser = (overrides: Partial<IUserMaster>): IUserMaster => ({
  Id: 1,
  UserID: 'U-001',
  FullName: '利用者A',
  ...overrides,
});

describe('useDailySupportUserFilter', () => {
  it('unknown 判定の利用者は常に除外する', () => {
    const users: IUserMaster[] = [
      makeUser({
        Id: 1,
        UserID: 'U-001',
        FullName: 'active user',
        IsActive: true,
        IsHighIntensitySupportTarget: true,
      }),
      makeUser({
        Id: 2,
        UserID: 'U-002',
        FullName: 'unknown user',
        UsageStatus: null,
        IsActive: undefined,
        ServiceEndDate: null,
        IsHighIntensitySupportTarget: true,
      }),
    ];

    const { result } = renderHook(() => useDailySupportUserFilter(users));

    // default: usageStatus=active, highIntensityOnly=true
    expect(result.current.filteredUsers.map((u) => u.UserID)).toEqual(['U-001']);

    // フィルタを "全て" に戻しても unknown は出さない
    act(() => {
      result.current.updateFilter({ usageStatus: '', highIntensityOnly: false });
    });
    expect(result.current.filteredUsers.map((u) => u.UserID)).toEqual(['U-001']);
  });
});
