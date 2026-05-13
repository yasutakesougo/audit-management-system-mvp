import { describe, expect, it } from 'vitest';
import { buildExecutionUserIdCandidates } from '../normalizeExecutionLookup';

describe('buildExecutionUserIdCandidates', () => {
  it('builds stable variants for numeric user id', () => {
    const candidates = buildExecutionUserIdCandidates('10');
    expect(candidates).toContain('10');
    expect(candidates).toContain('U10');
    expect(candidates).toContain('U010');
    expect(candidates).toContain('U-010');
  });

  it('keeps unique candidates when mixed formats are provided', () => {
    const candidates = buildExecutionUserIdCandidates('10', 'U-010', 'U010');
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
