import { describe, expect, it } from 'vitest';
import { SpUserMasterItemSchema, UserMasterDomainSchema } from '../schema';

describe('Users Module Zod Schemas', () => {
  describe('SpUserMasterItemSchema', () => {
    it('should parse a valid SharePoint user item', () => {
      const raw = {
        Id: 1,
        Title: '利用者A',
        UserID: 'U-001',
        FullName: '利用者A',
        Furigana: 'りようしゃあ',
        FullNameKana: 'リヨウシャア',
        ContractDate: '2024-01-01',
        ServiceStartDate: '2024-01-01',
        IsActive: true,
        AttendanceDays: '月,火,水',
        TransportToDays: ['月', '火'],
        UsageStatus: '利用中',
      };

      const result = SpUserMasterItemSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AttendanceDays).toEqual(['月', '火', '水']);
        expect(result.data.TransportToDays).toEqual(['月', '火']);
      }
    });

    it('should handle nullish fields with defaults', () => {
      const raw = {
        Id: 2,
        Title: '職員A',
      };

      const result = SpUserMasterItemSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.UserID).toBe('');
        expect(result.data.FullName).toBe('');
        expect(result.data.AttendanceDays).toEqual([]);
        expect(result.data.IsActive).toBe(true);
      }
    });
  });

  describe('UserMasterDomainSchema (Transformation)', () => {
    it('should transform SharePoint item to Domain model', () => {
      const raw = {
        Id: 10,
        UserID: 'U-010',
        FullName: '佐藤 太郎',
        AttendanceDays: '月,水,金',
        IsHighIntensitySupportTarget: true,
      };

      const result = UserMasterDomainSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.Id).toBe(10);
        expect(result.data.UserID).toBe('U-010');
        expect(result.data.AttendanceDays).toEqual(['月', '水', '金']);
        expect(result.data.IsHighIntensitySupportTarget).toBe(true);
        expect(result.data.IsActive).toBe(true); // default
      }
    });

    it('should normalize attendance days correctly', () => {
      const raw = {
        Id: 11,
        AttendanceDays: '月 、 火 \n 水', // complex string
      };

      const result = UserMasterDomainSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AttendanceDays).toEqual(['月', '火', '水']);
      }
    });
  });
});
