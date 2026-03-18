/**
 * Phase E テスト
 *
 * 1. buildDailySupportUrl — URL 構築
 * 2. RegulatorySummaryBand / shouldRecommendReanalysis — 制度サマリー帯ロジック
 * 3. /daily/support planningSheetId 受け取り
 */
import { describe, expect, it } from 'vitest';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';

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
