import { beforeEach, describe, expect, it } from 'vitest';

import type { ABCRecord } from '@/domain/behavior';
import { ABC_SYNC_FAILURES_KEY, recordAbcSyncFailure } from '../abcSyncPolicy';

function makeRecord(overrides: Partial<ABCRecord> = {}): ABCRecord {
  return {
    id: 'abc-1',
    userId: 'U-001',
    recordedAt: '2026-04-13T09:00:00.000Z',
    antecedent: '予定変更',
    antecedentTags: ['予定の変更'],
    behavior: '大声',
    consequence: '視覚提示',
    intensity: 3,
    ...overrides,
  };
}

describe('abcSyncPolicy', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ABC_SYNC_FAILURES_KEY);
  });

  it('A→B 同期失敗ログを localStorage に記録する', () => {
    recordAbcSyncFailure(makeRecord({ id: 'abc-1' }), new Error('sync failed'));

    const raw = window.localStorage.getItem(ABC_SYNC_FAILURES_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? '[]') as Array<{ id: string; error: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('abc-1');
    expect(parsed[0].error).toContain('sync failed');
  });
});
