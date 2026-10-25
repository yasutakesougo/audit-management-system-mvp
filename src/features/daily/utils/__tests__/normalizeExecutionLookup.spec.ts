import { describe, expect, it } from 'vitest';
import {
  buildExecutionUserIdCandidates,
  getUserIdAliases,
  normalizeExecutionUserId,
} from '../normalizeExecutionLookup';

describe('getUserIdAliases', () => {
  // Hardcoded alias groups (e.g. Nakamura group containing 7, U-006, I017, I022) were removed
  // to eliminate the root cause of the cross-user record contamination incident.
  it('returns empty array instead of expanding dangerous cross-user alias groups', () => {
    expect(getUserIdAliases('I017')).toEqual([]);
    expect(getUserIdAliases('U-006')).toEqual([]);
    expect(getUserIdAliases('7')).toEqual([]);
  });

  it('returns empty array for unknown user ID', () => {
    expect(getUserIdAliases('unknown')).toEqual([]);
  });
});

describe('buildExecutionUserIdCandidates', () => {
  // Synthetic prefixes (e.g. converting numeric 10 to U10, U-010) were eliminated
  // because synthetic prefixing caused collisions with other users.
  it('builds exact candidates without synthetic prefixes for numeric user id', () => {
    const candidates = buildExecutionUserIdCandidates('10');
    expect(candidates).toEqual(['10']);
  });

  // Prefix stripping (e.g. stripping 'I' from 'I005' to produce '5') was eliminated
  // because it conflated distinct users across different numbering schemes.
  it('preserves exact identifier without prefix-stripping for alphanumeric user id', () => {
    const candidates = buildExecutionUserIdCandidates('I005');
    expect(candidates).toEqual(['I005']);
  });

  it('keeps unique candidates when mixed formats are provided', () => {
    const candidates = buildExecutionUserIdCandidates('10', 'U-010', 'U010');
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates).toEqual(['10', 'U-010', 'U010']);
  });

  // Verification that User 17 (I017) never aliases to User 6 (U-006)
  it('never expands cross-user aliases into candidates', () => {
    const candidates = buildExecutionUserIdCandidates('I017');
    expect(candidates).toEqual(['I017']);
    expect(candidates).not.toContain('U-006');
    expect(candidates).not.toContain('7');
    expect(candidates).not.toContain('I022');
  });

  // Strict exact match requirements:
  // - IDs with leading/trailing whitespace and without whitespace are treated as distinct values
  // - Pure whitespace candidates are excluded
  it('treats IDs with whitespace and without whitespace as distinct values and excludes whitespace-only candidates', () => {
    const candidates = buildExecutionUserIdCandidates('   ', ' U001 ', 'U001', '  ', 'U001', ' U001 ');
    expect(candidates).toEqual([' U001 ', 'U001']);
  });
});

describe('normalizeExecutionUserId', () => {
  it('preserves exact raw string with whitespace while excluding whitespace-only strings', () => {
    expect(normalizeExecutionUserId(' U001 ')).toBe(' U001 ');
    expect(normalizeExecutionUserId('U001')).toBe('U001');
    expect(normalizeExecutionUserId('   ')).toBe('');
    expect(normalizeExecutionUserId('')).toBe('');
    expect(normalizeExecutionUserId(101)).toBe('101');
  });
});
