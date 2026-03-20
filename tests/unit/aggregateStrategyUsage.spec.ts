/**
 * aggregateStrategyUsage — Unit Tests
 *
 * Phase C-3a の集計土台テスト。
 * C-3b 以降の拡張時にもリグレッション検知の基盤となる。
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateStrategyUsage,
  getUsageCount,
  getCategoryTotal,
  compareStrategyUsage,
} from '@/domain/isp/aggregateStrategyUsage';

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

function makeRecord(
  recordedAt: string,
  strategies?: Array<{
    strategyKey: 'antecedent' | 'teaching' | 'consequence';
    strategyText: string;
    applied: boolean;
  }>,
) {
  return { recordedAt, referencedStrategies: strategies };
}

// ─────────────────────────────────────────────
// aggregateStrategyUsage
// ─────────────────────────────────────────────

describe('aggregateStrategyUsage', () => {
  // ── 基本ケース ──

  it('空配列 → 全カウント 0', () => {
    const result = aggregateStrategyUsage([]);
    expect(result.totalApplications).toBe(0);
    expect(result.recordsWithStrategies).toBe(0);
    expect(result.antecedent.size).toBe(0);
    expect(result.teaching.size).toBe(0);
    expect(result.consequence.size).toBe(0);
  });

  it('referencedStrategies なしのレコードは無視', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00'),
      makeRecord('2026-03-16T10:00:00+09:00', undefined),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.totalApplications).toBe(0);
    expect(result.recordsWithStrategies).toBe(0);
  });

  it('referencedStrategies が空配列のレコードは無視', () => {
    const records = [makeRecord('2026-03-15T10:00:00+09:00', [])];
    const result = aggregateStrategyUsage(records);
    expect(result.totalApplications).toBe(0);
    expect(result.recordsWithStrategies).toBe(0);
  });

  // ── applied フィルタ ──

  it('applied=false の戦略は数えない', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: false },
        { strategyKey: 'teaching', strategyText: '代替行動の練習', applied: false },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.totalApplications).toBe(0);
    expect(result.recordsWithStrategies).toBe(0);
  });

  it('applied=true のみカウント（mixed ケース）', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'antecedent', strategyText: '事前予告', applied: false },
        { strategyKey: 'teaching', strategyText: '代替行動の練習', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.totalApplications).toBe(2);
    expect(result.recordsWithStrategies).toBe(1);
    expect(result.antecedent.get('環境調整')).toBe(1);
    expect(result.antecedent.has('事前予告')).toBe(false);
    expect(result.teaching.get('代替行動の練習')).toBe(1);
  });

  // ── カテゴリ分類 ──

  it('3カテゴリに正しく分類される', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'teaching', strategyText: '代替行動の練習', applied: true },
        { strategyKey: 'consequence', strategyText: '即座に称賛', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.antecedent.size).toBe(1);
    expect(result.teaching.size).toBe(1);
    expect(result.consequence.size).toBe(1);
    expect(result.totalApplications).toBe(3);
  });

  // ── 同一テキスト合算 ──

  it('同一カテゴリ・同一テキストは合算される', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-16T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-17T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.antecedent.get('環境調整')).toBe(3);
    expect(result.totalApplications).toBe(3);
    expect(result.recordsWithStrategies).toBe(3);
  });

  it('同一カテゴリでもテキストが異なれば別カウント', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: '代替行動の練習', applied: true },
        { strategyKey: 'teaching', strategyText: 'モデリング', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.teaching.get('代替行動の練習')).toBe(1);
    expect(result.teaching.get('モデリング')).toBe(1);
    expect(result.teaching.size).toBe(2);
    expect(result.totalApplications).toBe(2);
  });

  // ── recordsWithStrategies カウント ──

  it('recordsWithStrategies は applied を含むレコード数', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-16T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '事前予告', applied: false },
      ]),
      makeRecord('2026-03-17T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: 'モデリング', applied: true },
        { strategyKey: 'consequence', strategyText: '称賛', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    // 1件目: applied=true あり → カウント
    // 2件目: applied=true なし → カウントしない
    // 3件目: applied=true あり → カウント
    expect(result.recordsWithStrategies).toBe(2);
    expect(result.totalApplications).toBe(3);
  });

  // ── カテゴリ別合計 と totalApplications の整合 ──

  it('カテゴリ別合計 = totalApplications', () => {
    const records = [
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'antecedent', strategyText: '事前予告', applied: true },
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
      ]),
      makeRecord('2026-03-16T10:00:00+09:00', [
        { strategyKey: 'consequence', strategyText: '称賛', applied: true },
        { strategyKey: 'consequence', strategyText: 'トークン', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);

    let categorySum = 0;
    for (const v of result.antecedent.values()) categorySum += v;
    for (const v of result.teaching.values()) categorySum += v;
    for (const v of result.consequence.values()) categorySum += v;

    expect(categorySum).toBe(result.totalApplications);
    expect(result.totalApplications).toBe(5);
  });

  // ── 期間フィルタ ──

  it('fromDate 指定: 期間外レコードは除外', () => {
    const records = [
      makeRecord('2026-02-01T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '古い記録', applied: true },
      ]),
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '新しい記録', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records, {
      fromDate: '2026-03-01T00:00:00+09:00',
    });
    expect(result.totalApplications).toBe(1);
    expect(result.antecedent.get('新しい記録')).toBe(1);
    expect(result.antecedent.has('古い記録')).toBe(false);
  });

  it('toDate 指定: 期間外レコードは除外', () => {
    const records = [
      makeRecord('2026-03-01T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: '期間内', applied: true },
      ]),
      makeRecord('2026-04-01T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: '期間外', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records, {
      toDate: '2026-03-31T23:59:59+09:00',
    });
    expect(result.totalApplications).toBe(1);
    expect(result.teaching.get('期間内')).toBe(1);
    expect(result.teaching.has('期間外')).toBe(false);
  });

  it('fromDate + toDate 両指定: 範囲内のみ集計', () => {
    const records = [
      makeRecord('2026-02-28T23:59:59+09:00', [
        { strategyKey: 'antecedent', strategyText: '範囲前', applied: true },
      ]),
      makeRecord('2026-03-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '範囲内', applied: true },
      ]),
      makeRecord('2026-03-20T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '範囲内2', applied: true },
      ]),
      makeRecord('2026-04-01T00:00:01+09:00', [
        { strategyKey: 'antecedent', strategyText: '範囲後', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records, {
      fromDate: '2026-03-01T00:00:00+09:00',
      toDate: '2026-03-31T23:59:59+09:00',
    });
    expect(result.totalApplications).toBe(2);
    expect(result.antecedent.has('範囲前')).toBe(false);
    expect(result.antecedent.has('範囲後')).toBe(false);
    expect(result.antecedent.get('範囲内')).toBe(1);
    expect(result.antecedent.get('範囲内2')).toBe(1);
  });

  it('期間フィルタなし: 全レコード集計', () => {
    const records = [
      makeRecord('2020-01-01T00:00:00Z', [
        { strategyKey: 'antecedent', strategyText: '遠い過去', applied: true },
      ]),
      makeRecord('2030-12-31T23:59:59Z', [
        { strategyKey: 'teaching', strategyText: '遠い未来', applied: true },
      ]),
    ];
    const result = aggregateStrategyUsage(records);
    expect(result.totalApplications).toBe(2);
  });

  // ── 大量データ耐性 ──

  it('100件レコード × 各3戦略 でも正しく集計', () => {
    const records = Array.from({ length: 100 }, (_, i) =>
      makeRecord(`2026-03-${String((i % 28) + 1).padStart(2, '0')}T10:00:00+09:00`, [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'teaching', strategyText: '代替行動', applied: i % 2 === 0 },
        { strategyKey: 'consequence', strategyText: '称賛', applied: true },
      ]),
    );
    const result = aggregateStrategyUsage(records);
    expect(result.antecedent.get('環境調整')).toBe(100);
    expect(result.teaching.get('代替行動')).toBe(50); // applied on even indices
    expect(result.consequence.get('称賛')).toBe(100);
    expect(result.totalApplications).toBe(250);
    expect(result.recordsWithStrategies).toBe(100); // all have at least one applied
  });
});

// ─────────────────────────────────────────────
// getUsageCount
// ─────────────────────────────────────────────

describe('getUsageCount', () => {
  it('存在するテキストのカウントを返す', () => {
    const summary = aggregateStrategyUsage([
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
    ]);
    // 同一レコード内で同じテキストが2回 → 2
    expect(getUsageCount(summary, 'antecedent', '環境調整')).toBe(2);
  });

  it('存在しないテキストは 0 を返す', () => {
    const summary = aggregateStrategyUsage([]);
    expect(getUsageCount(summary, 'antecedent', '存在しない')).toBe(0);
    expect(getUsageCount(summary, 'teaching', '存在しない')).toBe(0);
    expect(getUsageCount(summary, 'consequence', '存在しない')).toBe(0);
  });

  it('カテゴリが異なれば別カウント', () => {
    const summary = aggregateStrategyUsage([
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '同名テスト', applied: true },
      ]),
    ]);
    expect(getUsageCount(summary, 'antecedent', '同名テスト')).toBe(1);
    expect(getUsageCount(summary, 'teaching', '同名テスト')).toBe(0);
  });
});

// ─────────────────────────────────────────────
// getCategoryTotal
// ─────────────────────────────────────────────

describe('getCategoryTotal', () => {
  it('カテゴリ内の全テキストカウントを合算', () => {
    const summary = aggregateStrategyUsage([
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
        { strategyKey: 'teaching', strategyText: 'モデリング', applied: true },
      ]),
      makeRecord('2026-03-16T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
      ]),
    ]);
    expect(getCategoryTotal(summary, 'teaching')).toBe(3);
  });

  it('空カテゴリは 0', () => {
    const summary = aggregateStrategyUsage([
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
    ]);
    expect(getCategoryTotal(summary, 'teaching')).toBe(0);
    expect(getCategoryTotal(summary, 'consequence')).toBe(0);
    expect(getCategoryTotal(summary, 'antecedent')).toBe(1);
  });
});

// ─────────────────────────────────────────────
// compareStrategyUsage (Phase C-3b)
// ─────────────────────────────────────────────

describe('compareStrategyUsage', () => {
  // 期間設定ヘルパー
  const CURRENT_FROM = '2026-03-01T00:00:00+09:00';
  const CURRENT_TO = '2026-03-31T23:59:59+09:00';
  const PREVIOUS_FROM = '2026-02-01T00:00:00+09:00';
  const PREVIOUS_TO = '2026-02-28T23:59:59+09:00';

  it('current だけ件数あり → up', () => {
    const records = [
      makeRecord('2026-03-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.totals.trend).toBe('up');
    expect(result.totals.currentCount).toBe(1);
    expect(result.totals.previousCount).toBe(0);
    expect(result.totals.delta).toBe(1);

    const item = result.items.find(i => i.strategyText === '環境調整');
    expect(item).toBeDefined();
    expect(item!.trend).toBe('up');
    expect(item!.currentCount).toBe(1);
    expect(item!.previousCount).toBe(0);
  });

  it('previous だけ件数あり → down', () => {
    const records = [
      makeRecord('2026-02-15T10:00:00+09:00', [
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.totals.trend).toBe('down');
    expect(result.totals.currentCount).toBe(0);
    expect(result.totals.previousCount).toBe(2);
    expect(result.totals.delta).toBe(-2);

    const item = result.items.find(i => i.strategyText === '代替行動');
    expect(item!.trend).toBe('down');
    expect(item!.delta).toBe(-2);
  });

  it('同数 → flat', () => {
    const records = [
      makeRecord('2026-02-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '事前予告', applied: true },
      ]),
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '事前予告', applied: true },
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.totals.trend).toBe('flat');
    expect(result.totals.delta).toBe(0);

    const item = result.items.find(i => i.strategyText === '事前予告');
    expect(item!.trend).toBe('flat');
    expect(item!.currentCount).toBe(1);
    expect(item!.previousCount).toBe(1);
  });

  it('applied=false は無視', () => {
    const records = [
      makeRecord('2026-03-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: false },
      ]),
      makeRecord('2026-02-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: false },
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.items).toHaveLength(0);
    expect(result.totals.currentCount).toBe(0);
    expect(result.totals.previousCount).toBe(0);
    expect(result.totals.trend).toBe('flat');
  });

  it('referencedStrategies なしは無視', () => {
    const records = [
      makeRecord('2026-03-10T10:00:00+09:00'),
      makeRecord('2026-02-10T10:00:00+09:00', undefined),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.items).toHaveLength(0);
    expect(result.totals.trend).toBe('flat');
  });

  it('同一戦略テキストは合算', () => {
    const records = [
      // previous: 環境調整 ×2
      makeRecord('2026-02-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-02-20T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      // current: 環境調整 ×5
      makeRecord('2026-03-05T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-15T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-20T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
      makeRecord('2026-03-25T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    const item = result.items.find(i => i.strategyText === '環境調整');
    expect(item!.currentCount).toBe(5);
    expect(item!.previousCount).toBe(2);
    expect(item!.delta).toBe(3);
    expect(item!.trend).toBe('up');
  });

  it('カテゴリ別でも崩れない（3カテゴリ混在）', () => {
    const records = [
      // previous
      makeRecord('2026-02-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
        { strategyKey: 'consequence', strategyText: '称賛', applied: true },
      ]),
      // current
      makeRecord('2026-03-10T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
        // consequence は今期ゼロ
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.items).toHaveLength(3);

    const env = result.items.find(i => i.strategyText === '環境調整')!;
    expect(env.strategyKey).toBe('antecedent');
    expect(env.currentCount).toBe(2);
    expect(env.previousCount).toBe(1);
    expect(env.trend).toBe('up');

    const alt = result.items.find(i => i.strategyText === '代替行動')!;
    expect(alt.strategyKey).toBe('teaching');
    expect(alt.currentCount).toBe(1);
    expect(alt.previousCount).toBe(1);
    expect(alt.trend).toBe('flat');

    const praise = result.items.find(i => i.strategyText === '称賛')!;
    expect(praise.strategyKey).toBe('consequence');
    expect(praise.currentCount).toBe(0);
    expect(praise.previousCount).toBe(1);
    expect(praise.trend).toBe('down');

    // totals
    expect(result.totals.currentCount).toBe(3);
    expect(result.totals.previousCount).toBe(3);
    expect(result.totals.trend).toBe('flat');
  });

  it('両期間とも空 → items 空 + totals flat', () => {
    const result = compareStrategyUsage([], CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.items).toHaveLength(0);
    expect(result.totals.currentCount).toBe(0);
    expect(result.totals.previousCount).toBe(0);
    expect(result.totals.trend).toBe('flat');
  });

  it('期間外レコードは無視される', () => {
    const records = [
      // 両期間のどちらにも入らない
      makeRecord('2025-12-01T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '古い', applied: true },
      ]),
      makeRecord('2026-05-01T10:00:00+09:00', [
        { strategyKey: 'antecedent', strategyText: '未来', applied: true },
      ]),
    ];
    const result = compareStrategyUsage(records, CURRENT_FROM, CURRENT_TO, PREVIOUS_FROM, PREVIOUS_TO);

    expect(result.items).toHaveLength(0);
    expect(result.totals.trend).toBe('flat');
  });
});
