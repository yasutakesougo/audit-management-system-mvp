/**
 * resolveSourceRefPath — ユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { resolveSourceRefPath } from '../types';
import type { TimelineSourceRef } from '../types';

describe('resolveSourceRefPath', () => {
  it('daily → /daily/table', () => {
    const ref: TimelineSourceRef = { source: 'daily', date: '2026-03-15', recordId: 1 };
    expect(resolveSourceRefPath(ref)).toBe('/daily/table');
  });

  it('incident → /incidents?incidentId=INC-001', () => {
    const ref: TimelineSourceRef = { source: 'incident', incidentId: 'INC-001' };
    expect(resolveSourceRefPath(ref)).toBe('/incidents?incidentId=INC-001');
  });

  it('isp → /support-plan-guide', () => {
    const ref: TimelineSourceRef = { source: 'isp', ispId: 'ISP-001' };
    expect(resolveSourceRefPath(ref)).toBe('/support-plan-guide');
  });

  it('handoff → /handoff-timeline', () => {
    const ref: TimelineSourceRef = { source: 'handoff', handoffId: 100 };
    expect(resolveSourceRefPath(ref)).toBe('/handoff-timeline');
  });

  it('incident — encodes special characters in incidentId', () => {
    const ref: TimelineSourceRef = { source: 'incident', incidentId: 'INC/2026&01' };
    expect(resolveSourceRefPath(ref)).toBe('/incidents?incidentId=INC%2F2026%2601');
  });
});
