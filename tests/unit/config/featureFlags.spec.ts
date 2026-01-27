import {
    __resetFeatureFlagsForTest,
    featureFlags,
    FeatureFlagsProvider,
    getFeatureFlags,
    resolveFeatureFlags,
    useFeatureFlags,
    type FeatureFlagSnapshot
} from '@/config/featureFlags';
import { cleanup, render } from '@testing-library/react';
import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Feature Flags 設定の包括的なテスト
 *
 * テスト範囲:
 * 1. env helpers → snapshot の解決プロセス
 * 2. 環境変数オーバーライドの正しい伝播
 * 3. モジュールレベルのスナップショット export
 * 4. Provider + hook 経由でのランタイム更新
 * 5. グローバルキャッシュの更新とリセット
 *
 * 注意事項:
 * - グローバル currentSnapshot が各テストで変更される可能性があるため
 *   afterEach で __resetFeatureFlagsForTest() を呼び出してテスト隔離を確保
 * - 呼び出し回数のアサーションは将来のリファクタ余地を考慮して緩めに設定
 */

describe('featureFlags config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    __resetFeatureFlagsForTest(); // グローバルキャッシュをリセットしてテスト間の影響を排除
  });

  it('resolves feature flag snapshot using env helpers', () => {
    // env override を使って、実環境に依存せず固定値でテスト
    const override = {
      VITE_FEATURE_SCHEDULES: '1',
      VITE_FEATURE_SCHEDULES_CREATE: '0',
      VITE_FEATURE_COMPLIANCE_FORM: '1',
      VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
      VITE_FEATURE_ICEBERG_PDCA: '1',
    };

    const snapshot = resolveFeatureFlags(override);

    expect(snapshot).toEqual({
      schedules: true,
      schedulesCreate: false,
      complianceForm: true,
      schedulesWeekV2: true,
      icebergPdca: true,
    });

    // env override を使った場合、helper 関数にも override が渡される
    // (スパイは不要 - 実関数の動作をテストする)
  });

  it('passes env override through to helper functions', () => {
    const override = { 
      VITE_FEATURE_SCHEDULES: '1',
      VITE_FEATURE_SCHEDULES_CREATE: '1',
      VITE_FEATURE_COMPLIANCE_FORM: '0',
      VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
      VITE_FEATURE_ICEBERG_PDCA: '0',
    };

    const snapshot = resolveFeatureFlags(override);

    expect(snapshot).toEqual({
      schedules: true,
      schedulesCreate: true,
      complianceForm: false,
      schedulesWeekV2: true,
      icebergPdca: false,
    });
  });

  it('exports a default snapshot computed at module load', () => {
    const fresh = resolveFeatureFlags();
    expect(featureFlags).toEqual(fresh);
  });

  it('returns current snapshot from getFeatureFlags', () => {
    expect(getFeatureFlags()).toEqual(featureFlags);

    // automation環境では明示なし→デフォルトでtrue
    const override = {
      VITE_FEATURE_SCHEDULES_CREATE: '1',
      VITE_FEATURE_COMPLIANCE_FORM: '0',
      VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
    };

    expect(getFeatureFlags(override)).toEqual({
      schedules: true,
      schedulesCreate: true,
      complianceForm: false,
      schedulesWeekV2: true,
      icebergPdca: false,
    });
  });

  it('respects explicit false in automation (flag-off E2E)', () => {
    // automation環境でも明示的な '0' は尊重してfalseにする
    const override = {
      VITE_FEATURE_SCHEDULES: '0',
      VITE_FEATURE_SCHEDULES_CREATE: '0',
      VITE_FEATURE_COMPLIANCE_FORM: '0',
      VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
    };

    expect(getFeatureFlags(override)).toEqual({
      schedules: false,
      schedulesCreate: false,
      complianceForm: false,
      schedulesWeekV2: true,
      icebergPdca: false,
    });
  });

  it('updates cached snapshot when provider value changes', () => {
    const probe = vi.fn();

    const Probe: React.FC = () => {
      const flags = useFeatureFlags();
      probe(flags);
      return null;
    };

    const nextSnapshot = {
      schedules: true,
      schedulesCreate: false,
      complianceForm: true,
      schedulesWeekV2: false,
      icebergPdca: true,
    } satisfies FeatureFlagSnapshot;

    render(
      createElement(FeatureFlagsProvider, {
        value: nextSnapshot,
        children: createElement(Probe),
      })
    );

    expect(probe).toHaveBeenCalledWith(nextSnapshot);
    expect(getFeatureFlags()).toEqual(nextSnapshot);

    // 注意: このテストでは意図的にグローバルキャッシュを更新しています
    // afterEach で __resetFeatureFlagsForTest() が呼ばれ、他のテストへの影響を排除
  });
});
