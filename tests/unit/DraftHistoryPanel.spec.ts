/**
 * @fileoverview DraftHistoryPanel テスト
 * @description
 * Phase 5-E1:
 *   - groupRecordsIntoBatches のバッチグルーピングロジック
 *   - 空レコード / 単一バッチ / 複数バッチの分離
 *   - ステータスカウント / 目標ラベル集約
 */
import { describe, expect, it } from 'vitest';

import type { SupportPlanningSheetRecord } from '@/features/monitoring/domain/supportPlanningSheetTypes';
import { groupRecordsIntoBatches } from '@/features/monitoring/components/DraftHistoryPanel';

// ── テスト用ヘルパー ─────────────────────────────────────────

function makeRecord(
  overrides: Partial<SupportPlanningSheetRecord> = {},
): SupportPlanningSheetRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    goalId: 'goal-1',
    goalLabel: '生活リズムの安定',
    decisionStatus: 'accepted',
    decisionNote: '',
    decisionBy: 'admin@example.com',
    decisionAt: '2026-03-15T10:00:00Z',
    recommendationLevel: 'adjust-support',
    snapshot: {
      level: 'adjust-support',
      reason: 'テスト理由',
      progressLevel: 'declining',
      rate: 0.3,
      trend: 'down',
      matchedRecordCount: 5,
      matchedTagCount: 3,
    },
    ...overrides,
  };
}

// ── テスト本体 ───────────────────────────────────────────────

describe('groupRecordsIntoBatches', () => {
  it('空配列からは空バッチ配列を返す', () => {
    expect(groupRecordsIntoBatches([])).toEqual([]);
  });

  it('同一時刻のレコードは1バッチにまとまる', () => {
    const t = '2026-03-15T10:00:00Z';
    const records = [
      makeRecord({ decisionAt: t, goalId: 'g1', goalLabel: 'A' }),
      makeRecord({ decisionAt: t, goalId: 'g2', goalLabel: 'B' }),
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches).toHaveLength(1);
    expect(batches[0].records).toHaveLength(2);
  });

  it('60秒以内のレコードは同一バッチになる', () => {
    const records = [
      makeRecord({ decisionAt: '2026-03-15T10:00:00Z' }),
      makeRecord({ decisionAt: '2026-03-15T10:00:30Z' }), // 30秒差
      makeRecord({ decisionAt: '2026-03-15T10:00:59Z' }), // 29秒差（合計59秒）
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches).toHaveLength(1);
    expect(batches[0].records).toHaveLength(3);
  });

  it('61秒以上離れると別バッチに分離される', () => {
    const records = [
      makeRecord({ decisionAt: '2026-03-15T10:00:00Z', goalLabel: 'A' }),
      makeRecord({ decisionAt: '2026-03-15T10:02:01Z', goalLabel: 'B' }), // 2分1秒後
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches).toHaveLength(2);
    expect(batches[0].records[0].goalLabel).toBe('B'); // 新しい方が先
    expect(batches[1].records[0].goalLabel).toBe('A');
  });

  it('バッチは降順にソートされる', () => {
    const records = [
      makeRecord({ decisionAt: '2026-03-15T08:00:00Z' }),
      makeRecord({ decisionAt: '2026-03-15T12:00:00Z' }),
      makeRecord({ decisionAt: '2026-03-15T10:00:00Z' }),
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches).toHaveLength(3);
    // 最新が先頭
    expect(new Date(batches[0].batchAt).getTime()).toBeGreaterThan(
      new Date(batches[1].batchAt).getTime(),
    );
    expect(new Date(batches[1].batchAt).getTime()).toBeGreaterThan(
      new Date(batches[2].batchAt).getTime(),
    );
  });

  it('statusCounts が正しく集計される', () => {
    const t = '2026-03-15T10:00:00Z';
    const records = [
      makeRecord({ decisionAt: t, decisionStatus: 'accepted' }),
      makeRecord({ decisionAt: t, decisionStatus: 'accepted' }),
      makeRecord({ decisionAt: t, decisionStatus: 'dismissed' }),
      makeRecord({ decisionAt: t, decisionStatus: 'deferred' }),
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches[0].statusCounts).toEqual({
      accepted: 2,
      dismissed: 1,
      deferred: 1,
      pending: 0,
    });
  });

  it('goalLabels が重複なく集約される', () => {
    const t = '2026-03-15T10:00:00Z';
    const records = [
      makeRecord({ decisionAt: t, goalLabel: 'A' }),
      makeRecord({ decisionAt: t, goalLabel: 'B' }),
      makeRecord({ decisionAt: t, goalLabel: 'A' }), // 重複
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches[0].goalLabels).toEqual(['A', 'B']);
  });

  it('batchId は先頭レコードの decisionAt', () => {
    const records = [
      makeRecord({ decisionAt: '2026-03-15T10:00:00Z' }),
      makeRecord({ decisionAt: '2026-03-15T10:00:30Z' }),
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches[0].batchId).toBe('2026-03-15T10:00:30Z'); // 降順なので新しい方
  });

  it('3バッチに分かれるケース', () => {
    const records = [
      // Batch 1 (latest)
      makeRecord({ decisionAt: '2026-03-15T15:00:00Z' }),
      makeRecord({ decisionAt: '2026-03-15T15:00:10Z' }),
      // Batch 2
      makeRecord({ decisionAt: '2026-03-15T10:00:00Z' }),
      // Batch 3 (oldest)
      makeRecord({ decisionAt: '2026-03-14T08:00:00Z' }),
      makeRecord({ decisionAt: '2026-03-14T08:00:20Z' }),
      makeRecord({ decisionAt: '2026-03-14T08:00:45Z' }),
    ];
    const batches = groupRecordsIntoBatches(records);
    expect(batches).toHaveLength(3);
    expect(batches[0].records).toHaveLength(2);
    expect(batches[1].records).toHaveLength(1);
    expect(batches[2].records).toHaveLength(3);
  });
});
