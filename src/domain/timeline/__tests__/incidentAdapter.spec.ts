/**
 * incidentAdapter — ユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { incidentToTimelineEvent } from '../adapters/incidentAdapter';
import type { HighRiskIncident, RiskSeverity } from '@/domain/support/highRiskIncident';

const makeIncident = (
  overrides: Partial<HighRiskIncident> = {},
): HighRiskIncident => ({
  id: 'INC-001',
  userId: 'U001',
  occurredAt: '2026-03-15T10:30:00Z',
  severity: '中',
  description: '他傷行動あり',
  ...overrides,
});

describe('incidentToTimelineEvent', () => {
  it('基本変換: id, source, userId が正しい', () => {
    const result = incidentToTimelineEvent(makeIncident());
    expect(result.id).toBe('incident-INC-001');
    expect(result.source).toBe('incident');
    expect(result.userId).toBe('U001');
    expect(result.sourceRef).toEqual({ source: 'incident', incidentId: 'INC-001' });
  });

  it('occurredAt がそのまま渡される', () => {
    const result = incidentToTimelineEvent(makeIncident());
    expect(result.occurredAt).toBe('2026-03-15T10:30:00Z');
  });

  it('title に severity が含まれる', () => {
    const result = incidentToTimelineEvent(makeIncident({ severity: '高' }));
    expect(result.title).toBe('インシデント (高)');
  });

  it.each<[RiskSeverity, string]>([
    ['低', 'info'],
    ['中', 'warning'],
    ['高', 'critical'],
    ['重大インシデント', 'critical'],
  ])('severity "%s" → "%s"', (input, expected) => {
    const result = incidentToTimelineEvent(makeIncident({ severity: input }));
    expect(result.severity).toBe(expected);
  });

  it('description が変換される', () => {
    const result = incidentToTimelineEvent(
      makeIncident({ description: 'テスト詳細' }),
    );
    expect(result.description).toBe('テスト詳細');
  });

  it('meta に severity が含まれる', () => {
    const result = incidentToTimelineEvent(makeIncident({ severity: '高' }));
    expect(result.meta).toEqual({ severity: '高' });
  });
});
