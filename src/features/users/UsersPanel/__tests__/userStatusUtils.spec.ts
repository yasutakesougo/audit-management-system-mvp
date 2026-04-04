import { describe, expect, it } from 'vitest';
import type { IUserMaster } from '../../types';
import { getUserStatusChips, sortUsersByPriority } from '../userStatusUtils';

describe('userStatusUtils', () => {
  const baseUser: IUserMaster = {
    Id: 1,
    UserID: 'USR001',
    FullName: 'テスト 太郎',
    IsActive: true,
    UsageStatus: '利用中',
  };

  describe('getUserStatusChips', () => {
    it('should show "利用中" chip for active users', () => {
      const { visible } = getUserStatusChips(baseUser);
      expect(visible).toContainEqual(expect.objectContaining({ label: '利用中', priority: 1 }));
    });

    it('should show "強度行動" chip when IsHighIntensitySupportTarget is true', () => {
      const user = { ...baseUser, IsHighIntensitySupportTarget: true };
      const { visible } = getUserStatusChips(user);
      expect(visible).toContainEqual(expect.objectContaining({ label: '強度行動', priority: 2 }));
    });

    it('should show "重度" chip when severeFlag is true and IsHighIntensitySupportTarget is false', () => {
      const user = { ...baseUser, severeFlag: true, IsHighIntensitySupportTarget: false };
      const { visible } = getUserStatusChips(user);
      expect(visible).toContainEqual(expect.objectContaining({ label: '重度', priority: 2 }));
    });

    it('should prioritize "強度行動" over "重度" when both are true', () => {
      const user = { ...baseUser, severeFlag: true, IsHighIntensitySupportTarget: true };
      const { visible } = getUserStatusChips(user);
      expect(visible).toContainEqual(expect.objectContaining({ label: '強度行動' }));
      expect(visible).not.toContainEqual(expect.objectContaining({ label: '重度' }));
    });

    it('should show "支援手順" chip when IsSupportProcedureTarget is true', () => {
      const user = { ...baseUser, IsSupportProcedureTarget: true };
      const { visible } = getUserStatusChips(user);
      expect(visible).toContainEqual(expect.objectContaining({ label: '支援手順', priority: 3.5 }));
    });

    it('should show "強度行動" and "支援手順" chips together', () => {
      const user = { ...baseUser, IsHighIntensitySupportTarget: true, IsSupportProcedureTarget: true };
      const { visible } = getUserStatusChips(user);
      expect(visible.map(c => c.label)).toContain('強度行動');
      expect(visible.map(c => c.label)).toContain('支援手順');
    });

    it('should handle overflow when too many chips are present', () => {
      const now = new Date('2024-04-01');
      const user: IUserMaster = {
        ...baseUser,
        IsHighIntensitySupportTarget: true,
        IsSupportProcedureTarget: true,
        GrantPeriodEnd: '2024-04-05', // Critical urgency (priority 3)
      };
      
      const { visible, overflow } = getUserStatusChips(user, now);
      
      // Priorities: Util(1), HighIntensity(2), Critical(3), SupportProcedure(3.5)
      // Visible (max 3): Util, HighIntensity, Expiry
      // Overflow: SupportProcedure
      expect(visible.map(c => c.label)).toEqual(['利用中', '強度行動', '期限7日']);
      expect(overflow.map(c => c.label)).toEqual(['支援手順']);
    });
  });

  describe('sortUsersByPriority', () => {
    const now = new Date('2024-04-01');
    const u1: IUserMaster = { ...baseUser, Id: 1, UserID: 'B', IsHighIntensitySupportTarget: false };
    const u2: IUserMaster = { ...baseUser, Id: 2, UserID: 'A', IsHighIntensitySupportTarget: true };

    it('should sort High Intensity users before regular users', () => {
      const sorted = sortUsersByPriority([u1, u2], now);
      expect(sorted[0].Id).toBe(2);
      expect(sorted[1].Id).toBe(1);
    });

    it('should sort expired users before High Intensity users', () => {
      const u3: IUserMaster = { ...u1, Id: 3, GrantPeriodEnd: '2024-03-31' }; // Expired
      const sorted = sortUsersByPriority([u2, u3], now);
      expect(sorted[0].Id).toBe(3);
      expect(sorted[1].Id).toBe(2);
    });
  });
});
