/**
 * groupHandoffsByPriority — テスト
 *
 * 以下のケースを網羅:
 * 1. 空配列 → []
 * 2. 全件対応済 → []
 * 3. 重要/要注意/通常が混在 → 3グループ（重要→要注意→通常の順）
 * 4. 1グループのみ → そのグループだけ
 * 5. excludeId で Hero 表示中の1件を除外
 * 6. 対応中も含まれる
 * 7. 各グループ内は createdAt 昇順
 * 8. getActionableCount が正しい件数を返す
 */

import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../../handoffTypes';
import { getActionableCount, groupHandoffsByPriority } from '../groupHandoffsByPriority';

// ─── テストデータファクトリ ─────────────────────────────────

function makeRecord(
  overrides: Partial<HandoffRecord> & { id: number },
): HandoffRecord {
  return {
    title: `申し送り${overrides.id}`,
    message: `テストメッセージ${overrides.id}`,
    userCode: 'U001',
    userDisplayName: '利用者A',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '朝',
    createdAt: '2026-03-19T09:00:00.000Z',
    createdByName: '職員A',
    isDraft: false,
    ...overrides,
  };
}

// ─── テスト ─────────────────────────────────────────────────

describe('groupHandoffsByPriority', () => {
  it('空配列 → []', () => {
    expect(groupHandoffsByPriority([])).toEqual([]);
  });

  it('null → []', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(groupHandoffsByPriority(null as any)).toEqual([]);
  });

  it('全件対応済 → []', () => {
    const records = [
      makeRecord({ id: 1, status: '対応済' }),
      makeRecord({ id: 2, status: '完了' }),
    ];
    expect(groupHandoffsByPriority(records)).toEqual([]);
  });

  it('重要/要注意/通常が混在 → 3グループ（重要→要注意→通常の順）', () => {
    const records = [
      makeRecord({ id: 1, severity: '通常', status: '未対応' }),
      makeRecord({ id: 2, severity: '要注意', status: '未対応' }),
      makeRecord({ id: 3, severity: '重要', status: '未対応' }),
    ];
    const groups = groupHandoffsByPriority(records);
    expect(groups).toHaveLength(3);
    expect(groups[0].severity).toBe('重要');
    expect(groups[0].icon).toBe('🔴');
    expect(groups[1].severity).toBe('要注意');
    expect(groups[1].icon).toBe('🟡');
    expect(groups[2].severity).toBe('通常');
    expect(groups[2].icon).toBe('📝');
  });

  it('1グループのみ → そのグループだけ', () => {
    const records = [
      makeRecord({ id: 1, severity: '要注意', status: '未対応' }),
      makeRecord({ id: 2, severity: '要注意', status: '対応中' }),
    ];
    const groups = groupHandoffsByPriority(records);
    expect(groups).toHaveLength(1);
    expect(groups[0].severity).toBe('要注意');
    expect(groups[0].records).toHaveLength(2);
  });

  it('excludeId で Hero 表示中の1件を除外', () => {
    const records = [
      makeRecord({ id: 1, severity: '重要', status: '未対応' }),
      makeRecord({ id: 2, severity: '重要', status: '未対応' }),
      makeRecord({ id: 3, severity: '通常', status: '未対応' }),
    ];
    const groups = groupHandoffsByPriority(records, 1);
    // id: 1 が除外されるので重要グループは1件だけ
    const criticalGroup = groups.find((g) => g.severity === '重要');
    expect(criticalGroup).toBeDefined();
    expect(criticalGroup!.records).toHaveLength(1);
    expect(criticalGroup!.records[0].id).toBe(2);
  });

  it('対応中も含まれる', () => {
    const records = [
      makeRecord({ id: 1, severity: '通常', status: '対応中' }),
      makeRecord({ id: 2, severity: '通常', status: '対応済' }),
    ];
    const groups = groupHandoffsByPriority(records);
    expect(groups).toHaveLength(1);
    expect(groups[0].records).toHaveLength(1);
    expect(groups[0].records[0].id).toBe(1); // 対応中のみ
  });

  it('各グループ内は createdAt 昇順', () => {
    const records = [
      makeRecord({
        id: 1,
        severity: '重要',
        status: '未対応',
        createdAt: '2026-03-19T12:00:00.000Z',
      }),
      makeRecord({
        id: 2,
        severity: '重要',
        status: '未対応',
        createdAt: '2026-03-19T08:00:00.000Z',
      }),
      makeRecord({
        id: 3,
        severity: '重要',
        status: '未対応',
        createdAt: '2026-03-19T10:00:00.000Z',
      }),
    ];
    const groups = groupHandoffsByPriority(records);
    expect(groups[0].records.map((r) => r.id)).toEqual([2, 3, 1]); // 古い→新しい
  });

  it('excludeId が存在しない ID でも安全', () => {
    const records = [
      makeRecord({ id: 1, severity: '通常', status: '未対応' }),
    ];
    const groups = groupHandoffsByPriority(records, 999);
    expect(groups).toHaveLength(1);
    expect(groups[0].records).toHaveLength(1);
  });
});

describe('getActionableCount', () => {
  it('空配列 → 0', () => {
    expect(getActionableCount([])).toBe(0);
  });

  it('未対応 + 対応中の件数を返す', () => {
    const records = [
      makeRecord({ id: 1, status: '未対応' }),
      makeRecord({ id: 2, status: '対応中' }),
      makeRecord({ id: 3, status: '対応済' }),
      makeRecord({ id: 4, status: '完了' }),
    ];
    expect(getActionableCount(records)).toBe(2);
  });

  it('excludeId を除外した件数を返す', () => {
    const records = [
      makeRecord({ id: 1, status: '未対応' }),
      makeRecord({ id: 2, status: '未対応' }),
    ];
    expect(getActionableCount(records, 1)).toBe(1);
  });
});
