/**
 * RegulatorySummaryBand.spec.tsx
 *
 * 統合ビュー強化で追加した Chip（シート数・実施記録数・直近実施日・シート別内訳）と
 * 既存の Chip（ISP ステータス・Iceberg 分析件数・モニタリング・再分析推奨）の
 * 表示/非表示を検証するテスト。
 */
import { describe, it, expect } from 'vitest';
import { shouldRecommendReanalysis, totalRecordCount } from '@/features/support-plan-guide/components/RegulatorySummaryBand';

// ─────────────────────────────────────────────
// shouldRecommendReanalysis
// ─────────────────────────────────────────────

describe('shouldRecommendReanalysis', () => {
  it('returns true when monitoring is null', () => {
    expect(shouldRecommendReanalysis(null)).toBe(true);
  });

  it('returns true when monitoring is undefined', () => {
    expect(shouldRecommendReanalysis(undefined)).toBe(true);
  });

  it('returns true when planChangeRequired is true', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(shouldRecommendReanalysis({ date: today, planChangeRequired: true })).toBe(true);
  });

  it('returns true when monitoring is 180+ days old', () => {
    const old = new Date();
    old.setDate(old.getDate() - 200);
    expect(shouldRecommendReanalysis({ date: old.toISOString().slice(0, 10), planChangeRequired: false })).toBe(true);
  });

  it('returns false when monitoring is recent and no plan change required', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 30);
    expect(shouldRecommendReanalysis({ date: recent.toISOString().slice(0, 10), planChangeRequired: false })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// totalRecordCount
// ─────────────────────────────────────────────

describe('totalRecordCount', () => {
  it('returns 0 for undefined', () => {
    expect(totalRecordCount(undefined)).toBe(0);
  });

  it('returns 0 for empty object', () => {
    expect(totalRecordCount({})).toBe(0);
  });

  it('sums all values', () => {
    expect(totalRecordCount({ 'sheet-1': 3, 'sheet-2': 5 })).toBe(8);
  });

  it('handles single sheet', () => {
    expect(totalRecordCount({ 'sheet-1': 7 })).toBe(7);
  });
});
