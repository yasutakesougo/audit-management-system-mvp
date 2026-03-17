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

  it('incident → null (未実装)', () => {
    const ref: TimelineSourceRef = { source: 'incident', incidentId: 'INC-001' };
    expect(resolveSourceRefPath(ref)).toBeNull();
  });

  it('isp → /support-plan-guide', () => {
    const ref: TimelineSourceRef = { source: 'isp', ispId: 'ISP-001' };
    expect(resolveSourceRefPath(ref)).toBe('/support-plan-guide');
  });

  it('handoff → /handoff-timeline', () => {
    const ref: TimelineSourceRef = { source: 'handoff', handoffId: 100 };
    expect(resolveSourceRefPath(ref)).toBe('/handoff-timeline');
  });
});
