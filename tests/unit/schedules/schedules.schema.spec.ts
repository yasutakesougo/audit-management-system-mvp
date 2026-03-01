/**
 * Schedules schema — inclusion & parse tests
 *
 * Verifies:
 * - Core ⊂ Detail ⊂ Full (field inclusion)
 * - Required fields are enforced
 * - Enum values validate correctly
 * - Create/Update input schemas match domain expectations
 */

import {
    CreateScheduleInputSchema,
    ScheduleCategorySchema,
    ScheduleCoreSchema,
    ScheduleDetailSchema,
    ScheduleFullSchema,
    ScheduleStatusSchema,
    ScheduleVisibilitySchema,
    UpdateScheduleInputSchema,
} from '@/features/schedules/domain/schema';
import { describe, expect, it } from 'vitest';

const validCore = {
  id: 'sched-001',
  title: '朝のミーティング',
  start: '2026-03-01T09:00:00+09:00',
  end: '2026-03-01T10:00:00+09:00',
  etag: '"v1"',
};

const validDetail = {
  ...validCore,
  category: 'User' as const,
  visibility: 'team' as const,
  userId: 'u-001',
  personName: '田中太郎',
  assignedStaffId: 's-001',
  status: 'Planned' as const,
  serviceType: 'absence',
  notes: 'テストメモ',
};

const validFull = {
  ...validDetail,
  source: 'sharepoint' as const,
  updatedAt: '2026-03-01T09:00:00+09:00',
  createdAt: '2026-02-28T08:00:00+09:00',
  entryHash: 'abc123',
  ownerUserId: 'owner-001',
  staffNames: ['田中太郎', '佐藤花子'],
};

describe('Schedules Schema', () => {
  describe('Core ⊂ Detail ⊂ Full inclusion', () => {
    it('Core parses minimal required fields', () => {
      const result = ScheduleCoreSchema.safeParse(validCore);
      expect(result.success).toBe(true);
    });

    it('Detail parses Core + assignment/approval fields', () => {
      const result = ScheduleDetailSchema.safeParse(validDetail);
      expect(result.success).toBe(true);
    });

    it('Full parses Detail + metadata fields', () => {
      const result = ScheduleFullSchema.safeParse(validFull);
      expect(result.success).toBe(true);
    });

    it('Core data passes Detail parse (Detail ⊃ Core)', () => {
      const result = ScheduleDetailSchema.safeParse(validCore);
      expect(result.success).toBe(true);
    });

    it('Core data passes Full parse (Full ⊃ Core)', () => {
      const result = ScheduleFullSchema.safeParse(validCore);
      expect(result.success).toBe(true);
    });
  });

  describe('required fields', () => {
    it('rejects missing id', () => {
      const { id: _, ...noId } = validCore;
      expect(ScheduleCoreSchema.safeParse(noId).success).toBe(false);
    });

    it('rejects missing title', () => {
      const { title: _, ...noTitle } = validCore;
      expect(ScheduleCoreSchema.safeParse(noTitle).success).toBe(false);
    });

    it('rejects missing start', () => {
      const { start: _, ...noStart } = validCore;
      expect(ScheduleCoreSchema.safeParse(noStart).success).toBe(false);
    });

    it('rejects missing end', () => {
      const { end: _, ...noEnd } = validCore;
      expect(ScheduleCoreSchema.safeParse(noEnd).success).toBe(false);
    });

    it('rejects missing etag', () => {
      const { etag: _, ...noEtag } = validCore;
      expect(ScheduleCoreSchema.safeParse(noEtag).success).toBe(false);
    });
  });

  describe('enum validation', () => {
    it('accepts valid visibility values', () => {
      expect(ScheduleVisibilitySchema.safeParse('org').success).toBe(true);
      expect(ScheduleVisibilitySchema.safeParse('team').success).toBe(true);
      expect(ScheduleVisibilitySchema.safeParse('private').success).toBe(true);
    });

    it('rejects invalid visibility', () => {
      expect(ScheduleVisibilitySchema.safeParse('public').success).toBe(false);
    });

    it('accepts valid category values', () => {
      expect(ScheduleCategorySchema.safeParse('User').success).toBe(true);
      expect(ScheduleCategorySchema.safeParse('Staff').success).toBe(true);
      expect(ScheduleCategorySchema.safeParse('Org').success).toBe(true);
    });

    it('accepts valid status values', () => {
      expect(ScheduleStatusSchema.safeParse('Planned').success).toBe(true);
      expect(ScheduleStatusSchema.safeParse('Postponed').success).toBe(true);
      expect(ScheduleStatusSchema.safeParse('Cancelled').success).toBe(true);
    });
  });

  describe('CreateScheduleInputSchema', () => {
    it('validates a complete create input', () => {
      const input = {
        title: '新規予定',
        category: 'User',
        startLocal: '2026-03-01T10:00',
        endLocal: '2026-03-01T11:00',
      };
      expect(CreateScheduleInputSchema.safeParse(input).success).toBe(true);
    });

    it('rejects missing required fields', () => {
      expect(CreateScheduleInputSchema.safeParse({}).success).toBe(false);
      expect(CreateScheduleInputSchema.safeParse({ title: 'x' }).success).toBe(false);
    });
  });

  describe('UpdateScheduleInputSchema', () => {
    it('requires id in addition to create fields', () => {
      const input = {
        id: 'sched-001',
        title: '更新済み',
        category: 'Staff',
        startLocal: '2026-03-01T10:00',
        endLocal: '2026-03-01T11:00',
        etag: '"v2"',
      };
      expect(UpdateScheduleInputSchema.safeParse(input).success).toBe(true);
    });

    it('rejects without id', () => {
      const input = {
        title: '更新済み',
        category: 'Staff',
        startLocal: '2026-03-01T10:00',
        endLocal: '2026-03-01T11:00',
      };
      expect(UpdateScheduleInputSchema.safeParse(input).success).toBe(false);
    });
  });
});
