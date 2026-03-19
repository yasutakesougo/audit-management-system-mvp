import { describe, expect, it } from 'vitest';
import { computeCtaKpisByRole, type TelemetryRecordWithRole } from '../computeCtaKpisByRole';

// ── Helpers ─────────────────────────────────────────────────────────────────

function ctaClick(ctaId: string, role?: 'staff' | 'admin' | 'unknown'): TelemetryRecordWithRole {
  return { type: 'todayops_cta_click', ctaId, role };
}

function landing(role?: 'staff' | 'admin' | 'unknown'): TelemetryRecordWithRole {
  return { type: 'todayops_landing', role };
}

// Hero CTA
const HERO_CTA = 'daily_hero_clicked';
// Queue CTA
const QUEUE_CTA = 'daily_queue_item_clicked';
// Done CTA (= completion)
const DONE_CTA = 'daily_hero_all_completed_clicked';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('computeCtaKpisByRole', () => {
  it('role別に分割される', () => {
    const records: TelemetryRecordWithRole[] = [
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(QUEUE_CTA, 'admin'),
    ];
    const result = computeCtaKpisByRole(records);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('staff');
    expect(result[1].role).toBe('admin');
  });

  it('staffのみ → 1要素', () => {
    const records: TelemetryRecordWithRole[] = [
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(QUEUE_CTA, 'staff'),
    ];
    const result = computeCtaKpisByRole(records);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('staff');
    expect(result[0].totalCtaClicks).toBe(2);
  });

  it('複数role → hero/queue計算が正しい', () => {
    const records: TelemetryRecordWithRole[] = [
      // staff: 3 hero, 1 queue → heroRate 75%
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(QUEUE_CTA, 'staff'),
      // admin: 1 hero, 3 queue → heroRate 25%
      ctaClick(HERO_CTA, 'admin'),
      ctaClick(QUEUE_CTA, 'admin'),
      ctaClick(QUEUE_CTA, 'admin'),
      ctaClick(QUEUE_CTA, 'admin'),
    ];
    const result = computeCtaKpisByRole(records);
    expect(result).toHaveLength(2);

    const staff = result.find((r) => r.role === 'staff')!;
    expect(staff.heroRate).toBe(75);
    expect(staff.queueRate).toBe(25);

    const admin = result.find((r) => r.role === 'admin')!;
    expect(admin.heroRate).toBe(25);
    expect(admin.queueRate).toBe(75);
  });

  it('CTAなしroleは除外される', () => {
    const records: TelemetryRecordWithRole[] = [
      ctaClick(HERO_CTA, 'staff'),
      // admin は landing だけ（CTA 0件）
      landing('admin'),
      landing('admin'),
    ];
    const result = computeCtaKpisByRole(records);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('staff');
  });

  it('role未指定は unknown にフォールバック', () => {
    const records: TelemetryRecordWithRole[] = [
      ctaClick(HERO_CTA),  // no role
      ctaClick(QUEUE_CTA), // no role
    ];
    const result = computeCtaKpisByRole(records);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('unknown');
    expect(result[0].totalCtaClicks).toBe(2);
  });

  it('完了率が正しく計算される', () => {
    const records: TelemetryRecordWithRole[] = [
      landing('staff'),
      landing('staff'),
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(HERO_CTA, 'staff'),
      ctaClick(DONE_CTA, 'staff'), // done = hero + completion
    ];
    const result = computeCtaKpisByRole(records);
    const staff = result[0];
    // 3 CTA clicks total (2 hero + 1 done), 1 done → completionRate = round(1/3*100) = 33
    expect(staff.completionRate).toBe(33);
  });

  it('表示順は staff → admin → unknown で固定', () => {
    const records: TelemetryRecordWithRole[] = [
      // 逆順で投入
      ctaClick(HERO_CTA),         // unknown
      ctaClick(HERO_CTA, 'admin'),
      ctaClick(HERO_CTA, 'staff'),
    ];
    const result = computeCtaKpisByRole(records);
    expect(result.map((r) => r.role)).toEqual(['staff', 'admin', 'unknown']);
  });

  it('空配列 → 空配列', () => {
    const result = computeCtaKpisByRole([]);
    expect(result).toEqual([]);
  });
});
