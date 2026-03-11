/**
 * mapSchedulesToTodayLanes — unit tests
 */
import { describe, expect, it } from 'vitest';
import type { MiniSchedule } from '@/features/schedules/hooks/useSchedulesToday';
import { mapSchedulesToTodayLanes } from './mapSchedulesToTodayLanes';

const makeMini = (overrides: Partial<MiniSchedule> & { id: number }): MiniSchedule => ({
  title: '予定',
  startText: '09:00',
  ...overrides,
});

describe('mapSchedulesToTodayLanes', () => {
  it('returns safe empty lanes when items is undefined', () => {
    const result = mapSchedulesToTodayLanes(undefined);
    expect(result).toEqual({ userLane: [], staffLane: [], organizationLane: [] });
  });

  it('returns safe empty lanes when items is null', () => {
    const result = mapSchedulesToTodayLanes(null);
    expect(result).toEqual({ userLane: [], staffLane: [], organizationLane: [] });
  });

  it('returns safe empty lanes when items is empty array', () => {
    const result = mapSchedulesToTodayLanes([]);
    expect(result).toEqual({ userLane: [], staffLane: [], organizationLane: [] });
  });

  it('maps real schedule data to thin today lanes', () => {
    const items: MiniSchedule[] = [
      makeMini({ id: 1, title: '朝のミーティング', startText: '09:00' }),
      makeMini({ id: 2, title: '昼食確認', startText: '12:00' }),
    ];

    const result = mapSchedulesToTodayLanes(items);

    expect(result.staffLane).toHaveLength(2);
    expect(result.staffLane[0]).toEqual({
      id: '1',
      time: '09:00',
      title: '朝のミーティング',
    });
    expect(result.staffLane[1]).toEqual({
      id: '2',
      time: '12:00',
      title: '昼食確認',
    });
    // userLane and organizationLane are empty (MiniSchedule has no category)
    expect(result.userLane).toEqual([]);
    expect(result.organizationLane).toEqual([]);
  });

  it('ordering is stable — sorted by time ascending', () => {
    const items: MiniSchedule[] = [
      makeMini({ id: 3, title: '退所対応', startText: '16:00' }),
      makeMini({ id: 1, title: '受付', startText: '09:00' }),
      makeMini({ id: 2, title: '昼食', startText: '12:00' }),
    ];

    const result = mapSchedulesToTodayLanes(items);
    const times = result.staffLane.map((l) => l.time);
    expect(times).toEqual(['09:00', '12:00', '16:00']);
  });

  it('filters out all-day events (no actionable start time)', () => {
    const items: MiniSchedule[] = [
      makeMini({ id: 1, title: '終日合宿', startText: '終日', allDay: true }),
      makeMini({ id: 2, title: '朝会', startText: '09:00' }),
    ];

    const result = mapSchedulesToTodayLanes(items);
    expect(result.staffLane).toHaveLength(1);
    expect(result.staffLane[0].title).toBe('朝会');
  });

  it('filters out items with fallback startText "—"', () => {
    const items: MiniSchedule[] = [
      makeMini({ id: 1, title: '時刻不明', startText: '—' }),
      makeMini({ id: 2, title: '09時の予定', startText: '09:30' }),
    ];

    const result = mapSchedulesToTodayLanes(items);
    expect(result.staffLane).toHaveLength(1);
    expect(result.staffLane[0].title).toBe('09時の予定');
  });

  it('missing optional fields do not break mapping', () => {
    const items: MiniSchedule[] = [
      { id: 5, title: '最小限', startText: '10:00' },
    ];

    const result = mapSchedulesToTodayLanes(items);
    expect(result.staffLane).toHaveLength(1);
    expect(result.staffLane[0]).toEqual({
      id: '5',
      time: '10:00',
      title: '最小限',
    });
  });

  it('provides fallback time when startText is missing', () => {
    const items: MiniSchedule[] = [
      { id: 6, title: 'ノータイム' } as MiniSchedule,
    ];

    // startText is undefined → mapped to '00:00'
    // But since '—' check uses strict equality, undefined passes through
    const result = mapSchedulesToTodayLanes(items);
    expect(result.staffLane).toHaveLength(1);
    expect(result.staffLane[0].time).toBe('00:00');
  });
});
