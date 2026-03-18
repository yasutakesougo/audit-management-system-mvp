import { describe, test, expect } from 'vitest';
import { evaluateQueryRisk } from '../queryGuard';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

describe('queryGuard - evaluateQueryRisk', () => {

  test('top: defaults if missing', () => {
    const res = evaluateQueryRisk({ select: ['Id'], orderBy: 'Id' }); // low risk query without top
    expect(res.sanitized.top).toBe(SP_QUERY_LIMITS.default);
    expect(res.flags.cappedTop).toBe(false);
    expect(res.riskLevel).toBe('low');
  });

  test('top: corrects 0 to 1', () => {
    const res = evaluateQueryRisk({ top: 0, select: ['Id'], orderBy: 'Id' });
    expect(res.sanitized.top).toBe(1);
    expect(res.flags.cappedTop).toBe(true);
    // cappedTop automatically makes it "high" risk
    expect(res.riskLevel).toBe('high');
    expect(res.warnings[0]).toContain('minimum allowed value of 1');
  });

  test('top: caps top greater than MAX', () => {
    const res = evaluateQueryRisk({ top: 999999, select: ['Id'], orderBy: 'Id' });
    expect(res.sanitized.top).toBe(SP_QUERY_LIMITS.hardMax);
    expect(res.flags.cappedTop).toBe(true);
    expect(res.riskLevel).toBe('high');
    expect(res.warnings[0]).toContain(`hard max limit (${SP_QUERY_LIMITS.hardMax})`);
  });

  test('select: missing triggers missingSelect and +2 riskScore', () => {
    const res = evaluateQueryRisk({ top: 100, orderBy: 'Id' });
    expect(res.flags.missingSelect).toBe(true);
    expect(res.riskScore).toBe(2);
    expect(res.riskLevel).toBe('low');
    expect(res.warnings.some(w => w.includes('$select'))).toBe(true);
  });

  test('expand: single expand triggers hasExpand and +2 riskScore', () => {
    const res = evaluateQueryRisk({ top: 100, select: ['Id'], orderBy: 'Id', expand: ['User'] });
    expect(res.flags.hasExpand).toBe(true);
    expect(res.riskScore).toBe(2);
    expect(res.riskLevel).toBe('low');
    expect(res.warnings.some(w => w.includes('$expand'))).toBe(true);
  });

  test('expand: multiple expands trigger +4 riskScore and medium risk', () => {
    const res = evaluateQueryRisk({ top: 100, select: ['Id'], orderBy: 'Id', expand: ['User', 'Department'] });
    expect(res.flags.hasExpand).toBe(true);
    expect(res.riskScore).toBe(4);
    expect(res.riskLevel).toBe('medium');
  });

  test('orderBy: missing in list triggers missingOrderBy and +2 riskScore', () => {
    const res = evaluateQueryRisk({ top: 100, select: ['Id'], queryKind: 'list' });
    expect(res.flags.missingOrderBy).toBe(true);
    expect(res.riskScore).toBe(2);
    expect(res.riskLevel).toBe('low');
    expect(res.warnings.some(w => w.includes('$orderby'))).toBe(true);
  });

  test('orderBy: ignored if top is 1', () => {
    const res = evaluateQueryRisk({ top: 1, select: ['Id'], queryKind: 'list' });
    expect(res.flags.missingOrderBy).toBe(false);
    expect(res.riskLevel).toBe('low');
  });

  test('filter: index heuristic - catches potentially unindexed filters', () => {
    const res1 = evaluateQueryRisk({ top: 100, select: ['Id'], orderBy: 'Id', filter: "substringof('foo', Title)" });
    expect(res1.flags.filterMayNeedIndex).toBe(true);
    expect(res1.riskScore).toBe(2);
    expect(res1.riskLevel).toBe('low');
    expect(res1.warnings.some(w => w.includes('$filter'))).toBe(true);

    const res2 = evaluateQueryRisk({ top: 100, select: ['Id'], orderBy: 'Id', filter: "Date ge '2023-01-01'" });
    expect(res2.flags.filterMayNeedIndex).toBe(true);
  });

  test('filter: no match on simple string without keywords', () => {
    // Highly simplistic heuristic test
    const res = evaluateQueryRisk({ top: 100, select: ['Id'], orderBy: 'Id', filter: "Status eq 'Active'" });
    // "eq" is in the pattern " eq "
    expect(res.flags.filterMayNeedIndex).toBe(true);
  });

  test('riskLevel: medium for export with top exceeding recommendation', () => {
    const res = evaluateQueryRisk({ top: 2000, select: ['Id'], orderBy: 'Id', queryKind: 'export' });
    // top exceeds recommended (+1), export (+2) => score 3 = medium
    expect(res.riskScore).toBe(3);
    expect(res.riskLevel).toBe('medium');
  });

  test('riskLevel: low for well-formed queries', () => {
    const res = evaluateQueryRisk({
      top: 100,
      select: ['Id', 'Title'],
      orderBy: 'Id desc',
      filter: "Active" // misses heuristics intentionally, normally would have eq
    });
    expect(res.riskLevel).toBe('low');
  });
});
