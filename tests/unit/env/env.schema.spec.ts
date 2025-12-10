import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getParsedEnv, parseEnv, resetParsedEnvForTests } from '@/lib/env.schema';

/**
 * env.schema 環境変数スキーマの包括的テスト
 *
 * テスト範囲:
 * 1. デフォルト値の解決とshape検証
 * 2. 文字列 → 数値の型強制とキャッシュ機能
 * 3. ランタイムオーバーライドとキャッシュ非汚染
 * 4. Zodバリデーション エラーハンドリング
 *
 * アーキテクチャ:
 * - env.schema: 型・値バリデーション + キャッシュ + オーバーライド機能
 * - serviceRecords: env.schemaを利用した業務ロジック用しきい値計算
 *
 * テスト隔離戦略:
 * - resetParsedEnvForTests(): env.schema内部キャッシュクリア
 * - clearTestEnv(): __TEST_ENV__ グローバル変数クリア
 * - beforeEach + afterEach 両方向リセットで状態汚染完全防止
 */

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

    // 将来のスキーマ拡張を考慮して、コア要件のみ検証
    expect(parsed).toMatchObject({
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

    expect(parsed).toMatchObject({
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

  it('rejects invalid values with descriptive errors', () => {
    // 負の値テスト
    try {
      parseEnv({ VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: -1 });
      throw new Error('Expected parseEnv to throw for negative threshold');
    } catch (err: unknown) {
      const zodError = err as { issues?: Array<{ path: string[]; message: string; code: string }> };
      expect(zodError.issues?.[0]?.path).toEqual(['VITE_ATTENDANCE_DISCREPANCY_THRESHOLD']);
      expect(zodError.issues?.[0]?.message).toBe('Discrepancy threshold must be positive');
      expect(zodError.issues?.[0]?.code).toBe('too_small');
    }

    // 非整数値テスト
    try {
      parseEnv({ VITE_ABSENCE_MONTHLY_LIMIT: 3.5 });
      throw new Error('Expected parseEnv to throw for non-integer limit');
    } catch (err: unknown) {
      const zodError = err as { issues?: Array<{ path: string[]; message: string; code: string }> };
      expect(zodError.issues?.[0]?.path).toEqual(['VITE_ABSENCE_MONTHLY_LIMIT']);
      expect(zodError.issues?.[0]?.message).toBe('Absence monthly limit must be an integer');
      expect(zodError.issues?.[0]?.code).toBe('invalid_type');
    }

    // 時刻形式テスト
    try {
      parseEnv({ VITE_FACILITY_CLOSE_TIME: '25:00' });
      throw new Error('Expected parseEnv to throw for invalid time format');
    } catch (err: unknown) {
      const zodError = err as { issues?: Array<{ path: string[]; message: string; code: string }> };
      expect(zodError.issues?.[0]?.path).toEqual(['VITE_FACILITY_CLOSE_TIME']);
      expect(zodError.issues?.[0]?.message).toBe('Facility close time must be HH:MM (24h)');
      expect(zodError.issues?.[0]?.code).toBe('invalid_format');
    }
  });
});
