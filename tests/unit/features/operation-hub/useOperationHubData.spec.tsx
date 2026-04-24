import { renderHook } from '@testing-library/react';
import { useOperationHubData, TimelineEvent } from '@/features/operation-hub/useOperationHubData';
import { toTimelineEvents, markConflicts } from '@/features/operation-hub/logic/timelineLogic';
import { classifyEmployment } from '@/features/operation-hub/logic/groupingLogic';
import { useSchedules } from '@/features/schedules/store';
import { useUsers } from '@/features/users/store';
import { useStaff } from '@/features/staff/store';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Schedule } from '@/lib/mappers';
import type { Staff } from '@/types';

// モック化
vi.mock('@/features/schedules/store');
vi.mock('@/features/users/store');
vi.mock('@/features/staff/store');
vi.mock('@/lib/spClient', () => ({
  useSP: vi.fn(),
}));

const mockDate = new Date('2026-03-25T12:00:00Z');

describe('OperationHub: useOperationHubData & pure functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    // デフォルトの基本モック戻り値
    vi.mocked(useSchedules).mockReturnValue({
      data: [],
      error: undefined,
      loading: false,
      isValidating: false,
      reload: vi.fn(),
    } as any);
    vi.mocked(useUsers).mockReturnValue({ data: [], loading: false, error: undefined, isValidating: false, reload: vi.fn() } as any);
    vi.mocked(useStaff).mockReturnValue({ data: [], loading: false, error: undefined, isValidating: false, reload: vi.fn() } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- 1. pure functions (classifyEmployment, markConflicts, toTimelineEvents) ---

  describe('pure functions', () => {
    it('🛡️ フォールバック: 役職 role 未入力でもクラッシュせず「その他」等にフォールバックすること', () => {
      expect(classifyEmployment(undefined)).toBe('その他');
      expect(classifyEmployment({ id: 1, role: '' } as Staff)).toBe('その他');
      expect(classifyEmployment({ id: 2, role: '施設長' } as Staff)).toBe('施設長');
      expect(classifyEmployment({ id: 3, role: '常勤' } as Staff)).toBe('常勤');
      expect(classifyEmployment({ id: 4, employmentType: 'パート' } as Staff)).toBe('非常勤');
    });

    it('🟡 境界条件: スケジュールの端がピッタリ重なる場合 (end === next.start) は conflict = false (undefined) になること', () => {
      // markConflicts は destructive 関数で events 配列が start 順にソートされている前提で動作する
      const events: TimelineEvent[] = [
        { id: '1', label: '午前', start: new Date('2026-03-25T12:00:00Z'), end: new Date('2026-03-25T13:00:00Z'), color: '' },
        { id: '2', label: '午後', start: new Date('2026-03-25T13:00:00Z'), end: new Date('2026-03-25T14:00:00Z'), color: '' },
      ];
      markConflicts(events);
      // 端接触はコンフリクトしない既存の安全な仕様の固定化
      expect(events[0].conflict).toBeUndefined();
      expect(events[1].conflict).toBeUndefined();
    });

    it('🟢 正常系: 担当者未割当のスケジュールが「未割当 (unassigned)」グループに集約されること', () => {
      const schedules: Schedule[] = [
        {
          id: 1,
          title: '送迎',
          startLocal: '2026-03-25T09:00:00',
          endLocal: '2026-03-25T10:00:00',
          staffId: undefined,
          staffNames: [],
        } as unknown as Schedule,
      ];
      
      const dayStart = new Date('2026-03-25T00:00:00Z');
      const dayEnd = new Date('2026-03-25T23:59:59Z');
      const staffMap = new Map<number, Staff>();
      
      const resources = toTimelineEvents(schedules, staffMap, dayStart, dayEnd);
      
      expect(resources).toHaveLength(1);
      expect(resources[0].id).toContain('unassigned');
      expect(resources[0].name).toBe('未割当');
      expect(resources[0].events).toHaveLength(1);
    });

    it('🟢 正常系: 適切なスケジュール・職員データを与えたとき、正しくマッピングされコンフリクトがないこと', () => {
      const schedules: Schedule[] = [
        {
          id: 1,
          title: '個別対応',
          startLocal: '2026-03-25T09:00:00',
          endLocal: '2026-03-25T10:00:00',
          staffId: 101, // valid staff
        } as unknown as Schedule,
        {
          id: 2,
          title: '記録',
          startLocal: '2026-03-25T10:30:00',       // no overlap
          endLocal: '2026-03-25T11:00:00',
          staffId: 101,
        } as unknown as Schedule,
      ];

      const staffMap = new Map<number, Staff>([
        [101, { id: 101, name: '職員A', role: '常勤' } as Staff]
      ]);

      const dayStart = new Date('2026-03-25T00:00:00Z');
      const dayEnd = new Date('2026-03-25T23:59:59Z');

      const resources = toTimelineEvents(schedules, staffMap, dayStart, dayEnd);

      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('職員A');
      expect(resources[0].employmentType).toBe('常勤');
      expect(resources[0].events).toHaveLength(2);
      // No overlaps, no conflicts
      expect(resources[0].events[0].conflict).toBeUndefined();
      expect(resources[0].events[1].conflict).toBeUndefined();
    });
  });

  // --- 2. Hook level integration ---
  
  describe('useOperationHubData() Hook Integration', () => {
    it('⚪ 空データ: 当日の予定が0件の場合、エラーにならず timeline が null として返却されること', async () => {
      // hooks (useSchedules) already mock-return [] by default in beforeEach
      const { result } = renderHook(() => useOperationHubData());

      // Ready checks
      expect(result.current.loading).toBe(false);
      expect(result.current.ready).toBe(true);

      // 既存仕様: 0件の場合は null になる
      expect(result.current.timeline).toBeNull();
      expect(result.current.unassignedSchedules).toHaveLength(0);
    });
  });
});
