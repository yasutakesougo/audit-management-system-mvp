import { describe, expect, it } from 'vitest';
import { buildExecutionUserIdCandidates, getUserIdAliases } from '../normalizeExecutionLookup';

describe('getUserIdAliases', () => {
  it('resolves Nakamura aliases correctly', () => {
    expect(getUserIdAliases('I017')).toEqual(['7', 'U-006', 'I017', 'I022']);
    expect(getUserIdAliases('U-006')).toEqual(['7', 'U-006', 'I017', 'I022']);
    expect(getUserIdAliases('7')).toEqual(['7', 'U-006', 'I017', 'I022']);
  });

  it('returns empty array for unknown user ID', () => {
    expect(getUserIdAliases('unknown')).toEqual([]);
  });
});

describe('buildExecutionUserIdCandidates', () => {
  it('builds stable variants for numeric user id', () => {
    const candidates = buildExecutionUserIdCandidates('10');
    expect(candidates).toContain('10');
    expect(candidates).toContain('U10');
    expect(candidates).toContain('U010');
    expect(candidates).toContain('U-010');
  });

  it('builds stable variants for non-default prefix', () => {
    const candidates = buildExecutionUserIdCandidates('I005');
    expect(candidates).toContain('5');
    expect(candidates).toContain('I5');
    expect(candidates).toContain('I005');
    expect(candidates).toContain('I-005');
  });

  it('keeps unique candidates when mixed formats are provided', () => {
    const candidates = buildExecutionUserIdCandidates('10', 'U-010', 'U010');
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it('expands logical aliases when user ID has matched group', () => {
    const candidates = buildExecutionUserIdCandidates('I017');
    expect(candidates).toContain('I017');
    expect(candidates).toContain('U-006');
    expect(candidates).toContain('7');
    expect(candidates).toContain('I022');
  });
});
