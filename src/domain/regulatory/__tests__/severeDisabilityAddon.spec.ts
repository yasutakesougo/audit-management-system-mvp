/**
 * 重度障害者支援加算（Ⅱ）（Ⅲ）— 判定ロジックのテスト
 *
 * フィードバックで指定された初期テストケース8件を含む。
 *
 * @see src/domain/regulatory/severeDisabilityAddon.ts
 */
import { describe, it, expect } from 'vitest';
import {
  checkUserEligibility,
  checkBasicTrainingRatio,
  checkAuthoringRequirement,
  checkQuarterlyReview,
  evaluateSevereDisabilityAddOn,
} from '../severeDisabilityAddon';
import type { StaffQualificationProfile } from '../staffQualificationProfile';

// ─────────────────────────────────────────────
// テストヘルパー
// ─────────────────────────────────────────────

function makeProfile(overrides: Partial<StaffQualificationProfile> = {}): StaffQualificationProfile {
  return {
    staffId: 'STAFF-001',
    hasPracticalTraining: false,
    hasBasicTraining: false,
    hasBehaviorGuidanceTraining: false,
    hasCorePersonTraining: false,
    certificationCheckedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// checkUserEligibility
// ─────────────────────────────────────────────

describe('checkUserEligibility', () => {
  it('区分6・行動10 → tier2 basic', () => {
    const result = checkUserEligibility('6', 10);
    expect(result.tier2).toBe(true);
    expect(result.tier3).toBe(true); // tier2 該当なら tier3 も該当
    expect(result.isUpperTier).toBe(false);
  });

  it('区分4・行動10 → tier3 basic (tier2 は NG)', () => {
    const result = checkUserEligibility('4', 10);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(true);
    expect(result.isUpperTier).toBe(false);
  });

  it('行動18以上 → upper 判定', () => {
    const result = checkUserEligibility('6', 18);
    expect(result.tier2).toBe(true);
    expect(result.isUpperTier).toBe(true);
  });

  it('行動24（最大値） → upper 判定', () => {
    const result = checkUserEligibility('6', 24);
    expect(result.isUpperTier).toBe(true);
  });

  it('行動9（閾値未満） → どちらも NG', () => {
    const result = checkUserEligibility('6', 9);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(false);
  });

  it('区分3 → tier2/tier3 ともに NG', () => {
    const result = checkUserEligibility('3', 15);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(false);
  });

  it('区分5・行動10 → tier3 のみ', () => {
    const result = checkUserEligibility('5', 10);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(true);
  });

  it('null 値 → 安全に false を返す', () => {
    const result = checkUserEligibility(null, null);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(false);
    expect(result.isUpperTier).toBe(false);
  });

  it('undefined 値 → 安全に false を返す', () => {
    const result = checkUserEligibility(undefined, undefined);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(false);
  });
});

// ─────────────────────────────────────────────
// checkBasicTrainingRatio
// ─────────────────────────────────────────────

describe('checkBasicTrainingRatio', () => {
  it('基礎研修比率 19% → NG', () => {
    // 100人中19人 = 19%
    const result = checkBasicTrainingRatio(100, 19);
    expect(result.fulfilled).toBe(false);
    expect(result.ratio).toBeCloseTo(0.19);
  });

  it('基礎研修比率 20% → OK', () => {
    // 100人中20人 = 20%
    const result = checkBasicTrainingRatio(100, 20);
    expect(result.fulfilled).toBe(true);
    expect(result.ratio).toBeCloseTo(0.20);
  });

  it('基礎研修比率ちょうど20%（5人中1人） → OK', () => {
    const result = checkBasicTrainingRatio(5, 1);
    expect(result.fulfilled).toBe(true);
    expect(result.ratio).toBeCloseTo(0.20);
  });

  it('基礎研修比率 19.9%（1000人中199人） → NG', () => {
    const result = checkBasicTrainingRatio(1000, 199);
    expect(result.fulfilled).toBe(false);
  });

  it('全員修了 → OK (100%)', () => {
    const result = checkBasicTrainingRatio(10, 10);
    expect(result.fulfilled).toBe(true);
    expect(result.ratio).toBe(1.0);
  });

  it('0人 → NG (ゼロ除算防止)', () => {
    const result = checkBasicTrainingRatio(0, 0);
    expect(result.fulfilled).toBe(false);
    expect(result.ratio).toBe(0);
  });
});

// ─────────────────────────────────────────────
// checkAuthoringRequirement
// ─────────────────────────────────────────────

describe('checkAuthoringRequirement', () => {
  it('basic — 実践研修修了者 → OK', () => {
    const profile = makeProfile({ hasPracticalTraining: true });
    const result = checkAuthoringRequirement('basic', profile, false);
    expect(result.fulfilled).toBe(true);
  });

  it('basic — 中核的人材 → OK', () => {
    const profile = makeProfile({ hasCorePersonTraining: true });
    const result = checkAuthoringRequirement('basic', profile, false);
    expect(result.fulfilled).toBe(true);
  });

  it('basic — 基礎研修のみ → NG', () => {
    const profile = makeProfile({ hasBasicTraining: true });
    const result = checkAuthoringRequirement('basic', profile, false);
    expect(result.fulfilled).toBe(false);
  });

  it('upper — 中核的人材 → OK', () => {
    const profile = makeProfile({ hasCorePersonTraining: true });
    const result = checkAuthoringRequirement('upper', profile, false);
    expect(result.fulfilled).toBe(true);
  });

  it('upper — 実践研修 + 中核的人材の助言あり → OK', () => {
    const profile = makeProfile({ hasPracticalTraining: true });
    const result = checkAuthoringRequirement('upper', profile, true);
    expect(result.fulfilled).toBe(true);
  });

  it('upper — core person advice なし → NG', () => {
    const profile = makeProfile({ hasPracticalTraining: true });
    const result = checkAuthoringRequirement('upper', profile, false);
    expect(result.fulfilled).toBe(false);
    expect(result.reason).toContain('助言');
  });

  it('upper — 資格なし → NG', () => {
    const profile = makeProfile();
    const result = checkAuthoringRequirement('upper', profile, true);
    expect(result.fulfilled).toBe(false);
  });
});

// ─────────────────────────────────────────────
// checkQuarterlyReview
// ─────────────────────────────────────────────

describe('checkQuarterlyReview', () => {
  it('90日以内 → OK', () => {
    const result = checkQuarterlyReview('2026-01-01', '2026-03-31');
    expect(result.fulfilled).toBe(true);
    expect(result.daysSinceLastReview).toBe(89);
  });

  it('90日ちょうど → OK', () => {
    const result = checkQuarterlyReview('2026-01-01', '2026-04-01');
    expect(result.fulfilled).toBe(true);
    expect(result.daysSinceLastReview).toBe(90);
  });

  it('3か月見直し超過 → NG', () => {
    const result = checkQuarterlyReview('2026-01-01', '2026-04-02');
    expect(result.fulfilled).toBe(false);
    expect(result.daysSinceLastReview).toBe(91);
  });

  it('lastReviewDate が null → NG', () => {
    const result = checkQuarterlyReview(null);
    expect(result.fulfilled).toBe(false);
    expect(result.daysSinceLastReview).toBeNull();
  });
});

// ─────────────────────────────────────────────
// evaluateSevereDisabilityAddOn — 統合テスト
// ─────────────────────────────────────────────

describe('evaluateSevereDisabilityAddOn', () => {
  const baseParams = {
    tier: 'tier2' as const,
    user: { supportLevel: '6', behaviorScore: 12 },
    staffRatio: { total: 10, basicTrainingCount: 3 },
    author: makeProfile({ hasPracticalTraining: true }),
    hasCorePersonAdvice: false,
    weeklyObservationFulfilled: true,
    lastReviewDate: '2026-02-01',
    referenceDate: '2026-03-13',
  };

  it('全要件充足 → eligible = true', () => {
    const result = evaluateSevereDisabilityAddOn(baseParams);
    expect(result.eligible).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);
    expect(result.subTier).toBe('basic');
  });

  it('週次観察不足 → NG', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      weeklyObservationFulfilled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.unmetRequirements).toContain('週次観察（週1回以上）');
  });

  it('3か月見直し超過 → NG', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      lastReviewDate: '2025-11-01',
    });
    expect(result.eligible).toBe(false);
    expect(result.unmetRequirements).toContain('3か月見直し');
  });

  it('tier3 — 区分4 → eligible', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      tier: 'tier3',
      user: { supportLevel: '4', behaviorScore: 15 },
    });
    expect(result.eligible).toBe(true);
    expect(result.tier).toBe('tier3');
  });

  it('upper 判定 — 行動18以上で適切な作成者 → OK', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      user: { supportLevel: '6', behaviorScore: 20 },
      author: makeProfile({ hasCorePersonTraining: true }),
    });
    expect(result.eligible).toBe(true);
    expect(result.subTier).toBe('upper');
  });

  it('upper 判定 — 実践研修のみ＋助言なし → NG', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      user: { supportLevel: '6', behaviorScore: 20 },
      hasCorePersonAdvice: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.unmetRequirements).toEqual(
      expect.arrayContaining([expect.stringContaining('作成者要件')]),
    );
  });

  it('基礎研修比率不足 → NG', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      staffRatio: { total: 10, basicTrainingCount: 1 },
    });
    expect(result.eligible).toBe(false);
    expect(result.unmetRequirements).toContain('基礎研修修了者比率（20%以上）');
  });

  it('複数要件が未充足 → 全て unmetRequirements に列挙', () => {
    const result = evaluateSevereDisabilityAddOn({
      ...baseParams,
      user: { supportLevel: '3', behaviorScore: 5 },
      staffRatio: { total: 10, basicTrainingCount: 0 },
      weeklyObservationFulfilled: false,
      lastReviewDate: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.unmetRequirements.length).toBeGreaterThanOrEqual(4);
  });
});
