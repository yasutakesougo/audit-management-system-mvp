/**
 * ispAdapter — ユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { ispToTimelineEvent } from '../adapters/ispAdapter';
import type { IndividualSupportPlan } from '@/domain/isp/schema';

const makeIsp = (
  overrides: Partial<IndividualSupportPlan> = {},
): IndividualSupportPlan =>
  ({
    id: 'ISP-001',
    userId: 'U001',
    title: '2026年度 個別支援計画',
    planStartDate: '2026-04-01',
    planEndDate: '2027-03-31',
    userIntent: '自立した生活',
    familyIntent: '',
    overallSupportPolicy: '丁寧な支援',
    qolIssues: '',
    longTermGoals: ['就労定着'],
    shortTermGoals: ['出席率90%'],
    supportSummary: '',
    precautions: '',
    consentAt: null,
    deliveredAt: null,
    monitoringSummary: '',
    lastMonitoringAt: null,
    nextReviewAt: null,
    status: 'active',
    isCurrent: true,
    createdAt: '2026-03-15',
    createdBy: 'admin',
    updatedAt: '2026-03-15',
    updatedBy: 'admin',
    version: 1,
    ...overrides,
  }) as IndividualSupportPlan;

describe('ispToTimelineEvent', () => {
  it('基本変換: id, source, userId が正しい', () => {
    const result = ispToTimelineEvent(makeIsp());
    expect(result.id).toBe('isp-ISP-001');
    expect(result.source).toBe('isp');
    expect(result.userId).toBe('U001');
    expect(result.sourceRef).toEqual({ source: 'isp', ispId: 'ISP-001' });
  });

  it('occurredAt に createdAt が使われる', () => {
    const result = ispToTimelineEvent(makeIsp({ createdAt: '2026-04-01' }));
    expect(result.occurredAt).toBe('2026-04-01');
  });

  it('severity は常に info', () => {
    const result = ispToTimelineEvent(makeIsp());
    expect(result.severity).toBe('info');
  });

  it('title にステータスの日本語ラベルが含まれる', () => {
    const result = ispToTimelineEvent(makeIsp({ status: 'active' }));
    expect(result.title).toBe('個別支援計画 (実施中)');
  });

  it('title: assessment → アセスメント', () => {
    const result = ispToTimelineEvent(makeIsp({ status: 'assessment' }));
    expect(result.title).toBe('個別支援計画 (アセスメント)');
  });

  it('title: monitoring → モニタリング', () => {
    const result = ispToTimelineEvent(makeIsp({ status: 'monitoring' }));
    expect(result.title).toBe('個別支援計画 (モニタリング)');
  });

  it('meta に status と version が含まれる', () => {
    const result = ispToTimelineEvent(makeIsp({ status: 'active', version: 3 }));
    expect(result.meta).toEqual({ status: 'active', version: 3 });
  });
});
