import { describe, expect, it } from 'vitest';

import type { IUserMaster } from '@/features/users/types';
import {
  canEditUser,
  filterActiveUsers,
  hasLifecycleSignals,
  isUserExplicitlyActive,
  resolveUserLifecycleStatus,
} from '../userLifecycle';

const makeUser = (overrides: Partial<IUserMaster>): IUserMaster => ({
  Id: 1,
  UserID: 'U-001',
  FullName: 'テスト利用者',
  ...overrides,
});

describe('userLifecycle', () => {
  it('UsageStatus=契約終了 を terminated 判定する', () => {
    const user = makeUser({ UsageStatus: '契約終了' });
    expect(resolveUserLifecycleStatus(user)).toBe('terminated');
  });

  it('ServiceEndDate が過去日なら terminated 判定する', () => {
    const user = makeUser({
      UsageStatus: null,
      IsActive: null,
      ServiceEndDate: '2020-01-01',
    });
    expect(resolveUserLifecycleStatus(user)).toBe('terminated');
  });

  it('UsageStatus/IsActive/ServiceEndDate が欠落している場合は unknown', () => {
    const user = makeUser({
      UsageStatus: null,
      IsActive: undefined,
      ServiceEndDate: null,
    });
    expect(hasLifecycleSignals(user)).toBe(false);
    expect(resolveUserLifecycleStatus(user)).toBe('unknown');
    expect(isUserExplicitlyActive(user)).toBe(false);
  });

  it('active 判定は明示シグナルがあるユーザーのみ通す', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U-001', IsActive: true }),
      makeUser({ Id: 2, UserID: 'U-002', IsActive: false }),
      makeUser({ Id: 3, UserID: 'U-003', UsageStatus: '契約終了' }),
      makeUser({ Id: 4, UserID: 'U-004', UsageStatus: null, IsActive: undefined, ServiceEndDate: null }),
    ];

    const active = filterActiveUsers(users);
    expect(active.map((u) => u.UserID)).toEqual(['U-001']);
  });

  it('terminated は編集不可、unknown は編集可（停止のみ強制）', () => {
    expect(canEditUser(makeUser({ UsageStatus: '契約終了' }))).toBe(false);
    expect(
      canEditUser(
        makeUser({ UsageStatus: null, IsActive: undefined, ServiceEndDate: null }),
      ),
    ).toBe(true);
  });
});
