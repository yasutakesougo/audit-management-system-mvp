import type { Schedule } from '@/lib/mappers';
import type { Staff } from '@/types';
import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../useOperationHubData';
import { markConflicts, toTimelineEvents } from '../timelineLogic';

const makeStaff = (overrides: Partial<Staff> = {}): Staff => ({
  id: overrides.id ?? 1,
  staffId: overrides.staffId ?? 'S001',
  name: overrides.name ?? '職員A',
  certifications: overrides.certifications ?? [],
  workDays: overrides.workDays ?? [],
  baseWorkingDays: overrides.baseWorkingDays ?? [],
  ...overrides,
});

const makeSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? 1,
  etag: overrides.etag ?? null,
  title: overrides.title ?? '予定',
  startUtc: overrides.startUtc ?? '2026-03-26T09:00:00.000Z',
  endUtc: overrides.endUtc ?? '2026-03-26T10:00:00.000Z',
  startLocal: overrides.startLocal ?? null,
  endLocal: overrides.endLocal ?? null,
  startDate: overrides.startDate ?? '2026-03-26',
  endDate: overrides.endDate ?? '2026-03-26',
  allDay: overrides.allDay ?? false,
  location: overrides.location ?? null,
  staffId: overrides.staffId ?? null,
  userId: overrides.userId ?? null,
  status: overrides.status ?? 'approved',
  notes: overrides.notes ?? null,
  recurrenceRaw: overrides.recurrenceRaw ?? null,
  category: overrides.category ?? null,
  serviceType: overrides.serviceType ?? null,
  personType: overrides.personType ?? null,
  staffIds: overrides.staffIds,
  staffNames: overrides.staffNames,
  dayPart: overrides.dayPart ?? null,
  billingFlags: overrides.billingFlags,
  targetUserIds: overrides.targetUserIds,
  targetUserNames: overrides.targetUserNames,
  relatedResourceIds: overrides.relatedResourceIds,
  relatedResourceNames: overrides.relatedResourceNames,
  rowKey: overrides.rowKey ?? null,
  dayKey: overrides.dayKey ?? null,
  monthKey: overrides.monthKey ?? null,
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  assignedStaffIds: overrides.assignedStaffIds,
  assignedStaffNames: overrides.assignedStaffNames,
  statusLabel: overrides.statusLabel,
});

describe('operation-hub timelineLogic', () => {
  describe('markConflicts', () => {
    it('marks only overlapping events as conflict', () => {
      const events: TimelineEvent[] = [
        {
          id: 'a',
          label: 'A',
          start: new Date('2026-03-26T09:00:00.000Z'),
          end: new Date('2026-03-26T10:00:00.000Z'),
          color: '#000000',
        },
        {
          id: 'b',
          label: 'B',
          start: new Date('2026-03-26T09:30:00.000Z'),
          end: new Date('2026-03-26T11:00:00.000Z'),
          color: '#000000',
        },
        {
          id: 'c',
          label: 'C',
          start: new Date('2026-03-26T11:00:00.000Z'),
          end: new Date('2026-03-26T12:00:00.000Z'),
          color: '#000000',
        },
      ];

      markConflicts(events);

      expect(events[0].conflict).toBe(true);
      expect(events[1].conflict).toBe(true);
      expect(events[2].conflict).toBeUndefined();
    });
  });

  describe('toTimelineEvents', () => {
    it('groups by employment, clamps by day bounds, applies colors, and marks overlaps', () => {
      const staffMap = new Map<number, Staff>([
        [1, makeStaff({ id: 1, name: '山田 常勤', role: '常勤' })],
        [2, makeStaff({ id: 2, name: '青木 管理者', role: '管理者' })],
        [3, makeStaff({ id: 3, name: '佐藤 パート', role: 'パート' })],
      ]);

      const schedules: Schedule[] = [
        makeSchedule({
          id: 10,
          title: '管理者ミーティング',
          staffId: 2,
          category: '来客',
          startUtc: '2026-03-26T13:00:00.000Z',
          endUtc: '2026-03-26T14:00:00.000Z',
        }),
        makeSchedule({
          id: 11,
          title: '朝訪問',
          staffId: 1,
          category: '生活介護',
          startUtc: '2026-03-26T09:00:00.000Z',
          endUtc: '2026-03-26T10:00:00.000Z',
        }),
        makeSchedule({
          id: 12,
          title: '重複訪問',
          staffId: 1,
          category: '送迎',
          startUtc: '2026-03-26T09:30:00.000Z',
          endUtc: '2026-03-26T10:30:00.000Z',
        }),
        makeSchedule({
          id: 13,
          title: '名前割当',
          staffNames: ['佐藤 パート'],
          category: 'イベント',
          startUtc: '2026-03-26T11:00:00.000Z',
          endUtc: '2026-03-26T12:00:00.000Z',
        }),
        makeSchedule({
          id: 14,
          title: '未割当予定',
          category: '不明カテゴリ',
          startUtc: '2026-03-26T12:00:00.000Z',
          endUtc: '2026-03-26T13:00:00.000Z',
        }),
        makeSchedule({
          id: 15,
          title: '日跨ぎ',
          staffId: 1,
          category: '生活介護',
          startUtc: '2026-03-25T23:30:00.000Z',
          endUtc: '2026-03-26T00:30:00.000Z',
        }),
        makeSchedule({
          id: 16,
          title: '不正データ',
          staffId: 1,
          startUtc: 'invalid',
          endUtc: 'invalid',
        }),
      ];

      const dayStart = new Date('2026-03-26T00:00:00.000Z');
      const dayEnd = new Date('2026-03-26T23:59:59.999Z');

      const resources = toTimelineEvents(schedules, staffMap, dayStart, dayEnd);

      expect(resources.map((resource) => resource.id)).toEqual([
        '施設長:2',
        '常勤:1',
        '非常勤:name:佐藤 パート',
        'その他:unassigned',
      ]);

      const fullTime = resources.find((resource) => resource.id === '常勤:1');
      expect(fullTime).toBeDefined();
      expect(fullTime?.groupLabel).toBe('常勤職員');
      expect(fullTime?.events.map((event) => event.id)).toEqual(['15-1', '11-1', '12-1']);
      expect(fullTime?.events[0].start.toISOString()).toBe('2026-03-26T00:00:00.000Z');
      expect(fullTime?.events[0].end.toISOString()).toBe('2026-03-26T00:30:00.000Z');
      expect(fullTime?.events[1].conflict).toBe(true);
      expect(fullTime?.events[2].conflict).toBe(true);
      expect(fullTime?.events[1].color).toBe('#0078D4');
      expect(fullTime?.events[2].color).toBe('#B146C2');

      const unassigned = resources.find((resource) => resource.id === 'その他:unassigned');
      expect(unassigned?.name).toBe('未割当');
      expect(unassigned?.groupLabel).toBe('その他リソース');
      expect(unassigned?.events).toHaveLength(1);
      expect(unassigned?.events[0].color).toBe('#605E5C');

      const allEventIds = resources.flatMap((resource) => resource.events.map((event) => event.id));
      expect(allEventIds).not.toContain('16-1');
    });
  });
});
