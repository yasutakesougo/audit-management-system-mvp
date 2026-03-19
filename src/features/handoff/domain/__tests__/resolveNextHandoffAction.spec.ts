/**
 * resolveNextHandoffAction — テスト
 *
 * 以下のケースを網羅:
 * 1. 空配列 → null
 * 2. 全件対応済 → null
 * 3. 重要1件のみ → reason: critical
 * 4. 要注意1件のみ → reason: caution
 * 5. 通常1件のみ → reason: normal
 * 6. 複数未対応(混在) → 重要が優先
 * 7. 同ランク内は古い方が先
 * 8. 対応中は対象外
 * 9. 下書き(isDraft)でも未対応なら対象
 */

import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../../handoffTypes';
import { resolveNextHandoffAction } from '../resolveNextHandoffAction';

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

describe('resolveNextHandoffAction', () => {
  it('空配列 → null', () => {
    expect(resolveNextHandoffAction([])).toBeNull();
  });

  it('null/undefined → null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolveNextHandoffAction(null as any)).toBeNull();
  });

  it('全件対応済 → null', () => {
    const records = [
      makeRecord({ id: 1, status: '対応済' }),
      makeRecord({ id: 2, status: '完了' }),
      makeRecord({ id: 3, status: '確認済' }),
    ];
    expect(resolveNextHandoffAction(records)).toBeNull();
  });

  it('重要1件のみ → reason: critical', () => {
    const records = [makeRecord({ id: 1, severity: '重要', status: '未対応' })];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('critical');
    expect(result!.record.id).toBe(1);
  });

  it('要注意1件のみ → reason: caution', () => {
    const records = [makeRecord({ id: 1, severity: '要注意', status: '未対応' })];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('caution');
  });

  it('通常1件のみ → reason: normal', () => {
    const records = [makeRecord({ id: 1, severity: '通常', status: '未対応' })];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('normal');
  });

  it('複数未対応(混在) → 重要が優先', () => {
    const records = [
      makeRecord({ id: 1, severity: '通常', status: '未対応' }),
      makeRecord({ id: 2, severity: '要注意', status: '未対応' }),
      makeRecord({ id: 3, severity: '重要', status: '未対応' }),
    ];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.record.id).toBe(3);
    expect(result!.reason).toBe('critical');
  });

  it('同ランク内は古い方が先', () => {
    const records = [
      makeRecord({
        id: 1,
        severity: '要注意',
        status: '未対応',
        createdAt: '2026-03-19T10:00:00.000Z', // 新しい
      }),
      makeRecord({
        id: 2,
        severity: '要注意',
        status: '未対応',
        createdAt: '2026-03-19T08:00:00.000Z', // 古い
      }),
    ];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.record.id).toBe(2); // 古い方
  });

  it('対応中は対象外', () => {
    const records = [
      makeRecord({ id: 1, severity: '重要', status: '対応中' }),
      makeRecord({ id: 2, severity: '通常', status: '未対応' }),
    ];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.record.id).toBe(2); // 対応中は除外
    expect(result!.reason).toBe('normal');
  });

  it('下書きでも未対応なら対象', () => {
    const records = [
      makeRecord({ id: 1, severity: '重要', status: '未対応', isDraft: true }),
    ];
    const result = resolveNextHandoffAction(records);
    expect(result).not.toBeNull();
    expect(result!.record.id).toBe(1);
  });
});
