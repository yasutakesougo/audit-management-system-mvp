/**
 * Phase E テスト
 *
 * 1. buildDailySupportUrl — URL 構築
 * 2. RegulatorySummaryBand / shouldRecommendReanalysis — 制度サマリー帯ロジック
 * 3. /daily/support planningSheetId 受け取り
 */
import { describe, expect, it } from 'vitest';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';
import { buildRegulatoryHudItems } from '@/features/support-plan-guide/domain/regulatoryHud';
import type { RegulatoryHudInput } from '@/features/support-plan-guide/domain/regulatoryHud';

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
// judgeIcebergAnalysis (via buildRegulatoryHudItems)
// =====================

describe('RegulatoryHudIcebergAnalysis', () => {
  const baseInput: RegulatoryHudInput = {
    ispStatus: 'active' as const,
    compliance: null,
    deadlines: {
      creation: { label: '', color: 'default' as const },
      monitoring: { label: '', color: 'default' as const },
    },
    latestMonitoring: null,
    icebergTotal: 1,
  };

  const getIcebergSignal = (latestMonitoring: { date: string; planChangeRequired: boolean } | null | undefined, icebergTotal = 1) => {
    const items = buildRegulatoryHudItems({ ...baseInput, latestMonitoring, icebergTotal });
    return items.find((i) => i.key === 'iceberg-analysis')?.signal;
  };

  it('danger when monitoring is null', () => {
    expect(getIcebergSignal(null)).toBe('danger');
  });

  it('danger when monitoring is undefined', () => {
    expect(getIcebergSignal(undefined)).toBe('danger');
  });

  it('warning when planChangeRequired is true', () => {
    expect(getIcebergSignal({
      date: new Date().toISOString().slice(0, 10),
      planChangeRequired: true,
    })).toBe('warning');
  });

  it('ok when recent and no change required', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    expect(getIcebergSignal({
      date: recentDate.toISOString().slice(0, 10),
      planChangeRequired: false,
    })).toBe('ok');
  });

  it('warning when monitoring is older than 180 days', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200);
    expect(getIcebergSignal({
      date: oldDate.toISOString().slice(0, 10),
      planChangeRequired: false,
    })).toBe('warning');
  });

  it('ok at exactly 179 days', () => {
    const borderDate = new Date();
    borderDate.setDate(borderDate.getDate() - 179);
    expect(getIcebergSignal({
      date: borderDate.toISOString().slice(0, 10),
      planChangeRequired: false,
    })).toBe('ok');
  });
});
