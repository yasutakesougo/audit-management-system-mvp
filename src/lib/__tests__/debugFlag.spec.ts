import { describe, expect, it } from 'vitest';
import { isDebugFlag } from '../debugFlag';

describe('isDebugFlag', () => {
  it.each(['1', 'true', 'yes', 'on'])('returns true for canonical truthy string %s', (value) => {
    expect(isDebugFlag(value)).toBe(true);
  });

  it.each(['TRUE', 'True', 'YES', 'On', 'ON'])('is case-insensitive (%s)', (value) => {
    expect(isDebugFlag(value)).toBe(true);
  });

  it.each(['  true  ', '\t1\n', ' yes', 'on '])('trims surrounding whitespace (%s)', (value) => {
    expect(isDebugFlag(value)).toBe(true);
  });

  it.each(['0', 'false', 'no', 'off', 'enabled', '2', 'banana', ''])(
    'returns false for non-truthy strings (%s)',
    (value) => {
      expect(isDebugFlag(value)).toBe(false);
    },
  );

  it('returns false for whitespace-only strings', () => {
    expect(isDebugFlag('   ')).toBe(false);
  });

  it('returns false for undefined and null', () => {
    expect(isDebugFlag(undefined)).toBe(false);
    expect(isDebugFlag(null)).toBe(false);
  });

  it('preserves boolean primitives', () => {
    expect(isDebugFlag(true)).toBe(true);
    expect(isDebugFlag(false)).toBe(false);
  });

  it('treats numeric 1 as true and other numbers as false', () => {
    expect(isDebugFlag(1)).toBe(true);
    expect(isDebugFlag(0)).toBe(false);
    expect(isDebugFlag(2)).toBe(false);
    expect(isDebugFlag(Number.NaN)).toBe(false);
  });

  it('returns false for objects and arrays', () => {
    expect(isDebugFlag({})).toBe(false);
    expect(isDebugFlag([])).toBe(false);
    expect(isDebugFlag({ value: '1' })).toBe(false);
  });
});
