/**
 * computeHandoffSummary 純粋関数のユニットテスト
 *
 * Phase 9: useHandoffSummary から分離された集計ロジックのテスト
 */
import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../handoffTypes';
import { computeHandoffSummary } from '../useHandoffSummary';

// ── ヘルパー ──

function createRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 1,
    title: 'テスト申し送り',
    message: 'テスト内容',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: 'その他',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdAt: new Date().toISOString(),
    createdByName: 'テスト太郎',
    isDraft: false,
    ...overrides,
  };
}

// ── テスト ──

describe('computeHandoffSummary', () => {
  it('空配列のとき、すべてゼロのサマリーを返す', () => {
    const result = computeHandoffSummary([]);

    expect(result.total).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.byStatus['未対応']).toBe(0);
    expect(result.byStatus['対応中']).toBe(0);
    expect(result.byStatus['対応済']).toBe(0);
    expect(result.byStatus['確認済']).toBe(0);
    expect(result.byStatus['明日へ持越']).toBe(0);
    expect(result.byStatus['完了']).toBe(0);
  });

  it('ステータスごとに正しくカウントする', () => {
    const items = [
      createRecord({ id: 1, status: '未対応' }),
      createRecord({ id: 2, status: '未対応' }),
      createRecord({ id: 3, status: '対応中' }),
      createRecord({ id: 4, status: '対応済' }),
      createRecord({ id: 5, status: '確認済' }),
      createRecord({ id: 6, status: '明日へ持越' }),
      createRecord({ id: 7, status: '完了' }),
    ];

    const result = computeHandoffSummary(items);

    expect(result.total).toBe(7);
    expect(result.byStatus['未対応']).toBe(2);
    expect(result.byStatus['対応中']).toBe(1);
    expect(result.byStatus['対応済']).toBe(1);
    expect(result.byStatus['確認済']).toBe(1);
    expect(result.byStatus['明日へ持越']).toBe(1);
    expect(result.byStatus['完了']).toBe(1);
  });

  it('重要 × 未完了 のレコードのみ criticalCount にカウントする', () => {
    const items = [
      createRecord({ id: 1, severity: '重要', status: '未対応' }),   // critical ✓
      createRecord({ id: 2, severity: '重要', status: '対応中' }),   // critical ✓
      createRecord({ id: 3, severity: '重要', status: '完了' }),     // terminal → ✗
      createRecord({ id: 4, severity: '重要', status: '対応済' }),   // terminal → ✗
      createRecord({ id: 5, severity: '通常', status: '未対応' }),   // 通常 → ✗
      createRecord({ id: 6, severity: '要注意', status: '未対応' }), // 要注意 → ✗
    ];

    const result = computeHandoffSummary(items);

    expect(result.criticalCount).toBe(2);
  });

  it('カテゴリ別に正しくカウントする', () => {
    const items = [
      createRecord({ id: 1, category: '体調' }),
      createRecord({ id: 2, category: '体調' }),
      createRecord({ id: 3, category: '行動面' }),
      createRecord({ id: 4, category: '家族連絡' }),
      createRecord({ id: 5, category: '支援の工夫' }),
      createRecord({ id: 6, category: '良かったこと' }),
      createRecord({ id: 7, category: '事故・ヒヤリ' }),
      createRecord({ id: 8, category: 'その他' }),
    ];

    const result = computeHandoffSummary(items);

    expect(result.byCategory['体調']).toBe(2);
    expect(result.byCategory['行動面']).toBe(1);
    expect(result.byCategory['家族連絡']).toBe(1);
    expect(result.byCategory['支援の工夫']).toBe(1);
    expect(result.byCategory['良かったこと']).toBe(1);
    expect(result.byCategory['事故・ヒヤリ']).toBe(1);
    expect(result.byCategory['その他']).toBe(1);
  });

  it('total は入力配列の長さと一致する', () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      createRecord({ id: i + 1 })
    );

    const result = computeHandoffSummary(items);

    expect(result.total).toBe(15);
  });

  // ── P6: sourceType 別集計 ──

  it('sourceType 別に正しくカウントする', () => {
    const items = [
      createRecord({ id: 1, sourceType: 'regulatory-finding' }),
      createRecord({ id: 2, sourceType: 'regulatory-finding' }),
      createRecord({ id: 3, sourceType: 'severe-addon-finding' }),
      createRecord({ id: 4, sourceType: 'meeting-minutes' }),
      createRecord({ id: 5, sourceType: 'meeting-minutes' }),
      createRecord({ id: 6, sourceType: 'meeting-minutes' }),
      createRecord({ id: 7 }), // sourceType なし → manual
    ];

    const result = computeHandoffSummary(items);

    expect(result.bySourceType.regulatoryFinding).toBe(2);
    expect(result.bySourceType.severeAddonFinding).toBe(1);
    expect(result.bySourceType.meetingMinutes).toBe(3);
    expect(result.bySourceType.manual).toBe(1);
  });

  it('sourceType が undefined のとき manual にカウントする', () => {
    const items = [
      createRecord({ id: 1 }),
      createRecord({ id: 2 }),
    ];

    const result = computeHandoffSummary(items);

    expect(result.bySourceType.manual).toBe(2);
    expect(result.bySourceType.regulatoryFinding).toBe(0);
  });

  it('空配列のとき bySourceType もすべてゼロ', () => {
    const result = computeHandoffSummary([]);

    expect(result.bySourceType.regulatoryFinding).toBe(0);
    expect(result.bySourceType.severeAddonFinding).toBe(0);
    expect(result.bySourceType.meetingMinutes).toBe(0);
    expect(result.bySourceType.manual).toBe(0);
  });
});
