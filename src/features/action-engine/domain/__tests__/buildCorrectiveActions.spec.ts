// ---------------------------------------------------------------------------
// buildCorrectiveActions — Unit Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { buildCorrectiveActions } from '../buildCorrectiveActions';
import type { CorrectiveActionInput } from '../types';
import { toWeekBucket } from '../types';

const NOW = new Date('2026-03-20T10:00:00Z');

/** テスト用のベースライン入力（全ルール非該当） */
function createBaseInput(overrides?: Partial<CorrectiveActionInput>): CorrectiveActionInput {
  return {
    targetUserId: 'user-001',
    trend: {
      recentAvg: 2.0,
      previousAvg: 2.0,
      changeRate: 1.0,
    },
    execution: {
      completed: 80,
      triggered: 10,
      skipped: 10,
      total: 100,
      completionRate: 80,
    },
    highIntensityEvents: [],
    heatmapPeak: {
      hour: 10,
      count: 3,
      totalEvents: 20,
      concentration: 0.15,
    },
    activeBipCount: 2,
    totalIncidents: 20,
    lastRecordDate: '2026-03-19T15:00:00Z',
    analysisDays: 30,
    ...overrides,
  };
}

describe('buildCorrectiveActions', () => {
  it('正常データで提案が 0 件', () => {
    const result = buildCorrectiveActions(createBaseInput(), NOW);
    expect(result).toHaveLength(0);
  });

  it('結果が優先度順にソートされる', () => {
    // 複数ルールがヒットする入力を作成
    const input = createBaseInput({
      trend: { recentAvg: 4.0, previousAvg: 2.0, changeRate: 2.0 }, // P0
      activeBipCount: 0,                                              // P1
      totalIncidents: 10,
    });

    const result = buildCorrectiveActions(input, NOW);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // P0 が先に来ること
    const priorities = result.map((r) => r.priority);
    for (let i = 1; i < priorities.length; i++) {
      const prev = priorities[i - 1]!;
      const curr = priorities[i]!;
      expect(prev <= curr).toBe(true);
    }
  });

  // ---------- Rule 1: 行動増加傾向 ----------

  describe('Rule 1: behaviorTrend', () => {
    it('30% 増加で assessment_update を提案', () => {
      const input = createBaseInput({
        trend: { recentAvg: 3.9, previousAvg: 3.0, changeRate: 1.3 },
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'behavior-trend-increase');
      expect(suggestion).toBeDefined();
      expect(suggestion!.type).toBe('assessment_update');
      expect(suggestion!.priority).toBe('P0');
      expect(suggestion!.cta.route).toBe('/assessment');
    });

    it('29% 増加では提案しない', () => {
      const input = createBaseInput({
        trend: { recentAvg: 3.87, previousAvg: 3.0, changeRate: 1.29 },
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'behavior-trend-increase')).toBeUndefined();
    });

    it('前期間データなし (previousAvg=0) では提案しない', () => {
      const input = createBaseInput({
        trend: { recentAvg: 5.0, previousAvg: 0, changeRate: Infinity },
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'behavior-trend-increase')).toBeUndefined();
    });
  });

  // ---------- Rule 2: 手順実施率低下 ----------

  describe('Rule 2: executionRate', () => {
    it('60% 未満で bip_strategy_update を提案', () => {
      const input = createBaseInput({
        execution: { completed: 40, triggered: 30, skipped: 30, total: 100, completionRate: 40 },
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'low-execution-rate');
      expect(suggestion).toBeDefined();
      expect(suggestion!.type).toBe('bip_strategy_update');
      expect(suggestion!.priority).toBe('P0');
    });

    it('60% では提案しない', () => {
      const input = createBaseInput({
        execution: { completed: 60, triggered: 20, skipped: 20, total: 100, completionRate: 60 },
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'low-execution-rate')).toBeUndefined();
    });

    it('total=0 では提案しない', () => {
      const input = createBaseInput({
        execution: { completed: 0, triggered: 0, skipped: 0, total: 0, completionRate: 0 },
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'low-execution-rate')).toBeUndefined();
    });
  });

  // ---------- Rule 3: 高強度行動 ----------

  describe('Rule 3: highIntensity', () => {
    it('高強度 3 件以上で plan_update を提案', () => {
      const input = createBaseInput({
        highIntensityEvents: [
          { id: '1', intensity: 4, recordedAt: '2026-03-18T10:00:00Z' },
          { id: '2', intensity: 5, recordedAt: '2026-03-19T11:00:00Z' },
          { id: '3', intensity: 4, recordedAt: '2026-03-20T09:00:00Z' },
        ],
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'high-intensity-cluster');
      expect(suggestion).toBeDefined();
      expect(suggestion!.type).toBe('plan_update');
      expect(suggestion!.priority).toBe('P0');
    });

    it('高強度 2 件では提案しない', () => {
      const input = createBaseInput({
        highIntensityEvents: [
          { id: '1', intensity: 4, recordedAt: '2026-03-18T10:00:00Z' },
          { id: '2', intensity: 5, recordedAt: '2026-03-19T11:00:00Z' },
        ],
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'high-intensity-cluster')).toBeUndefined();
    });
  });

  // ---------- Rule 4: 時間帯集中 ----------

  describe('Rule 4: timeConcentration', () => {
    it('40% 以上集中で plan_update を提案', () => {
      const input = createBaseInput({
        heatmapPeak: { hour: 14, count: 8, totalEvents: 20, concentration: 0.4 },
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'time-concentration');
      expect(suggestion).toBeDefined();
      expect(suggestion!.title).toContain('14時台');
    });

    it('少なすぎるイベント (< 5) では提案しない', () => {
      const input = createBaseInput({
        heatmapPeak: { hour: 14, count: 3, totalEvents: 4, concentration: 0.75 },
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'time-concentration')).toBeUndefined();
    });
  });

  // ---------- Rule 5: BIP 未作成 ----------

  describe('Rule 5: missingBip', () => {
    it('行動 5 件以上で BIP 0 件なら new_bip_needed を提案', () => {
      const input = createBaseInput({
        activeBipCount: 0,
        totalIncidents: 5,
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'missing-bip');
      expect(suggestion).toBeDefined();
      expect(suggestion!.type).toBe('new_bip_needed');
    });

    it('BIP がある場合は提案しない', () => {
      const input = createBaseInput({
        activeBipCount: 1,
        totalIncidents: 10,
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'missing-bip')).toBeUndefined();
    });
  });

  // ---------- Rule 6: データ不足 ----------

  describe('Rule 6: dataInsufficiency', () => {
    it('14 日間で 2 件 + 最終記録 8 日前で data_collection を提案', () => {
      const input = createBaseInput({
        totalIncidents: 2,
        lastRecordDate: '2026-03-12T10:00:00Z', // 8 日前
        analysisDays: 30,
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'data-insufficiency');
      expect(suggestion).toBeDefined();
      expect(suggestion!.type).toBe('data_collection');
      expect(suggestion!.priority).toBe('P2');
    });

    it('最終記録が 3 日前では提案しない', () => {
      const input = createBaseInput({
        totalIncidents: 2,
        lastRecordDate: '2026-03-17T10:00:00Z', // 3 日前
        analysisDays: 30,
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'data-insufficiency')).toBeUndefined();
    });

    it('十分なデータがある場合は提案しない', () => {
      const input = createBaseInput({
        totalIncidents: 10,
        lastRecordDate: '2026-03-12T10:00:00Z',
        analysisDays: 30,
      });
      const result = buildCorrectiveActions(input, NOW);
      expect(result.find((r) => r.ruleId === 'data-insufficiency')).toBeUndefined();
    });

    it('記録が一切ない場合も提案する', () => {
      const input = createBaseInput({
        totalIncidents: 0,
        lastRecordDate: null,
        analysisDays: 30,
      });
      const result = buildCorrectiveActions(input, NOW);
      const suggestion = result.find((r) => r.ruleId === 'data-insufficiency');
      expect(suggestion).toBeDefined();
    });
  });

  // ---------- 統合テスト ----------

  describe('Integration', () => {
    it('全ルールが同時にヒットすることがある', () => {
      const input: CorrectiveActionInput = {
        targetUserId: 'user-critical',
        trend: { recentAvg: 5.0, previousAvg: 2.0, changeRate: 2.5 },
        execution: { completed: 20, triggered: 40, skipped: 40, total: 100, completionRate: 20 },
        highIntensityEvents: [
          { id: '1', intensity: 5, recordedAt: '2026-03-18T14:00:00Z' },
          { id: '2', intensity: 4, recordedAt: '2026-03-19T14:30:00Z' },
          { id: '3', intensity: 5, recordedAt: '2026-03-20T14:00:00Z' },
        ],
        heatmapPeak: { hour: 14, count: 15, totalEvents: 20, concentration: 0.75 },
        activeBipCount: 0,
        totalIncidents: 20,
        lastRecordDate: '2026-03-20T09:00:00Z',
        analysisDays: 30,
      };

      const result = buildCorrectiveActions(input, NOW);

      // dedupe により同一 CTA 先が合算されるため 3 件
      expect(result.length).toBeGreaterThanOrEqual(3);

      // P0 が最初 → P1 以降の順序
      const p0 = result.filter((r) => r.priority === 'P0');
      expect(p0.length).toBeGreaterThan(0);
    });

    it('各提案に必須フィールドがすべて存在する', () => {
      const input = createBaseInput({
        trend: { recentAvg: 5.0, previousAvg: 2.0, changeRate: 2.5 },
      });
      const result = buildCorrectiveActions(input, NOW);

      for (const suggestion of result) {
        expect(suggestion.id).toBeTruthy();
        expect(suggestion.stableId).toBeTruthy();
        expect(suggestion.type).toBeTruthy();
        expect(suggestion.priority).toMatch(/^P[012]$/);
        expect(suggestion.targetUserId).toBeTruthy();
        expect(suggestion.title).toBeTruthy();
        expect(suggestion.reason).toBeTruthy();
        expect(suggestion.evidence).toBeDefined();
        expect(suggestion.evidence.metric).toBeTruthy();
        expect(suggestion.cta).toBeDefined();
        expect(suggestion.cta.label).toBeTruthy();
        expect(suggestion.cta.route).toBeTruthy();
        expect(suggestion.createdAt).toBeTruthy();
        expect(suggestion.ruleId).toBeTruthy();
      }
    });
  });

  // ---------- stableId ----------

  describe('stableId', () => {
    it('同一ルール・同一ユーザー・同一週は同じ stableId を生成', () => {
      const input = createBaseInput({
        trend: { recentAvg: 5.0, previousAvg: 2.0, changeRate: 2.5 },
      });
      const day1 = new Date('2026-03-17T10:00:00Z');
      const day2 = new Date('2026-03-18T10:00:00Z');

      const r1 = buildCorrectiveActions(input, day1);
      const r2 = buildCorrectiveActions(input, day2);

      const s1 = r1.find((r) => r.ruleId === 'behavior-trend-increase');
      const s2 = r2.find((r) => r.ruleId === 'behavior-trend-increase');

      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
      expect(s1!.stableId).toBe(s2!.stableId);
    });

    it('stableId が ruleId:userId:weekBucket 形式', () => {
      const input = createBaseInput({
        trend: { recentAvg: 5.0, previousAvg: 2.0, changeRate: 2.5 },
      });
      const result = buildCorrectiveActions(input, NOW);
      const s = result.find((r) => r.ruleId === 'behavior-trend-increase');

      expect(s!.stableId).toBe(`behavior-trend-increase:user-001:${toWeekBucket(NOW)}`);
    });
  });

  // ---------- evidence.metrics ----------

  describe('evidence.metrics', () => {
    it('behaviorTrend の evidence に生メトリクスが含まれる', () => {
      const input = createBaseInput({
        trend: { recentAvg: 5.0, previousAvg: 2.0, changeRate: 2.5 },
      });
      const result = buildCorrectiveActions(input, NOW);
      const s = result.find((r) => r.ruleId === 'behavior-trend-increase');

      expect(s!.evidence.metrics).toBeDefined();
      expect(s!.evidence.metrics!.recentAvg).toBe(5.0);
      expect(s!.evidence.metrics!.previousAvg).toBe(2.0);
    });

    it('highIntensity の evidence に sourceRefs が含まれる', () => {
      const input = createBaseInput({
        highIntensityEvents: [
          { id: 'abc-1', intensity: 4, recordedAt: '2026-03-18T10:00:00Z' },
          { id: 'abc-2', intensity: 5, recordedAt: '2026-03-19T11:00:00Z' },
          { id: 'abc-3', intensity: 4, recordedAt: '2026-03-20T09:00:00Z' },
        ],
      });
      const result = buildCorrectiveActions(input, NOW);
      const s = result.find((r) => r.ruleId === 'high-intensity-cluster');

      expect(s!.evidence.sourceRefs).toEqual(['abc-1', 'abc-2', 'abc-3']);
    });
  });

  // ---------- dedupe ----------

  describe('dedupe', () => {
    it('同一 CTA 先の重複が除去される（高い優先度が残る）', () => {
      // highIntensity (P0 → /planning-sheet-list) と
      // timeConcentration (P1 → /planning-sheet-list) は同一 CTA
      const input = createBaseInput({
        highIntensityEvents: [
          { id: '1', intensity: 4, recordedAt: '2026-03-18T10:00:00Z' },
          { id: '2', intensity: 5, recordedAt: '2026-03-19T11:00:00Z' },
          { id: '3', intensity: 4, recordedAt: '2026-03-20T09:00:00Z' },
        ],
        heatmapPeak: { hour: 14, count: 15, totalEvents: 20, concentration: 0.75 },
      });

      const result = buildCorrectiveActions(input, NOW);
      const planningSheetSuggestions = result.filter(
        (r) => r.cta.route === '/planning-sheet-list',
      );

      // dedupe で 1 件に絞られる
      expect(planningSheetSuggestions).toHaveLength(1);
      // P0 が残る
      expect(planningSheetSuggestions[0]!.priority).toBe('P0');
    });
  });
});
