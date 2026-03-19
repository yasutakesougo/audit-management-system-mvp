/**
 * filterCallLogs — pure filter function テスト
 *
 * 対象:
 *   - 条件なし → 全件返却
 *   - relatedUserNameQuery による部分一致フィルタ
 *   - onlyWithRelatedUser トグル
 *   - keyword 横断検索
 *   - 条件の組み合わせ（AND 結合）
 *   - 空配列入力
 *   - 大文字小文字区別なし
 */

import { describe, it, expect } from 'vitest';
import { filterCallLogs } from '../filterCallLogs';
import type { CallLog } from '@/domain/callLogs/schema';

// ─── テストデータ ─────────────────────────────────────────────────────────────

const BASE: Omit<CallLog, 'id' | 'subject' | 'callerName' | 'message' | 'relatedUserName' | 'relatedUserId'> = {
  callerOrg: '',
  targetStaffName: '山田太郎',
  receivedAt: '2026-03-19T10:00:00Z',
  receivedByName: 'テストユーザー',
  status: 'new',
  urgency: 'normal',
  needCallback: false,
  createdAt: '2026-03-19T10:00:00Z',
  updatedAt: '2026-03-19T10:00:00Z',
};

const LOGS: CallLog[] = [
  { ...BASE, id: '1', subject: '通院送迎の件', callerName: '鈴木一郎', message: '明日の送迎について', relatedUserId: 'U001', relatedUserName: '利用者A' },
  { ...BASE, id: '2', subject: '請求書確認', callerName: '佐藤花子', message: '2月分の請求について', relatedUserId: 'U002', relatedUserName: '利用者B' },
  { ...BASE, id: '3', subject: '面談日程調整', callerName: '田中次郎', message: '来週の面談希望', relatedUserId: undefined, relatedUserName: undefined },
  { ...BASE, id: '4', subject: '緊急連絡', callerName: '山本三郎', message: '体調不良の報告', relatedUserId: 'U001', relatedUserName: '利用者A' },
  { ...BASE, id: '5', subject: '書類提出', callerName: '高橋四郎', message: '契約更新書類', relatedUserId: 'U003', relatedUserName: '利用者C太郎' },
];

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('filterCallLogs', () => {
  // ── 条件なし ──

  it('should return all logs when no criteria are specified', () => {
    const result = filterCallLogs(LOGS, {});
    expect(result).toHaveLength(5);
  });

  it('should return all logs when criteria values are empty strings', () => {
    const result = filterCallLogs(LOGS, {
      relatedUserNameQuery: '',
      keyword: '',
      onlyWithRelatedUser: false,
    });
    expect(result).toHaveLength(5);
  });

  // ── 空入力 ──

  it('should return empty array for empty input', () => {
    const result = filterCallLogs([], { keyword: 'test' });
    expect(result).toHaveLength(0);
  });

  // ── relatedUserNameQuery ──

  it('should filter by relatedUserName partial match', () => {
    const result = filterCallLogs(LOGS, { relatedUserNameQuery: '利用者A' });
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(['1', '4']);
  });

  it('should be case-insensitive for relatedUserName', () => {
    // 日本語ではあまり意味はないが、動作保証
    const result = filterCallLogs(LOGS, { relatedUserNameQuery: '利用者a' });
    expect(result).toHaveLength(2);
  });

  it('should filter by partial relatedUserName', () => {
    const result = filterCallLogs(LOGS, { relatedUserNameQuery: 'C太郎' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('5');
  });

  it('should return empty when relatedUserNameQuery matches nothing', () => {
    const result = filterCallLogs(LOGS, { relatedUserNameQuery: '存在しない' });
    expect(result).toHaveLength(0);
  });

  // ── onlyWithRelatedUser ──

  it('should filter only logs with relatedUser when onlyWithRelatedUser=true', () => {
    const result = filterCallLogs(LOGS, { onlyWithRelatedUser: true });
    expect(result).toHaveLength(4); // id 1, 2, 4, 5
    expect(result.every((l) => !!l.relatedUserName)).toBe(true);
  });

  it('should include all logs when onlyWithRelatedUser=false', () => {
    const result = filterCallLogs(LOGS, { onlyWithRelatedUser: false });
    expect(result).toHaveLength(5);
  });

  // ── keyword ──

  it('should filter by keyword matching subject', () => {
    const result = filterCallLogs(LOGS, { keyword: '緊急' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });

  it('should filter by keyword matching callerName', () => {
    const result = filterCallLogs(LOGS, { keyword: '鈴木' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by keyword matching message', () => {
    const result = filterCallLogs(LOGS, { keyword: '送迎' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by keyword matching relatedUserName', () => {
    const result = filterCallLogs(LOGS, { keyword: '利用者B' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should filter by keyword matching targetStaffName', () => {
    const result = filterCallLogs(LOGS, { keyword: '山田太郎' });
    expect(result).toHaveLength(5); // 全件が山田太郎
  });

  // ── 条件組み合わせ（AND）──

  it('should combine relatedUserNameQuery and keyword (AND)', () => {
    const result = filterCallLogs(LOGS, {
      relatedUserNameQuery: '利用者A',
      keyword: '送迎',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should combine onlyWithRelatedUser and keyword (AND)', () => {
    const result = filterCallLogs(LOGS, {
      onlyWithRelatedUser: true,
      keyword: '請求',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should combine all three criteria (AND)', () => {
    const result = filterCallLogs(LOGS, {
      relatedUserNameQuery: '利用者A',
      onlyWithRelatedUser: true,
      keyword: '体調',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });

  // ── 元の配列を変更しないこと ──

  it('should not mutate the original array', () => {
    const original = [...LOGS];
    filterCallLogs(LOGS, { keyword: '送迎' });
    expect(LOGS).toEqual(original);
  });
});
