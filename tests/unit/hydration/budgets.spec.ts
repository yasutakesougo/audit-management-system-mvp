import { describe, expect, it } from 'vitest';

import { HYDRATION_KEYS } from '@/hydration/routes';

/**
 * Hydration Route Budgets 仕様テスト
 *
 * 目的: ルートハイドレーション予算の設定規則と制約を検証
 *
 * 検証項目:
 * 1. 全ルートエントリの基本構造（id/label/budget）
 * 2. 予算ガードレール（上限・下限）の遵守
 * 3. 重要ルートの存在保証
 * 4. ID重複防止（ルート識別子の一意性）
 *
 * 保守方針:
 * - 定数化によりガードレール値の管理を一元化
 * - 明示的存在チェックで将来のルート追加・削除を適切に検知
 * - ユニークネス検証でコピペミスや設定重複を防止
 */

// パフォーマンス予算の制約値（仕様として固定）
const MAX_BUDGET = 400; // ms
const MIN_BUDGET = 30;  // ms (非現実的な小値を防止)

// 必須ルート（業務要件として存在が保証されるべき）
const REQUIRED_ROUTES = [
  'route:schedules:day',
  'route:schedules:week',
  'route:schedules:month',
] as const;

describe('hydration route budgets', () => {
  const entries = Object.values(HYDRATION_KEYS);

  describe('基本構造', () => {
    it('各ルートエントリが必須プロパティ（id, label, budget）を持つこと', () => {
      for (const entry of entries) {
        expect(entry.id.startsWith('route:'), `ルート '${entry.id}' のIDがroute:プレフィックスで開始しない`).toBe(true);
        expect(entry.label.length, `ルート '${entry.id}' のlabelが空`).toBeGreaterThan(0);
        expect(typeof entry.budget, `ルート '${entry.id}' のbudgetが数値でない`).toBe('number');
        expect(entry.budget, `ルート '${entry.id}' のbudgetが無効値`).toBeGreaterThan(0);
      }
    });

    it('すべてのルートIDが一意であること（重複設定防止）', () => {
      const ids = entries.map(entry => entry.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size, `重複ルートID検出: ${ids.length}個中${uniqueIds.size}個がユニーク`).toBe(ids.length);

      // 重複がある場合の詳細情報
      if (uniqueIds.size !== ids.length) {
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        expect.fail(`重複ID: ${[...new Set(duplicates)].join(', ')}`);
      }
    });
  });

  describe('パフォーマンス予算制約', () => {
    it(`すべてのルートの予算が上限（${MAX_BUDGET}ms）を超えないこと`, () => {
      for (const entry of entries) {
        expect(entry.budget, `ルート '${entry.id}' の予算${entry.budget}msが上限${MAX_BUDGET}msを超過`).toBeLessThanOrEqual(MAX_BUDGET);
      }
    });

    it(`すべてのルートの予算が下限（${MIN_BUDGET}ms）未満でないこと（非現実的な値の防止）`, () => {
      for (const entry of entries) {
        expect(entry.budget, `ルート '${entry.id}' の予算${entry.budget}msが下限${MIN_BUDGET}msを下回る（非現実的）`).toBeGreaterThanOrEqual(MIN_BUDGET);
      }
    });

    it('予算値が整数であること（ミリ秒として適切）', () => {
      for (const entry of entries) {
        expect(Number.isInteger(entry.budget), `ルート '${entry.id}' の予算${entry.budget}が整数でない`).toBe(true);
      }
    });
  });

  describe('必須ルート存在保証', () => {
    it('業務要件として必要な全スケジュールルートが存在すること', () => {
      REQUIRED_ROUTES.forEach((requiredId) => {
        const exists = entries.some(entry => entry.id === requiredId);
        expect(exists, `必須ルート '${requiredId}' が設定に存在しない`).toBe(true);
      });
    });

    it('必須ルートがすべて適切な予算を持つこと', () => {
      REQUIRED_ROUTES.forEach((requiredId) => {
        const routeEntry = entries.find(entry => entry.id === requiredId);
        expect(routeEntry, `必須ルート '${requiredId}' の設定エントリが見つからない`).toBeDefined();

        if (routeEntry) {
          expect(routeEntry.budget, `必須ルート '${requiredId}' の予算が無効`).toBeGreaterThan(0);
          expect(routeEntry.budget, `必須ルート '${requiredId}' の予算が上限超過`).toBeLessThanOrEqual(MAX_BUDGET);
        }
      });
    });
  });
});
