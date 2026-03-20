/**
 * meetingEvidenceDraft.spec — モニタリング会議ドラフト自動引用のテスト
 */
import { describe, it, expect } from 'vitest';

import type {
  MeetingEvidenceInput,
  ABCPatternSummary,
  StrategyUsageSummary,
} from '../meetingEvidenceDraft';

import {
  buildMeetingEvidenceDraft,
  summarizeABCPatterns,
  summarizeStrategyUsage,
} from '../meetingEvidenceDraft';

import type { ABCRecord } from '@/domain/behavior/abc';
import type { DailyMonitoringSummary } from '@/features/monitoring/domain/monitoringDailyAnalytics';
import type { UserAlert } from '@/features/today/domain/buildUserAlerts';

// ─── helpers ── テストデータファクトリ ───────────────────────

function makeDailySummary(
  overrides: Partial<DailyMonitoringSummary> = {},
): DailyMonitoringSummary {
  return {
    period: {
      totalDays: 30,
      recordedDays: 25,
      recordRate: 83,
    },
    activity: {
      amCounts: {},
      pmCounts: {},
      topAm: [],
      topPm: [],
    },
    lunch: {
      counts: {},
      ratios: {},
      totalWithData: 20,
      stableScore: 75,
    },
    behavior: {
      totalDays: 5,
      rate: 20,
      byType: [{ type: 'selfHarm', label: '自傷', count: 3 }],
      weeklyTrend: [],
      recentChange: 'up',
      changeRate: 15,
    },
    behaviorTagSummary: null,
    ...overrides,
  } as DailyMonitoringSummary;
}

function makeAlert(
  overrides: Partial<UserAlert> = {},
): UserAlert {
  return {
    type: 'high-intensity',
    label: '自傷 ↑',
    severity: 'warning',
    ...overrides,
  };
}

function makeABCRecord(
  overrides: Partial<ABCRecord> = {},
): ABCRecord {
  return {
    id: 'abc-1',
    userId: 'user-1',
    recordedAt: '2026-03-10T10:00:00',
    antecedent: '要求却下',
    antecedentTags: [],
    behavior: '自傷(叩く)',
    consequence: '見守り',
    intensity: 3,
    ...overrides,
  };
}

function makeBaseInput(
  overrides: Partial<MeetingEvidenceInput> = {},
): MeetingEvidenceInput {
  return {
    userName: '山田太郎',
    from: '2026-02-01',
    to: '2026-03-01',
    dailySummary: null,
    alerts: [],
    abcPatterns: null,
    strategyUsage: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// summarizeABCPatterns
// ═══════════════════════════════════════════════════════════

describe('summarizeABCPatterns', () => {
  it('空配列 → null', () => {
    expect(summarizeABCPatterns([])).toBeNull();
  });

  it('先行事象の頻度 Top を正しく集計', () => {
    const records = [
      makeABCRecord({ antecedent: '要求却下', consequence: '見守り' }),
      makeABCRecord({ antecedent: '要求却下', consequence: '環境調整' }),
      makeABCRecord({ antecedent: '課題提示', consequence: '見守り' }),
      makeABCRecord({ antecedent: '環境変化', consequence: '声かけ' }),
      makeABCRecord({ antecedent: '環境変化', consequence: '見守り' }),
      makeABCRecord({ antecedent: '環境変化', consequence: '声かけ' }),
    ];

    const result = summarizeABCPatterns(records, 2);
    expect(result).not.toBeNull();
    expect(result!.topAntecedents).toHaveLength(2);
    expect(result!.topAntecedents[0].label).toBe('環境変化');
    expect(result!.topAntecedents[0].count).toBe(3);
    expect(result!.topAntecedents[1].label).toBe('要求却下');
    expect(result!.topAntecedents[1].count).toBe(2);
  });

  it('結果事象の頻度 Top を正しく集計', () => {
    const records = [
      makeABCRecord({ consequence: '見守り' }),
      makeABCRecord({ consequence: '見守り' }),
      makeABCRecord({ consequence: '声かけ' }),
    ];

    const result = summarizeABCPatterns(records);
    expect(result!.topConsequences[0].label).toBe('見守り');
    expect(result!.topConsequences[0].count).toBe(2);
  });

  it('推定機能を正しく分布集計', () => {
    const records = [
      makeABCRecord({ estimatedFunction: 'demand' }),
      makeABCRecord({ estimatedFunction: 'demand' }),
      makeABCRecord({ estimatedFunction: 'escape' }),
      makeABCRecord({ estimatedFunction: null }),
      makeABCRecord({}), // undefined
    ];

    const result = summarizeABCPatterns(records);
    expect(result!.functionDistribution).toHaveLength(2);
    expect(result!.functionDistribution[0]).toEqual({ fn: 'demand', count: 2 });
    expect(result!.functionDistribution[1]).toEqual({ fn: 'escape', count: 1 });
    expect(result!.totalRecords).toBe(5);
  });

  it('空文字の先行事象・結果事象は無視', () => {
    const records = [
      makeABCRecord({ antecedent: '', consequence: '' }),
      makeABCRecord({ antecedent: '要求却下', consequence: '見守り' }),
    ];

    const result = summarizeABCPatterns(records);
    expect(result!.topAntecedents).toHaveLength(1);
    expect(result!.topConsequences).toHaveLength(1);
  });

  it('maxItems でカット', () => {
    const records = [
      makeABCRecord({ antecedent: 'A' }),
      makeABCRecord({ antecedent: 'B' }),
      makeABCRecord({ antecedent: 'C' }),
      makeABCRecord({ antecedent: 'D' }),
    ];

    const result = summarizeABCPatterns(records, 2);
    expect(result!.topAntecedents).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════
// summarizeStrategyUsage
// ═══════════════════════════════════════════════════════════

describe('summarizeStrategyUsage', () => {
  it('戦略参照なし → null', () => {
    expect(summarizeStrategyUsage([])).toBeNull();
    expect(
      summarizeStrategyUsage([makeABCRecord({})]),
    ).toBeNull();
  });

  it('正しく実施率を計算', () => {
    const records = [
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: true },
          { strategyKey: 'teaching', strategyText: '代替行動指導', applied: false },
        ],
      }),
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'consequence', strategyText: '強化子提供', applied: true },
        ],
      }),
    ];

    const result = summarizeStrategyUsage(records);
    expect(result).not.toBeNull();
    // 3 referenced, 2 applied → 66.7%
    expect(result!.totalReferenced).toBe(3);
    expect(result!.applicationRate).toBeCloseTo(2 / 3);
  });

  it('カテゴリ別に集計', () => {
    const records = [
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: true },
          { strategyKey: 'antecedent', strategyText: 'スケジュール提示', applied: true },
          { strategyKey: 'teaching', strategyText: '代替行動指導', applied: true },
        ],
      }),
    ];

    const result = summarizeStrategyUsage(records);
    const antecedent = result!.byCategory.find((c) => c.category === 'antecedent');
    const teaching = result!.byCategory.find((c) => c.category === 'teaching');
    expect(antecedent!.count).toBe(2);
    expect(teaching!.count).toBe(1);
  });

  it('Top 戦略を正しく返す', () => {
    const records = [
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: true },
        ],
      }),
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: true },
        ],
      }),
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: '代替行動', applied: true },
        ],
      }),
    ];

    const result = summarizeStrategyUsage(records);
    expect(result!.topStrategies[0].text).toBe('事前声かけ');
    expect(result!.topStrategies[0].count).toBe(2);
  });

  it('applied=false の戦略はカテゴリ集計に含まない', () => {
    const records = [
      makeABCRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: false },
        ],
      }),
    ];

    const result = summarizeStrategyUsage(records);
    expect(result!.byCategory.find((c) => c.category === 'antecedent')!.count).toBe(0);
    expect(result!.topStrategies).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// buildMeetingEvidenceDraft
// ═══════════════════════════════════════════════════════════

describe('buildMeetingEvidenceDraft', () => {
  it('全ソース空 → sourceCount: 0, fullText 空', () => {
    const result = buildMeetingEvidenceDraft(makeBaseInput());
    expect(result.sourceCount).toBe(0);
    expect(result.sections).toHaveLength(0);
    expect(result.fullText).toBe('');
  });

  // ── 日次記録 ──

  it('日次記録のみ → 1セクション', () => {
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ dailySummary: makeDailySummary() }),
    );

    expect(result.sourceCount).toBe(1);
    expect(result.sections[0].source).toBe('daily');
    expect(result.sections[0].title).toBe('■ 日次記録サマリー');
    expect(result.sections[0].content).toContain('25日分');
    expect(result.sections[0].content).toContain('記録率: 83%');
  });

  it('問題行動増加 → severity warning', () => {
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({
        dailySummary: makeDailySummary({
          behavior: {
            totalDays: 5,
            rate: 20,
            byType: [{ type: 'selfHarm', label: '自傷', count: 3 }],
            weeklyTrend: [],
            recentChange: 'up',
            changeRate: 15,
          },
        }),
      }),
    );

    expect(result.sections[0].severity).toBe('warning');
    expect(result.sections[0].content).toContain('増加傾向');
  });

  it('問題行動横ばい → severity neutral', () => {
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({
        dailySummary: makeDailySummary({
          behavior: {
            totalDays: 3,
            rate: 10,
            byType: [],
            weeklyTrend: [],
            recentChange: 'flat',
            changeRate: 0,
          },
        }),
      }),
    );

    expect(result.sections[0].severity).toBe('neutral');
    expect(result.sections[0].content).toContain('横ばい');
  });

  it('問題行動なし → "記録なし" テキスト', () => {
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({
        dailySummary: makeDailySummary({
          behavior: {
            totalDays: 0,
            rate: 0,
            byType: [],
            weeklyTrend: [],
            recentChange: 'flat',
            changeRate: 0,
          },
        }),
      }),
    );

    expect(result.sections[0].content).toContain('問題行動: 記録なし');
  });

  it('昼食データありの場合の安定度表示', () => {
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({
        dailySummary: makeDailySummary({
          lunch: {
            counts: {},
            ratios: {},
            totalWithData: 20,
            stableScore: 40,
          },
        }),
      }),
    );

    expect(result.sections[0].content).toContain('やや不安定');
  });

  // ── アラート ──

  it('アラートのみ → alert セクション', () => {
    const alerts: UserAlert[] = [
      makeAlert({ label: '自傷 ↑', severity: 'warning' }),
      makeAlert({ type: 'active-strategy', label: '見通しカード 実施中', severity: 'info' }),
    ];

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ alerts }),
    );

    expect(result.sourceCount).toBe(1);
    expect(result.sections[0].source).toBe('alert');
    expect(result.sections[0].content).toContain('自傷 ↑');
    expect(result.sections[0].content).toContain('見通しカード 実施中');
    expect(result.sections[0].severity).toBe('warning');
  });

  it('info のみのアラート → severity info', () => {
    const alerts: UserAlert[] = [
      makeAlert({ type: 'active-strategy', label: '計画進行中', severity: 'info' }),
    ];

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ alerts }),
    );

    expect(result.sections[0].severity).toBe('info');
  });

  // ── ABC パターン ──

  it('ABCパターン → abc セクション', () => {
    const abcPatterns: ABCPatternSummary = {
      topAntecedents: [{ label: '要求却下', count: 5 }],
      topConsequences: [{ label: '見守り', count: 4 }],
      functionDistribution: [{ fn: 'demand', count: 3 }],
      totalRecords: 10,
    };

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ abcPatterns }),
    );

    expect(result.sourceCount).toBe(1);
    expect(result.sections[0].source).toBe('abc');
    expect(result.sections[0].content).toContain('要求却下(5回)');
    expect(result.sections[0].content).toContain('見守り(4回)');
    expect(result.sections[0].content).toContain('要求(3件)');
    expect(result.sections[0].content).toContain('10件');
  });

  // ── 戦略実績 ──

  it('戦略実績 → strategy セクション', () => {
    const strategyUsage: StrategyUsageSummary = {
      byCategory: [
        { category: 'antecedent', categoryLabel: '事前対応', count: 5 },
        { category: 'teaching', categoryLabel: '代替行動指導', count: 2 },
        { category: 'consequence', categoryLabel: '結果対応', count: 0 },
      ],
      topStrategies: [{ text: '事前声かけ', count: 5 }],
      totalReferenced: 10,
      applicationRate: 0.7,
    };

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ strategyUsage }),
    );

    expect(result.sourceCount).toBe(1);
    expect(result.sections[0].source).toBe('strategy');
    expect(result.sections[0].content).toContain('70%');
    expect(result.sections[0].content).toContain('事前対応 5件');
    expect(result.sections[0].content).toContain('事前声かけ');
  });

  it('実施率50%未満 → warning', () => {
    const strategyUsage: StrategyUsageSummary = {
      byCategory: [],
      topStrategies: [],
      totalReferenced: 10,
      applicationRate: 0.3,
    };

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ strategyUsage }),
    );

    expect(result.sections[0].severity).toBe('warning');
  });

  it('実施率50%以上 → info', () => {
    const strategyUsage: StrategyUsageSummary = {
      byCategory: [],
      topStrategies: [],
      totalReferenced: 10,
      applicationRate: 0.8,
    };

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ strategyUsage }),
    );

    expect(result.sections[0].severity).toBe('info');
  });

  // ── 全ソース結合 ──

  it('全ソースあり → 4セクション, fullText にヘッダー含む', () => {
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({
        dailySummary: makeDailySummary(),
        alerts: [makeAlert()],
        abcPatterns: {
          topAntecedents: [{ label: '要求却下', count: 3 }],
          topConsequences: [],
          functionDistribution: [],
          totalRecords: 5,
        },
        strategyUsage: {
          byCategory: [],
          topStrategies: [],
          totalReferenced: 5,
          applicationRate: 0.6,
        },
      }),
    );

    expect(result.sourceCount).toBe(4);
    expect(result.sections.map((s) => s.source)).toEqual([
      'daily',
      'alert',
      'abc',
      'strategy',
    ]);
    expect(result.fullText).toContain('【会議資料ドラフト】山田太郎');
    expect(result.fullText).toContain('2026-02-01 〜 2026-03-01');
  });

  it('セクション順序は常に daily → alert → abc → strategy', () => {
    // alert と strategy のみ
    const result = buildMeetingEvidenceDraft(
      makeBaseInput({
        alerts: [makeAlert()],
        strategyUsage: {
          byCategory: [],
          topStrategies: [],
          totalReferenced: 5,
          applicationRate: 0.5,
        },
      }),
    );

    expect(result.sections.map((s) => s.source)).toEqual(['alert', 'strategy']);
  });

  it('長い戦略テキストは30文字で切り捨て', () => {
    const longText = 'あ'.repeat(50);
    const strategyUsage: StrategyUsageSummary = {
      byCategory: [],
      topStrategies: [{ text: longText, count: 3 }],
      totalReferenced: 3,
      applicationRate: 1,
    };

    const result = buildMeetingEvidenceDraft(
      makeBaseInput({ strategyUsage }),
    );

    // 29文字 + '…' = 30文字
    expect(result.sections[0].content).toContain('…');
    expect(result.sections[0].content).not.toContain(longText);
  });
});
