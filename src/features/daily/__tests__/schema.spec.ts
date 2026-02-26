import { describe, expect, it } from 'vitest';
import { DailyRecordItemSchema, SharePointDailyRecordItemSchema } from '../schema';

describe('Daily Module Zod Schemas', () => {
  describe('SharePointDailyRecordItemSchema', () => {
    it('should parse a valid SharePoint item', () => {
      const raw = {
        Id: 101,
        Title: '2026-02-26',
        ReporterName: '田中 太郎',
        ReporterRole: '生活支援員',
        UserRowsJSON: JSON.stringify([
          {
            userId: 'U001',
            userName: '利用者A',
            amActivity: '散歩',
            pmActivity: '昼寝',
            lunchAmount: '完食',
            problemBehavior: { selfHarm: false, violence: false, loudVoice: true, pica: false, other: false },
            specialNotes: '元気でした',
          }
        ]),
        UserCount: 1,
        Created: '2026-02-26T10:00:00Z',
        Modified: '2026-02-26T10:05:00Z',
      };

      const result = SharePointDailyRecordItemSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.Id).toBe(101);
        expect(result.data.UserRowsJSON).toHaveLength(1);
      }
    });

    it('should handle missing fields with defaults', () => {
      const raw = {
        Id: 102,
        Title: '2026-02-27',
      };

      const result = SharePointDailyRecordItemSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ReporterName).toBe('');
        expect(result.data.UserRowsJSON).toEqual([]);
      }
    });

    it('should handle invalid JSON in UserRowsJSON gracefully', () => {
      const raw = {
        Id: 103,
        Title: '2026-02-28',
        UserRowsJSON: '{invalid json}',
      };

      const result = SharePointDailyRecordItemSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.UserRowsJSON).toEqual([]);
      }
    });
  });

  describe('DailyRecordItemSchema (Transformation)', () => {
    it('should transform SharePoint item to Domain model', () => {
      const raw = {
        Id: 201,
        Title: '2026-03-01',
        ReporterName: '佐藤 花子',
        ReporterRole: '看護師',
        UserRowsJSON: JSON.stringify([
          {
            userId: 'U002',
            userName: '利用者B',
            amActivity: '入浴',
            pmActivity: 'レク',
            lunchAmount: '半分',
            problemBehavior: { selfHarm: false, violence: false, loudVoice: false, pica: false, other: false },
            specialNotes: '',
          }
        ]),
        Created: '2026-03-01T09:00:00Z',
      };

      const result = DailyRecordItemSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('201');
        expect(result.data.date).toBe('2026-03-01');
        expect(result.data.reporter.name).toBe('佐藤 花子');
        expect(result.data.userRows).toHaveLength(1);
        expect(result.data.userRows[0].userName).toBe('利用者B');
      }
    });

    it('should fail if UserRowsJSON contains invalid user row data format during transformation', () => {
      const raw = {
        Id: 202,
        Title: '2026-03-02',
        UserRowsJSON: JSON.stringify([
          {
            userName: '利用者C', // userId is missing and required
          }
        ]),
      };

      // Since transformation uses .parse() on UserRowsJSON, it should fail
      expect(() => DailyRecordItemSchema.parse(raw)).toThrow();
    });
  });
});
