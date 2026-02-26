import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    ABSENCE_MONTHLY_LIMIT,
    DISCREPANCY_THRESHOLD,
    FACILITY_CLOSE_TIME,
    getServiceRecordsConfig,
    getServiceThresholds,
    resetServiceRecords,
} from '@/config/serviceRecords';
import { parseEnv, resetParsedEnvForTests } from '@/lib/env.schema';

/**
 * Service Records 設定の包括的なテスト
 *
 * テスト範囲:
 * 1. 不変デフォルト定数の検証
 * 2. 環境変数 → config 解決プロセス
 * 3. threshold 計算とオーバーライド対応
 * 4. キャッシュ管理と状態隔離
 * 5. エラーハンドリング・バリデーション
 *
 * リセット戦略:
 * - resetParsedEnvForTests: env.schema キャッシュリセット
 * - resetServiceRecords: serviceRecords モジュールキャッシュリセット
 * - clearTestEnv: テスト用グローバル変数クリア
 * - beforeEach + afterEach 双方向で実行してテスト隔離を確保
 */

type TestEnv = Record<string, unknown>;

type GlobalWithEnv = typeof globalThis & { __TEST_ENV__?: TestEnv };

const setTestEnv = (values: TestEnv) => {
  (globalThis as GlobalWithEnv).__TEST_ENV__ = values;
};

const clearTestEnv = () => {
  delete (globalThis as GlobalWithEnv).__TEST_ENV__;
};

describe('config/serviceRecords', () => {
  beforeEach(() => {
    resetParsedEnvForTests();
    resetServiceRecords();
    clearTestEnv();
  });

  afterEach(() => {
    resetParsedEnvForTests();
    resetServiceRecords();
    clearTestEnv();
  });

  it('exposes immutable defaults via constants', () => {
    expect(DISCREPANCY_THRESHOLD).toBe(0.75);
    expect(ABSENCE_MONTHLY_LIMIT).toBe(2);
    expect(FACILITY_CLOSE_TIME).toBe('18:00');
  });

  it('derives configured values from env schema', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '1.1',
      VITE_ABSENCE_MONTHLY_LIMIT: '5',
      VITE_FACILITY_CLOSE_TIME: '6:45',
    });

    const config = getServiceRecordsConfig();

    expect(config.discrepancyThreshold).toBe(1.1);
    expect(config.absenceMonthlyLimit).toBe(5);
    expect(config.facilityCloseTime).toBe('6:45');

    const thresholds = getServiceThresholds();
    expect(thresholds).toEqual({
      discrepancyMinutes: 66,
      absenceMonthlyLimit: 5,
      facilityCloseTime: '6:45',
      facilityCloseMinutes: 405, // 6:45 = 6*60 + 45 = 405分
    });
  });

  it('supports per-call overrides without disturbing cached config', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.8',
      VITE_ABSENCE_MONTHLY_LIMIT: '3',
      VITE_FACILITY_CLOSE_TIME: '20:15',
    });

    const baseline = getServiceRecordsConfig();
    const override = getServiceRecordsConfig({ VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 1.9 });

    expect(baseline.discrepancyThreshold).toBe(0.8);
    expect(override.discrepancyThreshold).toBe(1.9);
    expect(getServiceRecordsConfig()).toEqual(baseline);
  });

  it('supports overrides for thresholds with proper calculations', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.5', // baseline: 30 minutes
      VITE_FACILITY_CLOSE_TIME: '17:30', // baseline: 1050 minutes from 0:00
    });

    const baseline = getServiceThresholds();
    const override = getServiceThresholds({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 2, // 120 minutes
      VITE_FACILITY_CLOSE_TIME: '19:45', // 1185 minutes from 0:00
    });

    expect(baseline.discrepancyMinutes).toBe(30);
    expect(baseline.facilityCloseMinutes).toBe(1050);

    expect(override.discrepancyMinutes).toBe(120);
    expect(override.facilityCloseMinutes).toBe(1185);

    // キャッシュが汚染されていないことを確認
    expect(getServiceThresholds()).toEqual(baseline);
  });

  it('validates env values and throws descriptive errors for invalid formats', () => {
    setTestEnv({
      VITE_FACILITY_CLOSE_TIME: 'invalid-time',
    });

    // parseEnv は Zod バリデーションで不正値を検出し例外を投げる
    expect(() => parseEnv({ VITE_FACILITY_CLOSE_TIME: 'invalid-time' })).toThrow();
  });

  it('handles edge cases in time calculations', () => {
    setTestEnv({
      VITE_FACILITY_CLOSE_TIME: '0:00', // 深夜0時
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.25', // 15分
    });

    const thresholds = getServiceThresholds();

    expect(thresholds.facilityCloseMinutes).toBe(0);
    expect(thresholds.discrepancyMinutes).toBe(15);
    expect(thresholds.facilityCloseTime).toBe('0:00');
  });
});
