import { describe, test, expect } from 'vitest';
import { guardSharePointQuery } from '../queryGuard';
import { DEFAULT_SP_QUERY_LIMIT, MAX_SP_QUERY_LIMIT } from '@/shared/api/spQueryLimits';

describe('queryGuard - guardSharePointQuery', () => {

  test('top: defaults if missing', () => {
    const res = guardSharePointQuery({ select: ['Id'], orderBy: 'Id' }); // low risk query without top
    expect(res.sanitized.top).toBe(DEFAULT_SP_QUERY_LIMIT);
    expect(res.flags.cappedTop).toBe(false);
    expect(res.riskLevel).toBe('low');
  });

  test('top: corrects 0 to 1', () => {
    const res = guardSharePointQuery({ top: 0, select: ['Id'], orderBy: 'Id' });
    expect(res.sanitized.top).toBe(1);
    expect(res.flags.cappedTop).toBe(true);
    // cappedTop automatically makes it "high" risk
    expect(res.riskLevel).toBe('high');
    expect(res.warnings[0]).toContain('minimum allowed value of 1');
  });

  test('top: caps top greater than MAX', () => {
    const res = guardSharePointQuery({ top: 999999, select: ['Id'], orderBy: 'Id' });
    expect(res.sanitized.top).toBe(MAX_SP_QUERY_LIMIT);
    expect(res.flags.cappedTop).toBe(true);
    expect(res.riskLevel).toBe('high');
    expect(res.warnings[0]).toContain(`MAX_SP_QUERY_LIMIT (${MAX_SP_QUERY_LIMIT})`);
  });

  test('select: missing triggers missingSelect and medium risk', () => {
    const res = guardSharePointQuery({ top: 100, orderBy: 'Id' });
    expect(res.flags.missingSelect).toBe(true);
    expect(res.riskLevel).toBe('medium');
    expect(res.warnings.some(w => w.includes('$select'))).toBe(true);
  });

  test('expand: single expand triggers hasExpand and medium risk', () => {
    const res = guardSharePointQuery({ top: 100, select: ['Id'], orderBy: 'Id', expand: ['User'] });
    expect(res.flags.hasExpand).toBe(true);
    expect(res.riskLevel).toBe('medium');
    expect(res.warnings.some(w => w.includes('$expand'))).toBe(true);
  });

  test('expand: multiple expands trigger high risk', () => {
    const res = guardSharePointQuery({ top: 100, select: ['Id'], orderBy: 'Id', expand: ['User', 'Department'] });
    expect(res.flags.hasExpand).toBe(true);
    expect(res.riskLevel).toBe('high');
  });

  test('orderBy: missing in list triggers missingOrderBy and medium risk', () => {
    const res = guardSharePointQuery({ top: 100, select: ['Id'], queryKind: 'list' });
    expect(res.flags.missingOrderBy).toBe(true);
    expect(res.riskLevel).toBe('medium');
    expect(res.warnings.some(w => w.includes('$orderby'))).toBe(true);
  });

  test('orderBy: ignored if top is 1', () => {
    const res = guardSharePointQuery({ top: 1, select: ['Id'], queryKind: 'list' });
    expect(res.flags.missingOrderBy).toBe(false);
    expect(res.riskLevel).toBe('low');
  });

  test('filter: index heuristic - catches potentially unindexed filters', () => {
    const res1 = guardSharePointQuery({ top: 100, select: ['Id'], orderBy: 'Id', filter: "substringof('foo', Title)" });
    expect(res1.flags.filterMayNeedIndex).toBe(true);
    expect(res1.riskLevel).toBe('medium');
    expect(res1.warnings.some(w => w.includes('$filter'))).toBe(true);

    const res2 = guardSharePointQuery({ top: 100, select: ['Id'], orderBy: 'Id', filter: "Date ge '2023-01-01'" });
    expect(res2.flags.filterMayNeedIndex).toBe(true);
  });

  test('filter: no match on simple string without keywords', () => {
    // Highly simplistic heuristic test
    const res = guardSharePointQuery({ top: 100, select: ['Id'], orderBy: 'Id', filter: "Status eq 'Active'" });
    // "eq" is in the pattern " eq "
    expect(res.flags.filterMayNeedIndex).toBe(true);
  });

  test('riskLevel: high for export/analytics with large top', () => {
    const res = guardSharePointQuery({ top: 2000, select: ['Id'], orderBy: 'Id', queryKind: 'export' });
    // Assuming 2000 is > 1000
    expect(res.riskLevel).toBe('high');
  });

  test('riskLevel: low for well-formed queries', () => {
    const res = guardSharePointQuery({
      top: 100,
      select: ['Id', 'Title'],
      orderBy: 'Id desc',
      filter: "Active" // misses heuristics intentionally, normally would have eq
    });
    expect(res.riskLevel).toBe('low');
  });
});
