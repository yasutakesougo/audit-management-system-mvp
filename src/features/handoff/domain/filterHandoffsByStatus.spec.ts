import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../handoffTypes';
import {
  filterHandoffsByStatus,
  getFilteredCountInfo,
  type HandoffStatusFilter,
} from './filterHandoffsByStatus';

// ────────────────────────────────────────────────────────────
// テストデータ
// ────────────────────────────────────────────────────────────

function makeRecord(
  id: number,
  status: HandoffRecord['status'],
): HandoffRecord {
  return {
    id,
    title: `テスト申し送り ${id}`,
    status,
    userCode: `user-${id}`,
    userDisplayName: `ユーザー${id}`,
    category: '体調',
    severity: '通常',
    message: `テストメッセージ ${id}`,
    timeBand: '午前',
    createdAt: '2026-03-13T09:00:00.000+09:00',
    createdByName: 'テスト太郎',
    isDraft: false,
  };
}

const SAMPLE_RECORDS: HandoffRecord[] = [
  makeRecord(1, '未対応'),
  makeRecord(2, '対応中'),
  makeRecord(3, '対応済'),
  makeRecord(4, '確認済'),
  makeRecord(5, '未対応'),
  makeRecord(6, '完了'),
  makeRecord(7, '明日へ持越'),
];

// ────────────────────────────────────────────────────────────
// filterHandoffsByStatus
// ────────────────────────────────────────────────────────────

describe('filterHandoffsByStatus', () => {
  describe('filter = "all"', () => {
    it('全件を返す', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'all');
      expect(result).toHaveLength(7);
    });

    it('元の配列とは別インスタンスを返す', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'all');
      expect(result).not.toBe(SAMPLE_RECORDS);
    });

    it('元の順序を維持する', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'all');
      expect(result.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('filter = "actionRequired"', () => {
    it('未対応 + 対応中 のみ返す', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'actionRequired');
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.status)).toEqual(['未対応', '対応中', '未対応']);
    });

    it('対応済・確認済・完了・明日へ持越を除外する', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'actionRequired');
      const statuses = new Set(result.map((r) => r.status));
      expect(statuses.has('対応済')).toBe(false);
      expect(statuses.has('確認済')).toBe(false);
      expect(statuses.has('完了')).toBe(false);
      expect(statuses.has('明日へ持越')).toBe(false);
    });

    it('元の順序を維持する', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'actionRequired');
      expect(result.map((r) => r.id)).toEqual([1, 2, 5]);
    });
  });

  describe('filter = "pending"', () => {
    it('未対応のみ返す', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'pending');
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.status === '未対応')).toBe(true);
    });

    it('対応中も除外する', () => {
      const result = filterHandoffsByStatus(SAMPLE_RECORDS, 'pending');
      expect(result.map((r) => r.id)).toEqual([1, 5]);
    });
  });

  describe('エッジケース', () => {
    it('空配列にフィルタを適用しても空を返す', () => {
      const cases: HandoffStatusFilter[] = ['all', 'actionRequired', 'pending'];
      for (const f of cases) {
        expect(filterHandoffsByStatus([], f)).toEqual([]);
      }
    });

    it('全件が未対応のとき actionRequired で全件返す', () => {
      const allPending = [
        makeRecord(1, '未対応'),
        makeRecord(2, '未対応'),
      ];
      expect(filterHandoffsByStatus(allPending, 'actionRequired')).toHaveLength(2);
    });

    it('全件が完了のとき actionRequired は空を返す', () => {
      const allDone = [
        makeRecord(1, '完了'),
        makeRecord(2, '完了'),
      ];
      expect(filterHandoffsByStatus(allDone, 'actionRequired')).toHaveLength(0);
    });

    it('全件が完了のとき pending は空を返す', () => {
      const allDone = [
        makeRecord(1, '対応済'),
        makeRecord(2, '確認済'),
      ];
      expect(filterHandoffsByStatus(allDone, 'pending')).toHaveLength(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
// getFilteredCountInfo
// ────────────────────────────────────────────────────────────

describe('getFilteredCountInfo', () => {
  it('filter=all のとき isFiltered=false を返す', () => {
    const info = getFilteredCountInfo(7, 7, 'all');
    expect(info.isFiltered).toBe(false);
    expect(info.label).toBe('全7件');
  });

  it('フィルタ中で件数差があるとき isFiltered=true を返す', () => {
    const info = getFilteredCountInfo(7, 3, 'actionRequired');
    expect(info.isFiltered).toBe(true);
    expect(info.label).toBe('3件表示中（全7件）');
  });

  it('フィルタ中でも全件一致なら isFiltered=false', () => {
    const info = getFilteredCountInfo(3, 3, 'actionRequired');
    expect(info.isFiltered).toBe(false);
    expect(info.label).toBe('全3件');
  });

  it('0件の場合', () => {
    const info = getFilteredCountInfo(0, 0, 'pending');
    expect(info.isFiltered).toBe(false);
    expect(info.label).toBe('全0件');
  });
});
