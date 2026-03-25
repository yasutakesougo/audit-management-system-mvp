import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const E2E_SUGGESTIONS_STORAGE_KEY = 'e2e:corrective-suggestions.v1';
const SUGGESTION_STATE_STORAGE_KEY = 'action-engine.suggestion-states.v1';
const COLLAPSED_PARENTS_STORAGE_KEY = 'exception-collapsed-parents';

test.describe('ExceptionCenter corrective child flow', () => {
  test('child row CTA, child actions, and grouped/flat aggregation stay consistent', async ({ page }) => {
    const now = new Date().toISOString();

    await page.addInitScript(
      ({ suggestionsKey, suggestionStateKey, collapsedParentsKey, seededSuggestions }) => {
        window.localStorage.setItem('skipLogin', '1');
        window.localStorage.removeItem(suggestionStateKey);
        window.localStorage.removeItem(collapsedParentsKey);
        window.localStorage.setItem(suggestionsKey, JSON.stringify(seededSuggestions));
      },
      {
        suggestionsKey: E2E_SUGGESTIONS_STORAGE_KEY,
        suggestionStateKey: SUGGESTION_STATE_STORAGE_KEY,
        collapsedParentsKey: COLLAPSED_PARENTS_STORAGE_KEY,
        seededSuggestions: [
          {
            id: 'seed-1',
            stableId: 'ca-s1',
            type: 'assessment_update',
            priority: 'P1',
            targetUserId: 'U-001',
            title: '行動発生の増加傾向があります',
            reason: '直近7日で増加しています',
            evidence: {
              metric: '行動発生件数（日平均）',
              currentValue: '5.0',
              threshold: '前週比 +30%',
              period: '直近7日 vs 前7日',
            },
            cta: {
              label: 'アセスメントを見直す',
              route: '/assessment?userId=U-001',
            },
            createdAt: now,
            ruleId: 'behavior-trend-increase',
          },
          {
            id: 'seed-2',
            stableId: 'ca-s2',
            type: 'plan_update',
            priority: 'P2',
            targetUserId: 'U-001',
            title: '支援計画の更新候補があります',
            reason: '評価の更新タイミングです',
            evidence: {
              metric: '計画更新日数',
              currentValue: '28日',
              threshold: '21日超',
              period: '直近30日',
            },
            cta: {
              label: '支援計画を確認',
              route: '/assessment?userId=U-001&tab=plan',
            },
            createdAt: now,
            ruleId: 'plan-refresh-needed',
          },
          {
            id: 'seed-3',
            stableId: 'ca-s3',
            type: 'data_collection',
            priority: 'P1',
            targetUserId: 'U-005',
            title: '観察データ収集を強化してください',
            reason: 'データ件数が不足しています',
            evidence: {
              metric: '観察件数',
              currentValue: '3件',
              threshold: '7件以上',
              period: '直近7日',
            },
            cta: {
              label: '観察入力を開く',
              route: '/assessment?userId=U-005',
            },
            createdAt: now,
            ruleId: 'data-collection-low',
          },
        ],
      },
    );

    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/admin/exception-center',
    });

    await expect(page.getByTestId('exception-table')).toBeVisible();

    // 1) flat で parent 下に child が表示される
    await expect(page.getByTestId('exception-row-corrective-user-U-001')).toBeVisible();
    await expect(page.getByTestId('exception-row-ae:ca-s1')).toBeVisible();
    await expect(page.getByTestId('exception-row-ae:ca-s2')).toBeVisible();
    await expect(page.getByTestId('exception-row-ae:ca-s1')).toContainText('└ 個別');

    // priority モードで Top3 サマリーが表示される
    await page.getByTestId('exception-sort-mode').click();
    await page.getByRole('option', { name: '優先度順' }).click();
    await expect(page.getByTestId('exception-priority-top3')).toBeVisible();
    await expect(page.getByTestId('exception-priority-top3-item-1')).toBeVisible();

    // grouped 検証前にカテゴリを corrective-action に絞る（他カテゴリ混在を除外）
    await page.getByTestId('exception-filter-category').click();
    await page.getByRole('option', { name: /改善提案/ }).click();

    // 4) grouped/flat で二重集約されない（U-001 は child 2件）
    await page.getByTestId('exception-mode-grouped').click();
    await expect(page.getByTestId('exception-row-ae:ca-s1').getByText('田中 太郎 の例外 (2件)')).toBeVisible();
    await expect(page.getByTestId('exception-row-ae:ca-s3').getByText('佐藤 花子 の例外 (1件)')).toBeVisible();
    await expect(page.getByText('田中 太郎 の改善提案')).toHaveCount(0);
    await page.getByTestId('exception-mode-flat').click();

    // 2) child CTA で actionPath に遷移できる
    await page.getByTestId('corrective-primary-ae:ca-s1').click();
    await expect(page).toHaveURL(/\/assessment\?userId=U-001/);

    await page.goto('/admin/exception-center', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('exception-table')).toBeVisible();

    // 3) child でも snooze / dismiss が機能する
    await page.getByTestId('suggestion-menu-button-ae:ca-s1').click();
    await page.getByRole('menuitem', { name: '明日まで' }).click();
    await expect(page.getByTestId('exception-row-ae:ca-s1')).toHaveCount(0);

    await page.getByTestId('suggestion-menu-button-ae:ca-s2').click();
    await page.getByRole('menuitem', { name: '対応済みにする' }).click();
    await expect(page.getByTestId('exception-row-ae:ca-s2')).toHaveCount(0);
  });
});
