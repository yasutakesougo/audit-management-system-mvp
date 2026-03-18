import { describe, expect, it } from 'vitest';
import type { RawActionSource } from '../models/queue.types';
import { buildTodayActionQueue } from '../engine/buildTodayActionQueue';

function source(overrides: Partial<RawActionSource>): RawActionSource {
  return {
    id: overrides.id ?? 'x',
    sourceType: overrides.sourceType ?? 'schedule',
    title: overrides.title ?? 'title',
    targetTime: overrides.targetTime,
    slaMinutes: overrides.slaMinutes,
    isCompleted: overrides.isCompleted ?? false,
    assignedStaffId: overrides.assignedStaffId,
    payload: overrides.payload ?? {},
  };
}

describe('buildTodayActionQueue', () => {
  it('[P0 Top Priority] P0 はどんな P2 よりも先頭に来る', () => {
    const now = new Date('2026-03-18T13:30:00');

    const result = buildTodayActionQueue([
      source({
        id: 'schedule-1',
        sourceType: 'schedule',
        title: '予定タスク',
        targetTime: new Date('2026-03-18T08:00:00'),
        slaMinutes: 15,
      }),
      source({
        id: 'vital-1',
        sourceType: 'vital_alert',
        title: 'バイタル異常',
      }),
    ], now);

    expect(result[0]?.id).toBe('vital-1');
    expect(result[0]?.priority).toBe('P0');
  });

  it('[Completion Filtering] 完了済みは結果から除外される', () => {
    const now = new Date('2026-03-18T12:00:00');

    const result = buildTodayActionQueue([
      source({
        id: 'done',
        sourceType: 'schedule',
        isCompleted: true,
      }),
      source({
        id: 'active',
        sourceType: 'schedule',
        isCompleted: false,
      }),
    ], now);

    expect(result.map((x) => x.id)).toEqual(['active']);
  });

  it('[Staff Allocation] 同点時は担当一致が先に来る', () => {
    const now = new Date('2026-03-18T12:00:00');

    const result = buildTodayActionQueue(
      [
        source({
          id: 'other',
          sourceType: 'schedule',
          assignedStaffId: 'staff-b',
          targetTime: undefined,
        }),
        source({
          id: 'mine',
          sourceType: 'schedule',
          assignedStaffId: 'staff-a',
          targetTime: undefined,
        }),
      ],
      now,
      'staff-a'
    );

    expect(result.map((x) => x.id)).toEqual(['mine', 'other']);
  });

  it('[Time Travel] now によって順序と overdue が変化する', () => {
    const sources = [
      source({
        id: 'task-1',
        sourceType: 'schedule',
        title: '13時予定',
        targetTime: new Date('2026-03-18T13:00:00'),
        slaMinutes: 15,
      }),
      source({
        id: 'task-2',
        sourceType: 'schedule',
        title: '15時予定',
        targetTime: new Date('2026-03-18T15:00:00'),
        slaMinutes: 15,
      }),
    ];

    const atNoon = buildTodayActionQueue(
      sources,
      new Date('2026-03-18T12:00:00')
    );

    const atSixteen = buildTodayActionQueue(
      sources,
      new Date('2026-03-18T16:00:00')
    );

    expect(atNoon[0]?.id).toBe('task-1');
    expect(atNoon.some((x) => x.isOverdue)).toBe(false);

    expect(atSixteen[0]?.id).toBe('task-1');
    expect(atSixteen[0]?.isOverdue).toBe(true);
    expect(atSixteen[1]?.isOverdue).toBe(true);
  });

  it('[SLA Escalation] 14:00完了済みなら 15:00 の SLA超過タスクが先頭化する', () => {
    const now = new Date('2026-03-18T15:15:00');

    const result = buildTodayActionQueue([
      source({
        id: 'done-1400',
        sourceType: 'schedule',
        title: '14:00予定',
        targetTime: new Date('2026-03-18T14:00:00'),
        slaMinutes: 15,
        isCompleted: true,
      }),
      source({
        id: 'task-1500',
        sourceType: 'schedule',
        title: '15:00予定',
        targetTime: new Date('2026-03-18T15:00:00'),
        slaMinutes: 10,
      }),
    ], now);

    expect(result.map((x) => x.id)).toEqual(['task-1500']);
    expect(result[0]?.isOverdue).toBe(true);
  });
});
