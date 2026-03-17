/**
 * dailyAdapter — ユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { dailyToTimelineEvent } from '../adapters/dailyAdapter';
import type { PersonDaily, AxisDaily } from '@/domain/daily/types';

const makePersonDaily = (overrides: Partial<PersonDaily> = {}): PersonDaily => ({
  id: 1,
  userId: 'U001',
  userName: '田中太郎',
  date: '2026-03-15',
  status: '完了',
  reporter: { name: '佐藤', id: 'R001' },
  draft: { isDraft: false },
  kind: 'A',
  data: {
    amActivities: ['作業'],
    pmActivities: ['散歩'],
    specialNotes: '体調良好',
  },
  ...overrides,
});

const makeAxisDaily = (overrides: Partial<AxisDaily> = {}): AxisDaily => ({
  id: 2,
  userId: 'U001',
  userName: '田中太郎',
  date: '2026-03-15',
  status: '完了',
  reporter: { name: '佐藤', id: 'R001' },
  draft: { isDraft: false },
  kind: 'B',
  data: {
    proactive: ['挨拶'],
    skillSupports: ['手洗い'],
    tags: [],
    incidentRefIds: [],
    notes: '安定していた',
  },
  ...overrides,
});

describe('dailyToTimelineEvent', () => {
  it('A型レコードを変換: id, source, title が正しい', () => {
    const result = dailyToTimelineEvent(makePersonDaily());
    expect(result.id).toBe('daily-1');
    expect(result.source).toBe('daily');
    expect(result.userId).toBe('U001');
    expect(result.title).toBe('日次記録 (個人)');
    expect(result.severity).toBe('info');
    expect(result.sourceRef).toEqual({ id: 1 });
  });

  it('B型レコードを変換: title に「軸別」が含まれる', () => {
    const result = dailyToTimelineEvent(makeAxisDaily());
    expect(result.id).toBe('daily-2');
    expect(result.title).toBe('日次記録 (軸別)');
  });

  it('occurredAt は date に T00:00:00 を付加', () => {
    const result = dailyToTimelineEvent(makePersonDaily({ date: '2026-01-01' }));
    expect(result.occurredAt).toBe('2026-01-01T00:00:00');
  });

  it('A型: specialNotes が description に入る', () => {
    const result = dailyToTimelineEvent(makePersonDaily());
    expect(result.description).toBe('体調良好');
  });

  it('B型: notes が description に入る', () => {
    const result = dailyToTimelineEvent(makeAxisDaily());
    expect(result.description).toBe('安定していた');
  });

  it('description が空のときは undefined', () => {
    const result = dailyToTimelineEvent(
      makePersonDaily({
        data: { amActivities: [], pmActivities: [], specialNotes: '' },
      }),
    );
    expect(result.description).toBeUndefined();
  });

  it('meta に kind と status が含まれる', () => {
    const result = dailyToTimelineEvent(makePersonDaily());
    expect(result.meta).toEqual({ kind: 'A', status: '完了' });
  });
});
