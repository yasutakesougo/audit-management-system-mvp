import { describe, expect, it } from 'vitest';
import { resolveBehaviorScore } from '../behaviorScoreResolution';

describe('resolveBehaviorScore', () => {
  it.each([0, 9, 10, 12])('accepts valid score %s', value => {
    expect(resolveBehaviorScore(value)).toEqual({ status: 'valid', value });
  });

  it.each([
    [null, 'missing'],
    [undefined, 'missing'],
    [NaN, 'not-finite'],
    [Infinity, 'not-finite'],
    [-Infinity, 'not-finite'],
    [-1, 'negative'],
    ['12', 'invalid-type'],
  ] as const)('returns indeterminate for %s', (value, reason) => {
    expect(resolveBehaviorScore(value)).toEqual({ status: 'indeterminate', reason });
  });
});
