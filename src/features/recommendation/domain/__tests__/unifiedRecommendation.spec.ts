/**
 * @fileoverview 統合推奨エンジンの単体テスト
 * @description
 * MVP-013: buildUnifiedRecommendation / buildUnifiedRecommendations のテスト
 */
import { describe, it, expect } from 'vitest';
import {
  buildUnifiedRecommendation,
  buildUnifiedRecommendations,
  type UnifiedRecommendationInput,
} from '../unifiedRecommendation';

// ─── ヘルパー ────────────────────────────────────────────────────

function makeInput(overrides: Partial<UnifiedRecommendationInput> = {}): UnifiedRecommendationInput {
  return {
    userId: 'U-001',
    contextAlerts: [],
    todaySnapshot: null,
    hasRecordToday: true,
    criticalHandoffCount: 0,
    hasPlan: true,
    isHighIntensity: false,
    ...overrides,
  };
}

// ─── buildUnifiedRecommendation ───────────────────────────────────

describe('buildUnifiedRecommendation', () => {
  // ── 優先度テスト ──────────────────────────────────────────────

  it('criticalHandoffCount > 0 なら critical-handoff が最優先', () => {
    const result = buildUnifiedRecommendation(makeInput({ criticalHandoffCount: 2 }));
    expect(result.primaryFactor).toBe('critical-handoff');
    expect(result.urgency).toBe('critical');
  });

  it('記録未入力は missing-record (critical-handoff がなければ)', () => {
    const result = buildUnifiedRecommendation(makeInput({ hasRecordToday: false }));
    expect(result.primaryFactor).toBe('missing-record');
    expect(result.urgency).toBe('high');
  });

  it('記録未入力 + 重要申し送り → critical-handoff が優先', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, criticalHandoffCount: 1 }),
    );
    expect(result.primaryFactor).toBe('critical-handoff');
  });

  it('強度行動障害対象者は high-intensity (他に緊急事項がなければ)', () => {
    const result = buildUnifiedRecommendation(makeInput({ isHighIntensity: true }));
    expect(result.primaryFactor).toBe('high-intensity');
    expect(result.urgency).toBe('high');
  });

  it('todaySnapshot urgency=high → snapshot-urgent (他に緊急事項がなければ)', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        todaySnapshot: {
          nextAction: '記録を入力してください',
          nextActionPath: '/dailysupport',
          urgency: 'high',
        },
      }),
    );
    expect(result.primaryFactor).toBe('snapshot-urgent');
  });

  it('ISP 未作成 → missing-plan (最低優先)', () => {
    const result = buildUnifiedRecommendation(makeInput({ hasPlan: false }));
    expect(result.primaryFactor).toBe('missing-plan');
    expect(result.urgency).toBe('medium');
  });

  it('すべて問題なし → no-issues', () => {
    const result = buildUnifiedRecommendation(makeInput());
    expect(result.primaryFactor).toBe('no-issues');
    expect(result.urgency).toBe('low');
  });

  // ── headline / suggestedAction ─────────────────────────────────

  it('headline と suggestedAction が空でない', () => {
    const result = buildUnifiedRecommendation(makeInput({ criticalHandoffCount: 1 }));
    expect(result.headline).toBeTruthy();
    expect(result.suggestedAction).toBeTruthy();
  });

  it('missing-record の actionRoute に userId が含まれる', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, userId: 'U-ABC' }),
    );
    expect(result.actionRoute).toContain('U-ABC');
    expect(result.actionRoute).toContain('/daily/activity');
  });

  it('critical-handoff の actionRoute は /handoff/timeline', () => {
    const result = buildUnifiedRecommendation(makeInput({ criticalHandoffCount: 1 }));
    expect(result.actionRoute).toBe('/handoff/timeline');
  });

  // ── secondaryNotes ─────────────────────────────────────────────

  it('secondaryNotes は最大 2 件', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        criticalHandoffCount: 1,  // primary: critical-handoff
        hasRecordToday: false,    // → secondary
        hasPlan: false,           // → secondary (up to 2)
        isHighIntensity: true,    // → 3件目以降は切り捨て
      }),
    );
    expect(result.secondaryNotes.length).toBeLessThanOrEqual(2);
  });

  it('primary factor は secondaryNotes に含まれない', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        criticalHandoffCount: 1, // primary: critical-handoff
        hasRecordToday: false,   // secondary
      }),
    );
    // secondaryNotes に「重要申し送り」は入らない
    expect(result.secondaryNotes.some((n) => n.includes('申し送り'))).toBe(false);
    // 記録未入力は secondary に入る
    expect(result.secondaryNotes.some((n) => n.includes('記録'))).toBe(true);
  });

  it('問題なしの場合 secondaryNotes は空', () => {
    expect(buildUnifiedRecommendation(makeInput()).secondaryNotes).toHaveLength(0);
  });

  // ── contextAlerts フォールバック ───────────────────────────────

  it('contextAlerts の error alert が factor 決定に寄与する (他に緊急事項がなければ)', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        contextAlerts: [
          { key: 'critical-handoff', level: 'error', message: '重要な申し送り' },
        ],
        criticalHandoffCount: 0, // 手動シグナルは 0
        hasRecordToday: true,
        isHighIntensity: false,
        hasPlan: true,
        todaySnapshot: null,
      }),
    );
    // alertFactor フォールバックより no-issues になるはずだが
    // alert key が critical-handoff でも criticalHandoffCount=0 なので
    // detectFactorFromAlerts → critical-handoff を返すが優先ロジックより後
    // → alertFactor ブランチに入る
    expect(result.primaryFactor).toBe('critical-handoff');
  });
});

// ─── buildUnifiedRecommendations ─────────────────────────────────

describe('buildUnifiedRecommendations', () => {
  it('複数利用者分の Map を返す', () => {
    const inputs = [
      makeInput({ userId: 'U-001' }),
      makeInput({ userId: 'U-002', criticalHandoffCount: 1 }),
    ];
    const map = buildUnifiedRecommendations(inputs);
    expect(map.size).toBe(2);
    expect(map.get('U-001')?.primaryFactor).toBe('no-issues');
    expect(map.get('U-002')?.primaryFactor).toBe('critical-handoff');
  });

  it('空配列なら空 Map を返す', () => {
    expect(buildUnifiedRecommendations([])).toEqual(new Map());
  });
});
