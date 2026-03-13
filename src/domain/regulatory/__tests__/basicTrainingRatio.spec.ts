/**
 * 基礎研修修了者比率 — スナップショット生成のテスト
 *
 * @see src/domain/regulatory/basicTrainingRatio.ts
 */
import { describe, it, expect } from 'vitest';
import {
  createBasicTrainingRatioSnapshot,
  formatRatioSummary,
} from '../basicTrainingRatio';
import type { StaffDetail } from '../basicTrainingRatio';

// ─────────────────────────────────────────────
// テストヘルパー
// ─────────────────────────────────────────────

function makeStaff(overrides: Partial<StaffDetail> & { staffId: string }): StaffDetail {
  return {
    staffName: `テスト職員_${overrides.staffId}`,
    employmentType: 'full_time',
    role: 'life_support',
    hasBasicTraining: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// createBasicTrainingRatioSnapshot
// ─────────────────────────────────────────────

describe('createBasicTrainingRatioSnapshot', () => {
  it('生活支援員5人中1人修了 → 20% 充足', () => {
    const staff = [
      makeStaff({ staffId: 'S1', hasBasicTraining: true }),
      makeStaff({ staffId: 'S2' }),
      makeStaff({ staffId: 'S3' }),
      makeStaff({ staffId: 'S4' }),
      makeStaff({ staffId: 'S5' }),
    ];

    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');

    expect(snapshot.totalLifeSupportStaff).toBe(5);
    expect(snapshot.basicTrainingCompleted).toBe(1);
    expect(snapshot.ratio).toBeCloseTo(0.20);
    expect(snapshot.fulfilled).toBe(true);
    expect(snapshot.calculatedBy).toBe('admin');
  });

  it('生活支援員以外（other）は分母に含めない', () => {
    const staff = [
      makeStaff({ staffId: 'S1', role: 'life_support', hasBasicTraining: true }),
      makeStaff({ staffId: 'S2', role: 'life_support' }),
      makeStaff({ staffId: 'S3', role: 'other', hasBasicTraining: true }),
    ];

    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');

    expect(snapshot.totalLifeSupportStaff).toBe(2);
    expect(snapshot.basicTrainingCompleted).toBe(1);
    expect(snapshot.ratio).toBeCloseTo(0.50);
  });

  it('非常勤も実人数にカウントする', () => {
    const staff = [
      makeStaff({ staffId: 'S1', employmentType: 'full_time', hasBasicTraining: true }),
      makeStaff({ staffId: 'S2', employmentType: 'part_time' }),
      makeStaff({ staffId: 'S3', employmentType: 'part_time' }),
      makeStaff({ staffId: 'S4', employmentType: 'full_time' }),
      makeStaff({ staffId: 'S5', employmentType: 'part_time' }),
    ];

    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');

    expect(snapshot.totalLifeSupportStaff).toBe(5);
    expect(snapshot.fullTimeCount).toBe(2);
    expect(snapshot.partTimeCount).toBe(3);
    expect(snapshot.ratio).toBeCloseTo(0.20);
    expect(snapshot.fulfilled).toBe(true);
  });

  it('常勤換算ではなく実人数で算出する（パート0.5人ではなく1人扱い）', () => {
    // 非常勤3人全員が修了 → 3/5 = 60%
    const staff = [
      makeStaff({ staffId: 'S1', employmentType: 'full_time' }),
      makeStaff({ staffId: 'S2', employmentType: 'full_time' }),
      makeStaff({ staffId: 'S3', employmentType: 'part_time', hasBasicTraining: true }),
      makeStaff({ staffId: 'S4', employmentType: 'part_time', hasBasicTraining: true }),
      makeStaff({ staffId: 'S5', employmentType: 'part_time', hasBasicTraining: true }),
    ];

    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');

    expect(snapshot.totalLifeSupportStaff).toBe(5);
    expect(snapshot.basicTrainingCompleted).toBe(3);
    expect(snapshot.ratio).toBeCloseTo(0.60);
    expect(snapshot.fulfilled).toBe(true);
  });

  it('空の職員リスト → 0人/0人 = NG', () => {
    const snapshot = createBasicTrainingRatioSnapshot([], 'admin', '2026-03-13T00:00:00Z');

    expect(snapshot.totalLifeSupportStaff).toBe(0);
    expect(snapshot.ratio).toBe(0);
    expect(snapshot.fulfilled).toBe(false);
  });

  it('staffDetails に生活支援員だけが含まれる', () => {
    const staff = [
      makeStaff({ staffId: 'S1', role: 'life_support' }),
      makeStaff({ staffId: 'S2', role: 'other' }),
      makeStaff({ staffId: 'S3', role: 'life_support' }),
    ];

    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');

    expect(snapshot.staffDetails).toHaveLength(2);
    expect(snapshot.staffDetails.every((s) => s.role === 'life_support')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// formatRatioSummary
// ─────────────────────────────────────────────

describe('formatRatioSummary', () => {
  it('充足時のサマリに ✅ が含まれる', () => {
    const staff = [
      makeStaff({ staffId: 'S1', hasBasicTraining: true }),
      makeStaff({ staffId: 'S2' }),
      makeStaff({ staffId: 'S3' }),
      makeStaff({ staffId: 'S4' }),
      makeStaff({ staffId: 'S5' }),
    ];
    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');
    const summary = formatRatioSummary(snapshot);

    expect(summary).toContain('✅');
    expect(summary).toContain('20.0%');
    expect(summary).toContain('1/5人');
  });

  it('未充足時のサマリに ❌ が含まれる', () => {
    const staff = [
      makeStaff({ staffId: 'S1' }),
      makeStaff({ staffId: 'S2' }),
      makeStaff({ staffId: 'S3' }),
      makeStaff({ staffId: 'S4' }),
      makeStaff({ staffId: 'S5' }),
      makeStaff({ staffId: 'S6' }),
    ];
    const snapshot = createBasicTrainingRatioSnapshot(staff, 'admin', '2026-03-13T00:00:00Z');
    const summary = formatRatioSummary(snapshot);

    expect(summary).toContain('❌');
    expect(summary).toContain('0/6人');
  });
});
