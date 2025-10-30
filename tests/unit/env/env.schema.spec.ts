import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { getParsedEnv, parseEnv, resetParsedEnvForTests } from '@/lib/env.schema';

type TestEnv = Record<string, unknown>;

type GlobalWithEnv = typeof globalThis & { __TEST_ENV__?: TestEnv };

describe('env.schema', () => {
  const setTestEnv = (values: TestEnv) => {
    (globalThis as GlobalWithEnv).__TEST_ENV__ = values;
  };

  const clearTestEnv = () => {
    delete (globalThis as GlobalWithEnv).__TEST_ENV__;
  };

  beforeEach(() => {
    resetParsedEnvForTests();
    clearTestEnv();
  });

  afterEach(() => {
    resetParsedEnvForTests();
    clearTestEnv();
  });

  it('parses defaults when no values provided', () => {
    const parsed = getParsedEnv();

    expect(parsed).toEqual({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 0.75,
      VITE_ABSENCE_MONTHLY_LIMIT: 2,
      VITE_FACILITY_CLOSE_TIME: '18:00',
    });
  });

  it('coerces strings to numbers and caches the result', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '1.25',
      VITE_ABSENCE_MONTHLY_LIMIT: '4',
      VITE_FACILITY_CLOSE_TIME: '6:30',
    });

    const parsed = getParsedEnv();
    const sameReference = getParsedEnv();

    expect(parsed).toEqual({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 1.25,
      VITE_ABSENCE_MONTHLY_LIMIT: 4,
      VITE_FACILITY_CLOSE_TIME: '6:30',
    });

    expect(sameReference).toBe(parsed);
  });

  it('allows runtime overrides without mutating the cache', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.5',
      VITE_ABSENCE_MONTHLY_LIMIT: '3',
      VITE_FACILITY_CLOSE_TIME: '7:45',
    });

    const baseline = getParsedEnv();
    const withOverride = getParsedEnv({ VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 1.5 });

    expect(baseline.VITE_ATTENDANCE_DISCREPANCY_THRESHOLD).toBe(0.5);
    expect(withOverride.VITE_ATTENDANCE_DISCREPANCY_THRESHOLD).toBe(1.5);
    expect(getParsedEnv()).toBe(baseline);
  });

  it('rejects invalid values', () => {
    expect(() =>
      parseEnv({
        VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: -1,
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "origin": "number",
          "code": "too_small",
          "minimum": 0,
          "inclusive": true,
          "path": [
            "VITE_ATTENDANCE_DISCREPANCY_THRESHOLD"
          ],
          "message": "Discrepancy threshold must be positive"
        }
      ]]
    `);

    expect(() =>
      parseEnv({
        VITE_ABSENCE_MONTHLY_LIMIT: 3.5,
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "int",
          "format": "safeint",
          "code": "invalid_type",
          "path": [
            "VITE_ABSENCE_MONTHLY_LIMIT"
          ],
          "message": "Absence monthly limit must be an integer"
        }
      ]]
    `);

    expect(() =>
      parseEnv({
        VITE_FACILITY_CLOSE_TIME: '25:00',
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "origin": "string",
          "code": "invalid_format",
          "format": "regex",
          "pattern": "/^([01]?\\\\d|2[0-3]):[0-5]\\\\d$/",
          "path": [
            "VITE_FACILITY_CLOSE_TIME"
          ],
          "message": "Facility close time must be HH:MM (24h)"
        }
      ]]
    `);
  });
});
