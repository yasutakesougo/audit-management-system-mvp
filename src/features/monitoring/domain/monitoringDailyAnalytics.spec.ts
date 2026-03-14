import { describe, it, expect } from 'vitest';
import {
  aggregateActivities,
  aggregateLunch,
  aggregateBehaviors,
  aggregateBehaviorTags,
  buildMonitoringDailySummary,
  buildMonitoringInsightText,
} from './monitoringDailyAnalytics';
import type { DailyTableRecord } from '@/features/daily/infra/dailyTableRepository';

// ─── テストデータファクトリ ──────────────────────────────

const mkRecord = (
  overrides: Partial<DailyTableRecord> & { recordDate: string },
): DailyTableRecord => ({
  userId: 'u1',
  activities: {},
  submittedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

// ─── aggregateActivities ─────────────────────────────────

describe('aggregateActivities', () => {
  it('空配列 → 空結果', () => {
    const result = aggregateActivities([]);
    expect(result.amCounts).toEqual({});
    expect(result.pmCounts).toEqual({});
    expect(result.topAm).toEqual([]);
    expect(result.topPm).toEqual([]);
  });

  it('単一レコード → AM/PM 各1件', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', activities: { am: '散歩', pm: '室内作業' } }),
    ];
    const result = aggregateActivities(records);
    expect(result.amCounts).toEqual({ 散歩: 1 });
    expect(result.pmCounts).toEqual({ 室内作業: 1 });
    expect(result.topAm).toEqual([{ label: '散歩', count: 1 }]);
    expect(result.topPm).toEqual([{ label: '室内作業', count: 1 }]);
  });

  it('Top 活動が降順ソートされる', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', activities: { am: '散歩' } }),
      mkRecord({ recordDate: '2024-01-02', activities: { am: '散歩' } }),
      mkRecord({ recordDate: '2024-01-03', activities: { am: '室内作業' } }),
      mkRecord({ recordDate: '2024-01-04', activities: { am: '散歩' } }),
      mkRecord({ recordDate: '2024-01-05', activities: { am: '園芸' } }),
      mkRecord({ recordDate: '2024-01-06', activities: { am: '園芸' } }),
    ];
    const result = aggregateActivities(records);
    expect(result.topAm[0]).toEqual({ label: '散歩', count: 3 });
    expect(result.topAm[1]).toEqual({ label: '園芸', count: 2 });
    expect(result.topAm[2]).toEqual({ label: '室内作業', count: 1 });
  });

  it('AM 空文字 → カウントしない', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', activities: { am: '', pm: '作業' } }),
    ];
    const result = aggregateActivities(records);
    expect(result.amCounts).toEqual({});
    expect(result.pmCounts).toEqual({ 作業: 1 });
  });
});

// ─── aggregateLunch ──────────────────────────────────────

describe('aggregateLunch', () => {
  it('空配列 → 安定度0', () => {
    const result = aggregateLunch([]);
    expect(result.totalWithData).toBe(0);
    expect(result.stableScore).toBe(0);
  });

  it('lunchIntake 未設定 → カウントしない', () => {
    const records = [mkRecord({ recordDate: '2024-01-01' })];
    const result = aggregateLunch(records);
    expect(result.totalWithData).toBe(0);
  });

  it('安定度計算: 完食+8割 の割合', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', lunchIntake: 'full' }),
      mkRecord({ recordDate: '2024-01-02', lunchIntake: 'full' }),
      mkRecord({ recordDate: '2024-01-03', lunchIntake: '80' }),
      mkRecord({ recordDate: '2024-01-04', lunchIntake: 'half' }),
    ];
    const result = aggregateLunch(records);
    // 完食2 + 8割1 = 3 安定 / 4件 = 75%
    expect(result.stableScore).toBe(75);
    expect(result.ratios.full).toBe(50);
    expect(result.ratios['80']).toBe(25);
    expect(result.ratios.half).toBe(25);
  });

  it('昼食不安定パターン: 少量+なし中心', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', lunchIntake: 'small' }),
      mkRecord({ recordDate: '2024-01-02', lunchIntake: 'none' }),
      mkRecord({ recordDate: '2024-01-03', lunchIntake: 'small' }),
      mkRecord({ recordDate: '2024-01-04', lunchIntake: 'full' }),
    ];
    const result = aggregateLunch(records);
    // 安定: full=1 / 4件 = 25%
    expect(result.stableScore).toBe(25);
  });
});

// ─── aggregateBehaviors ──────────────────────────────────

describe('aggregateBehaviors', () => {
  it('空配列 → 問題行動なし', () => {
    const result = aggregateBehaviors([]);
    expect(result.totalDays).toBe(0);
    expect(result.rate).toBe(0);
    expect(result.byType).toEqual([]);
  });

  it('問題行動なしのレコード → totalDays=0', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', problemBehaviors: [] }),
      mkRecord({ recordDate: '2024-01-02' }),
    ];
    const result = aggregateBehaviors(records);
    expect(result.totalDays).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('種別カウントと降順ソート', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', problemBehaviors: ['shouting', 'selfHarm'] }),
      mkRecord({ recordDate: '2024-01-02', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-03', problemBehaviors: ['otherInjury'] }),
    ];
    const result = aggregateBehaviors(records);
    expect(result.totalDays).toBe(3);
    expect(result.byType[0]).toEqual({ type: 'shouting', label: '大声', count: 2 });
    expect(result.byType[1].type).toBe('selfHarm');
    expect(result.byType[2].type).toBe('otherInjury');
  });

  it('発生率の計算', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-02' }),
      mkRecord({ recordDate: '2024-01-03' }),
      mkRecord({ recordDate: '2024-01-04', problemBehaviors: ['selfHarm'] }),
    ];
    const result = aggregateBehaviors(records);
    expect(result.totalDays).toBe(2);
    expect(result.rate).toBe(50); // 2/4
  });

  it('recentChange: 後半増加 → up', () => {
    // 前半1件 (W1) → 後半4件 (W3,W4) で明確に増加
    const records = [
      mkRecord({ recordDate: '2024-01-02', problemBehaviors: ['shouting'] }),
      // 2週目は問題行動なし
      mkRecord({ recordDate: '2024-01-08' }),
      // 後半: 集中して発生
      mkRecord({ recordDate: '2024-01-15', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-16', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-22', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-23', problemBehaviors: ['shouting'] }),
    ];
    const result = aggregateBehaviors(records);
    expect(result.recentChange).toBe('up');
  });
});

// ─── buildMonitoringDailySummary ─────────────────────────

describe('buildMonitoringDailySummary', () => {
  it('空配列 → null', () => {
    expect(buildMonitoringDailySummary([])).toBeNull();
  });

  it('単一レコード → 有効なサマリー', () => {
    const records = [
      mkRecord({
        recordDate: '2024-01-15',
        activities: { am: '散歩', pm: '作業' },
        lunchIntake: 'full',
      }),
    ];
    const result = buildMonitoringDailySummary(records);
    expect(result).not.toBeNull();
    expect(result!.period.from).toBe('2024-01-15');
    expect(result!.period.to).toBe('2024-01-15');
    expect(result!.period.recordedDays).toBe(1);
    expect(result!.period.recordRate).toBe(100);
    expect(result!.activity.topAm).toHaveLength(1);
    expect(result!.lunch.stableScore).toBe(100);
  });

  it('複数日 → 記録率を正しく算出', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01' }),
      mkRecord({ recordDate: '2024-01-03' }),
      mkRecord({ recordDate: '2024-01-05' }),
    ];
    const result = buildMonitoringDailySummary(records);
    expect(result).not.toBeNull();
    // 1/1〜1/5 = 5日間、3日記録 → 60%
    expect(result!.period.totalDays).toBe(5);
    expect(result!.period.recordedDays).toBe(3);
    expect(result!.period.recordRate).toBe(60);
  });
});

// ─── buildMonitoringInsightText ──────────────────────────

describe('buildMonitoringInsightText', () => {
  it('サマリーから所見文を生成できる', () => {
    const records = [
      mkRecord({
        recordDate: '2024-01-01',
        activities: { am: '散歩', pm: '室内作業' },
        lunchIntake: 'full',
        problemBehaviors: ['shouting'],
      }),
      mkRecord({
        recordDate: '2024-01-02',
        activities: { am: '散歩', pm: '園芸' },
        lunchIntake: 'full',
      }),
      mkRecord({
        recordDate: '2024-01-03',
        activities: { am: '体操', pm: '室内作業' },
        lunchIntake: '80',
        problemBehaviors: ['shouting', 'selfHarm'],
      }),
    ];
    const summary = buildMonitoringDailySummary(records)!;
    const lines = buildMonitoringInsightText(summary);

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain('モニタリング期間');
    expect(lines[0]).toContain('記録率');
    expect(lines.some((l) => l.includes('散歩'))).toBe(true);
    expect(lines.some((l) => l.includes('完食'))).toBe(true);
    expect(lines.some((l) => l.includes('大声'))).toBe(true);
  });

  it('問題行動なし → 「記録はなかった」', () => {
    const records = [
      mkRecord({
        recordDate: '2024-01-01',
        activities: { am: '散歩' },
        lunchIntake: 'full',
      }),
    ];
    const summary = buildMonitoringDailySummary(records)!;
    const lines = buildMonitoringInsightText(summary);
    expect(lines.some((l) => l.includes('記録はなかった'))).toBe(true);
  });
});

// ─── aggregateBehaviorTags ───────────────────────────────

describe('aggregateBehaviorTags', () => {
  it('空配列 → null', () => {
    expect(aggregateBehaviorTags([])).toBeNull();
  });

  it('タグなしのレコードのみ → null', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01' }),
      mkRecord({ recordDate: '2024-01-02', behaviorTags: [] }),
    ];
    expect(aggregateBehaviorTags(records)).toBeNull();
  });

  it('Top タグが降順ソートされる', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', behaviorTags: ['cooperation', 'panic'] }),
      mkRecord({ recordDate: '2024-01-02', behaviorTags: ['cooperation', 'sensory'] }),
      mkRecord({ recordDate: '2024-01-03', behaviorTags: ['cooperation'] }),
      mkRecord({ recordDate: '2024-01-04', behaviorTags: ['panic'] }),
    ];
    const result = aggregateBehaviorTags(records);
    expect(result).not.toBeNull();
    expect(result!.topTags[0].key).toBe('cooperation');
    expect(result!.topTags[0].count).toBe(3);
    expect(result!.topTags[1].key).toBe('panic');
    expect(result!.topTags[1].count).toBe(2);
  });

  it('カテゴリ分布が正しい', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', behaviorTags: ['cooperation', 'panic'] }),
      mkRecord({ recordDate: '2024-01-02', behaviorTags: ['selfRegulation', 'verbalRequest'] }),
    ];
    const result = aggregateBehaviorTags(records);
    expect(result).not.toBeNull();
    const cats = result!.categoryDistribution.map((c) => c.category);
    expect(cats).toContain('positive');
    expect(cats).toContain('behavior');
    expect(cats).toContain('communication');
  });

  it('付与率と平均タグ数の算出', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', behaviorTags: ['cooperation', 'panic'] }),
      mkRecord({ recordDate: '2024-01-02', behaviorTags: [] }),
      mkRecord({ recordDate: '2024-01-03', behaviorTags: ['cooperation'] }),
      mkRecord({ recordDate: '2024-01-04' }),
    ];
    const result = aggregateBehaviorTags(records);
    expect(result).not.toBeNull();
    // タグ付き2件 / 全4件 = 50%
    expect(result!.tagUsageRate).toBe(50);
    expect(result!.taggedRecords).toBe(2);
    // 合計3タグ / 全4件 = 0.8
    expect(result!.avgTagsPerRecord).toBe(0.8);
  });

  it('トレンド: 後半増加 → up', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01' }),
      mkRecord({ recordDate: '2024-01-02' }),
      mkRecord({ recordDate: '2024-01-03', behaviorTags: ['cooperation'] }),
      mkRecord({ recordDate: '2024-01-04', behaviorTags: ['cooperation'] }),
      mkRecord({ recordDate: '2024-01-05', behaviorTags: ['panic'] }),
      mkRecord({ recordDate: '2024-01-06', behaviorTags: ['cooperation'] }),
    ];
    const result = aggregateBehaviorTags(records);
    expect(result).not.toBeNull();
    expect(result!.usageTrend).toBe('up');
  });

  it('トレンド: 4件未満 → flat', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', behaviorTags: ['cooperation'] }),
      mkRecord({ recordDate: '2024-01-02', behaviorTags: ['panic'] }),
    ];
    const result = aggregateBehaviorTags(records);
    expect(result).not.toBeNull();
    expect(result!.usageTrend).toBe('flat');
  });
});

// ─── buildMonitoringDailySummary — behaviorTagSummary ────

describe('buildMonitoringDailySummary — behaviorTag integration', () => {
  it('タグなし → behaviorTagSummary が null', () => {
    const records = [mkRecord({ recordDate: '2024-01-01' })];
    const result = buildMonitoringDailySummary(records);
    expect(result).not.toBeNull();
    expect(result!.behaviorTagSummary).toBeNull();
  });

  it('タグあり → behaviorTagSummary が有効', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01', behaviorTags: ['cooperation', 'panic'] }),
      mkRecord({ recordDate: '2024-01-02', behaviorTags: ['cooperation'] }),
    ];
    const result = buildMonitoringDailySummary(records);
    expect(result).not.toBeNull();
    expect(result!.behaviorTagSummary).not.toBeNull();
    expect(result!.behaviorTagSummary!.topTags[0].key).toBe('cooperation');
  });
});

// ─── buildMonitoringInsightText — 行動タグ ───────────────

describe('buildMonitoringInsightText — behaviorTag section', () => {
  it('タグありの場合、所見に【行動タグ】セクションが含まれる', () => {
    const records = [
      mkRecord({
        recordDate: '2024-01-01',
        activities: { am: '散歩' },
        lunchIntake: 'full',
        behaviorTags: ['cooperation', 'panic'],
      }),
      mkRecord({
        recordDate: '2024-01-02',
        activities: { am: '体操' },
        lunchIntake: '80',
        behaviorTags: ['cooperation'],
      }),
    ];
    const summary = buildMonitoringDailySummary(records)!;
    const lines = buildMonitoringInsightText(summary);
    const tagLine = lines.find((l) => l.includes('【行動タグ】'));
    expect(tagLine).toBeDefined();
    expect(tagLine).toContain('協力行動');
    expect(tagLine).toContain('付与率');
    expect(tagLine).toContain('カテゴリ別');
  });

  it('タグなしの場合、【行動タグ】セクションが含まれない', () => {
    const records = [
      mkRecord({
        recordDate: '2024-01-01',
        activities: { am: '散歩' },
        lunchIntake: 'full',
      }),
    ];
    const summary = buildMonitoringDailySummary(records)!;
    const lines = buildMonitoringInsightText(summary);
    expect(lines.some((l) => l.includes('【行動タグ】'))).toBe(false);
  });
});
