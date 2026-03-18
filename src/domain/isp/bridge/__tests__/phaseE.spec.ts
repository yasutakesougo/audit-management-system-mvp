/**
 * Phase E テスト
 *
 * 1. buildDailySupportUrl — URL 構築
 * 2. RegulatorySummaryBand / shouldRecommendReanalysis — 制度サマリー帯ロジック
 * 3. /daily/support planningSheetId 受け取り
 */
import { describe, expect, it } from 'vitest';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';
import { shouldRecommendReanalysis } from '@/features/support-plan-guide/components/RegulatorySummaryBand';

// =====================
// buildDailySupportUrl
// =====================

describe('buildDailySupportUrl', () => {
  it('builds URL with userId only', () => {
    const url = buildDailySupportUrl('U001');
    expect(url).toBe('/daily/support?userId=U001');
  });

  it('builds URL with userId and planningSheetId', () => {
    const url = buildDailySupportUrl('U001', 'PS001');
    expect(url).toBe('/daily/support?userId=U001&planningSheetId=PS001');
  });

  it('omits planningSheetId when undefined', () => {
    const url = buildDailySupportUrl('U001', undefined);
    expect(url).toBe('/daily/support?userId=U001');
  });

  it('omits planningSheetId when empty string', () => {
    const url = buildDailySupportUrl('U001', '');
    expect(url).toBe('/daily/support?userId=U001');
  });

  it('encodes special characters in userId', () => {
    const url = buildDailySupportUrl('user 001');
    expect(url).toContain('userId=user+001');
  });
});

// =====================
// shouldRecommendReanalysis
// =====================

describe('shouldRecommendReanalysis', () => {
  it('recommends when monitoring is null', () => {
    expect(shouldRecommendReanalysis(null)).toBe(true);
  });

  it('recommends when monitoring is undefined', () => {
    expect(shouldRecommendReanalysis(undefined)).toBe(true);
  });

  it('recommends when planChangeRequired is true', () => {
    expect(shouldRecommendReanalysis({
      date: new Date().toISOString().slice(0, 10),
      planChangeRequired: true,
    })).toBe(true);
  });

  it('does not recommend when recent and no change required', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    expect(shouldRecommendReanalysis({
      date: recentDate.toISOString().slice(0, 10),
      planChangeRequired: false,
    })).toBe(false);
  });

  it('recommends when monitoring is older than 180 days', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200);
    expect(shouldRecommendReanalysis({
      date: oldDate.toISOString().slice(0, 10),
      planChangeRequired: false,
    })).toBe(true);
  });

  it('does not recommend at exactly 179 days', () => {
    const borderDate = new Date();
    borderDate.setDate(borderDate.getDate() - 179);
    expect(shouldRecommendReanalysis({
      date: borderDate.toISOString().slice(0, 10),
      planChangeRequired: false,
    })).toBe(false);
  });
});
