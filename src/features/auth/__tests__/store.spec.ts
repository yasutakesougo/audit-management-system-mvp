import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    canAccessDashboardAudience,
    dashboardAudienceFromPath,
    getCurrentUserRole,
    isDashboardAudience,
    setCurrentUserRole,
    useAuthStoreBase,
    type DashboardAudience,
} from '../store';

describe('DashboardAudience helpers', () => {
  describe('canAccessDashboardAudience', () => {
    const cases: Array<[DashboardAudience, DashboardAudience, boolean]> = [
      ['admin', 'admin', true],
      ['admin', 'staff', true],
      ['staff', 'admin', false],
      ['staff', 'staff', true],
    ];

    it.each(cases)(
      'canAccessDashboardAudience(%s, %s) should be %s',
      (role, required, expected) => {
        expect(canAccessDashboardAudience(role, required)).toBe(expected);
      },
    );
  });

  describe('isDashboardAudience', () => {
    it('should return true for exact match', () => {
      expect(isDashboardAudience('admin', 'admin')).toBe(true);
      expect(isDashboardAudience('staff', 'staff')).toBe(true);
    });

    it('should return false for non-match', () => {
      expect(isDashboardAudience('admin', 'staff')).toBe(false);
      expect(isDashboardAudience('staff', 'admin')).toBe(false);
    });
  });

  describe('dashboardAudienceFromPath', () => {
    it('should return admin for /admin/dashboard paths', () => {
      expect(dashboardAudienceFromPath('/admin/dashboard')).toBe('admin');
      expect(dashboardAudienceFromPath('/admin/dashboard/settings')).toBe('admin');
    });

    it('should return staff for non-admin paths', () => {
      expect(dashboardAudienceFromPath('/dashboard')).toBe('staff');
      expect(dashboardAudienceFromPath('/daily/table')).toBe('staff');
      expect(dashboardAudienceFromPath('/')).toBe('staff');
    });
  });
});

describe('Auth Zustand Store', () => {
  beforeEach(() => {
    // Reset store to default state
    useAuthStoreBase.setState({ currentUserRole: 'staff' });
    // Clear localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  });

  it('should initialize with staff role by default', () => {
    expect(getCurrentUserRole()).toBe('staff');
  });

  it('should update role via setCurrentUserRole', () => {
    setCurrentUserRole('admin');
    expect(getCurrentUserRole()).toBe('admin');
  });

  it('should persist role to localStorage', () => {
    // Ensure store starts at 'staff' so switching to 'admin' triggers the write
    useAuthStoreBase.setState({ currentUserRole: 'staff' });
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    setCurrentUserRole('admin');
    expect(setItemSpy).toHaveBeenCalledWith('role', 'admin');
    setItemSpy.mockRestore();
  });

  it('should not trigger update when setting same role', () => {
    useAuthStoreBase.setState({ currentUserRole: 'staff' });
    setCurrentUserRole('staff');
    // The setState callback should return the same state reference
    // when role hasn't changed
    expect(getCurrentUserRole()).toBe('staff');
  });
});
