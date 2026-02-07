import { describe, expect, it } from 'vitest';
import {
    buildConflictIndex,
    DEFAULT_CONFLICT_RULES,
    detectScheduleConflicts,
    hasConflict,
    type ConflictRule,
} from './conflictChecker';
import { type Schedule } from './types';

// --- test helpers for Rule Engine API ---

function makeTestSchedule(params: {
  id: string;
  category: 'User' | 'Staff' | 'Org';
  start: string;
  end: string;
  personId?: string;
  staffIds?: string[];
}): Schedule {
  const base = {
    id: params.id,
    etag: 'test',
    category: params.category,
    title: `${params.category} Schedule`,
    start: params.start,
    end: params.end,
    allDay: false,
    status: '承認済み' as const,
  };

  if (params.category === 'User') {
    return {
      ...base,
      category: 'User',
      serviceType: '一時ケア',
      personType: 'Internal',
      personId: params.personId || 'U001',
      personName: `利用者${params.personId || 'U001'}`,
      staffIds: params.staffIds || ['ST001'],
      staffNames: ['職員A'],
    } as Schedule;
  }

  if (params.category === 'Staff') {
    return {
      ...base,
      category: 'Staff',
      subType: '会議',
      staffIds: params.staffIds || ['ST001'],
      staffNames: ['職員A'],
    } as Schedule;
  }

  return {
    ...base,
    category: 'Org',
    subType: '会議',
    audience: ['全職員'],
  } as Schedule;
}

describe('Rule Engine API', () => {
  describe('detectScheduleConflicts', () => {
    it('detects user-life-care-vs-support conflict', () => {
      const schedules = [
        makeTestSchedule({
          id: 'S1',
          category: 'User',
          personId: 'U001',
          start: '2025-01-01T09:00:00',
          end: '2025-01-01T10:00:00',
        }),
        makeTestSchedule({
          id: 'S2',
          category: 'User',
          personId: 'U001', // 同じ利用者
          start: '2025-01-01T09:30:00',
          end: '2025-01-01T10:30:00',
        }),
      ];

      const conflicts = detectScheduleConflicts(schedules);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe('user-life-care-vs-support');
      expect(new Set([conflicts[0].idA, conflicts[0].idB])).toEqual(new Set(['S1', 'S2']));
    });

    it('detects user-life-support-vs-support conflict', () => {
      const schedules = [
        makeTestSchedule({
          id: 'S1',
          category: 'User',
          personId: 'U001',
          start: '2025-01-01T09:00:00',
          end: '2025-01-01T10:00:00',
        }),
        makeTestSchedule({
          id: 'S2',
          category: 'User',
          personId: 'U002', // 異なる利用者
          start: '2025-01-01T09:30:00',
          end: '2025-01-01T10:30:00',
        }),
      ];

      const conflicts = detectScheduleConflicts(schedules);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe('user-life-support-vs-support');
    });

    it('detects staff-life-support-vs-staff conflict', () => {
      const schedules = [
        makeTestSchedule({
          id: 'S1',
          category: 'Staff',
          staffIds: ['ST001'],
          start: '2025-01-01T09:00:00',
          end: '2025-01-01T10:00:00',
        }),
        makeTestSchedule({
          id: 'S2',
          category: 'User',
          staffIds: ['ST001'], // 同じ職員
          start: '2025-01-01T09:30:00',
          end: '2025-01-01T10:30:00',
        }),
      ];

      const conflicts = detectScheduleConflicts(schedules);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe('staff-life-support-vs-staff');
    });

    it('allows custom rules injection', () => {
      // カスタムルール：Org categoryの重複チェック
      const detectOrgConflict: ConflictRule = (a, b) => {
        if (a.category === 'Org' && b.category === 'Org') {
          return {
            idA: a.id,
            idB: b.id,
            kind: 'org-resource-conflict',
            message: '会議室の重複予約です',
          };
        }
        return null;
      };

      const schedules = [
        makeTestSchedule({
          id: 'S1',
          category: 'Org',
          start: '2025-01-01T09:00:00',
          end: '2025-01-01T10:00:00',
        }),
        makeTestSchedule({
          id: 'S2',
          category: 'Org',
          start: '2025-01-01T09:30:00',
          end: '2025-01-01T10:30:00',
        }),
      ];

      // デフォルトルールでは検出されない
      const defaultConflicts = detectScheduleConflicts(schedules);
      expect(defaultConflicts).toHaveLength(0);

      // カスタムルールで検出される
      const customRules = [...DEFAULT_CONFLICT_RULES, detectOrgConflict];
      const customConflicts = detectScheduleConflicts(schedules, customRules);
      expect(customConflicts).toHaveLength(1);
      expect(customConflicts[0].kind).toBe('org-resource-conflict');
    });

    it('prevents duplicate conflicts for same pair', () => {
      const schedules = [
        makeTestSchedule({
          id: 'S1',
          category: 'User',
          personId: 'U001',
          start: '2025-01-01T09:00:00',
          end: '2025-01-01T12:00:00', // 長時間
        }),
        makeTestSchedule({
          id: 'S2',
          category: 'User',
          personId: 'U002',
          start: '2025-01-01T10:00:00',
          end: '2025-01-01T11:00:00', // 完全に含まれる
        }),
      ];

      const conflicts = detectScheduleConflicts(schedules);

      // 同じペアから複数重複が検出されても、1つにまとめられる
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe('user-life-support-vs-support');
    });
  });

  describe('buildConflictIndex', () => {
    it('creates index mapping scheduleId to conflicts', () => {
      const conflicts = [
        {
          idA: 'S1',
          idB: 'S2',
          kind: 'user-life-care-vs-support' as const,
          message: 'Test conflict',
        },
        {
          idA: 'S2',
          idB: 'S3',
          kind: 'staff-life-support-vs-staff' as const,
          message: 'Test conflict 2',
        },
      ];

      const index = buildConflictIndex(conflicts);

      expect(index['S1']).toHaveLength(1);
      expect(index['S2']).toHaveLength(2); // 2つの衝突に関わっている
      expect(index['S3']).toHaveLength(1);
      expect(index['S4']).toBeUndefined(); // 存在しない
    });
  });

  describe('hasConflict', () => {
    it('returns true for conflicted schedules', () => {
      const index = {
        'S1': [
          {
            idA: 'S1',
            idB: 'S2',
            kind: 'user-life-care-vs-support' as const,
            message: 'Test',
          }
        ],
        'S2': [
          {
            idA: 'S1',
            idB: 'S2',
            kind: 'user-life-care-vs-support' as const,
            message: 'Test',
          }
        ],
      };

      expect(hasConflict(index, 'S1')).toBe(true);
      expect(hasConflict(index, 'S2')).toBe(true);
      expect(hasConflict(index, 'S3')).toBe(false);
      expect(hasConflict(undefined, 'S1')).toBe(false);
    });
  });

  describe('Performance', () => {
    const perfTest = process.env.PERF_TEST === '1' ? it : it.skip;

    perfTest('handles large datasets efficiently', () => {
      const schedules: Schedule[] = [];
      const PERF_LIMIT_MS = process.env.CI ? 800 : 500;

      // 500個のスケジュールを生成（実運用レベル）
      for (let i = 0; i < 500; i++) {
        schedules.push(makeTestSchedule({
          id: `S${i}`,
          category: 'User',
          personId: `U${i % 50}`, // 50人の利用者で重複させる
          start: `2025-01-01T${String(Math.floor(i / 50)).padStart(2, '0')}:00:00`,
          end: `2025-01-01T${String(Math.floor(i / 50) + 1).padStart(2, '0')}:00:00`,
        }));
      }

      // Warm-up to avoid JIT/GC noise on the first call.
      detectScheduleConflicts(schedules);

      const startTime = performance.now();
      const conflicts = detectScheduleConflicts(schedules);
      const endTime = performance.now();

      // 500件で 500ms (local) / 800ms (CI) 以内に処理完了（実運用十分）
      expect(endTime - startTime).toBeLessThan(PERF_LIMIT_MS);
      expect(conflicts.length).toBeGreaterThan(0); // 何らかの衝突が検出される

      // ログで実際のパフォーマンスを確認
      console.log(`✨ Rule Engine Performance: ${Math.round(endTime - startTime)}ms for ${schedules.length} schedules (${conflicts.length} conflicts found)`);
    });
  });
});