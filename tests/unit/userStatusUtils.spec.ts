import type { IUserMaster } from '@/features/users/types';
import {
    getGrantPeriodUrgency,
    getUserStatusChips,
    isUserInactive,
    sortUsersByPriority,
} from '@/features/users/UsersPanel/userStatusUtils';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helper: minimal user factory
// ---------------------------------------------------------------------------
const makeUser = (overrides: Partial<IUserMaster> = {}): IUserMaster => ({
  Id: 1,
  UserID: 'U-001',
  FullName: 'Test User',
  ...overrides,
});

const daysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// getGrantPeriodUrgency
// ---------------------------------------------------------------------------
describe('getGrantPeriodUrgency', () => {
  it('returns "unknown" when GrantPeriodEnd is null/undefined', () => {
    expect(getGrantPeriodUrgency(makeUser())).toBe('unknown');
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: null }))).toBe('unknown');
  });

  it('returns "expired" when date is in the past', () => {
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: '2020-01-01' }))).toBe('expired');
  });

  it('returns "critical" when ≤ 7 days', () => {
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: daysFromNow(3) }))).toBe('critical');
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: daysFromNow(7) }))).toBe('critical');
  });

  it('returns "warning" when 8-30 days', () => {
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: daysFromNow(15) }))).toBe('warning');
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: daysFromNow(30) }))).toBe('warning');
  });

  it('returns "ok" when > 30 days', () => {
    expect(getGrantPeriodUrgency(makeUser({ GrantPeriodEnd: daysFromNow(60) }))).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// isUserInactive
// ---------------------------------------------------------------------------
describe('isUserInactive', () => {
  it('returns true when IsActive is false', () => {
    expect(isUserInactive(makeUser({ IsActive: false }))).toBe(true);
  });

  it('returns true when UsageStatus is 契約終了', () => {
    expect(isUserInactive(makeUser({ UsageStatus: '契約終了' }))).toBe(true);
  });

  it('returns true when UsageStatus is 利用休止中', () => {
    expect(isUserInactive(makeUser({ UsageStatus: '利用休止中' }))).toBe(true);
  });

  it('returns false for active user', () => {
    expect(isUserInactive(makeUser({ IsActive: true, UsageStatus: '利用中' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUserStatusChips
// ---------------------------------------------------------------------------
describe('getUserStatusChips', () => {
  it('always includes usage status chip', () => {
    const { visible } = getUserStatusChips(makeUser());
    expect(visible.length).toBeGreaterThan(0);
    expect(visible[0].label).toBe('利用中');
    expect(visible[0].color).toBe('success');
  });

  it('shows 休止 for inactive user', () => {
    const { visible } = getUserStatusChips(makeUser({ IsActive: false }));
    expect(visible[0].label).toBe('休止');
    expect(visible[0].color).toBe('default');
  });

  it('shows 重度 chip when severeFlag is true', () => {
    const { visible } = getUserStatusChips(makeUser({ severeFlag: true }));
    expect(visible.some((c) => c.label === '重度')).toBe(true);
  });

  it('shows urgency chip when grant period is near', () => {
    const { visible } = getUserStatusChips(makeUser({ GrantPeriodEnd: daysFromNow(5) }));
    expect(visible.some((c) => c.label === '期限7日')).toBe(true);
  });

  it('shows CORE chip when __selectMode is core', () => {
    const { visible } = getUserStatusChips(makeUser({ __selectMode: 'core' }));
    expect(visible.some((c) => c.label === 'CORE')).toBe(true);
  });

  it('does not show selectMode chip when full', () => {
    const { visible } = getUserStatusChips(makeUser({ __selectMode: 'full' }));
    expect(visible.some((c) => c.label === 'FULL')).toBe(false);
  });

  it('limits visible chips to 3, puts rest in overflow', () => {
    const user = makeUser({
      severeFlag: true,
      GrantPeriodEnd: daysFromNow(5),
      __selectMode: 'core',
    });
    const { visible, overflow } = getUserStatusChips(user);
    expect(visible.length).toBe(3);
    expect(overflow.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// sortUsersByPriority
// ---------------------------------------------------------------------------
describe('sortUsersByPriority', () => {
  it('puts expired grant period first', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U-001', GrantPeriodEnd: daysFromNow(60) }),
      makeUser({ Id: 2, UserID: 'U-002', GrantPeriodEnd: '2020-01-01' }),
    ];
    const sorted = sortUsersByPriority(users);
    expect(sorted[0].UserID).toBe('U-002');
  });

  it('puts core selectMode before full', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U-001', __selectMode: 'full' }),
      makeUser({ Id: 2, UserID: 'U-002', __selectMode: 'core' }),
    ];
    const sorted = sortUsersByPriority(users);
    expect(sorted[0].UserID).toBe('U-002');
  });

  it('puts severe before non-severe at same priority', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U-001', severeFlag: false }),
      makeUser({ Id: 2, UserID: 'U-002', severeFlag: true }),
    ];
    const sorted = sortUsersByPriority(users);
    expect(sorted[0].UserID).toBe('U-002');
  });

  it('pushes inactive to bottom', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U-001', IsActive: false }),
      makeUser({ Id: 2, UserID: 'U-002', IsActive: true }),
    ];
    const sorted = sortUsersByPriority(users);
    expect(sorted[0].UserID).toBe('U-002');
  });

  it('tie-breaks by UserID then Id', () => {
    const users = [
      makeUser({ Id: 2, UserID: 'U-002' }),
      makeUser({ Id: 1, UserID: 'U-001' }),
    ];
    const sorted = sortUsersByPriority(users);
    expect(sorted[0].UserID).toBe('U-001');
    expect(sorted[1].UserID).toBe('U-002');
  });
});
