import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const HANDOFF_STORAGE_KEY = 'handoff.timeline.dev.v1';
const COLLAPSED_PARENTS_STORAGE_KEY = 'exception-collapsed-parents';

test.describe('ExceptionCenter handoff child flow', () => {
  test('flat/grouped rendering and child deep-link navigation remain consistent', async ({ page }) => {
    await page.addInitScript(({ handoffStorageKey, collapsedParentsKey }) => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        // ユーザー名マッピングを安定化（demo users を利用）
        VITE_FEATURE_USERS_SP: '0',
      };

      const now = new Date();
      const y = now.getFullYear();
      const m = `${now.getMonth() + 1}`.padStart(2, '0');
      const d = `${now.getDate()}`.padStart(2, '0');
      const today = `${y}-${m}-${d}`;

      const seeded = {
        [today]: [
          {
            id: 701,
            title: '服薬確認',
            message: 'E2E handoff target: 子行から遷移する',
            userCode: 'U-001',
            userDisplayName: '田中 太郎',
            category: '体調',
            severity: '重要',
            status: '未対応',
            timeBand: '朝',
            createdByName: 'E2E Tester',
            createdAt: `${today}T08:10:00.000Z`,
            isDraft: false,
          },
          {
            id: 702,
            title: '家族連絡',
            message: 'E2E handoff sibling: こちらが新しい時刻',
            userCode: 'U-001',
            userDisplayName: '田中 太郎',
            category: '家族連絡',
            severity: '重要',
            status: '対応中',
            timeBand: '午前',
            createdByName: 'E2E Tester',
            createdAt: `${today}T10:20:00.000Z`,
            isDraft: false,
          },
          {
            id: 703,
            title: '完了済み項目',
            message: '完了済みは ExceptionCenter に出ない',
            userCode: 'U-001',
            userDisplayName: '田中 太郎',
            category: 'その他',
            severity: '重要',
            status: '完了',
            timeBand: '午後',
            createdByName: 'E2E Tester',
            createdAt: `${today}T11:00:00.000Z`,
            isDraft: false,
          },
          {
            id: 704,
            title: '通常重要度外',
            message: '通常は対象外',
            userCode: 'U-002',
            userDisplayName: '佐藤 花子',
            category: '体調',
            severity: '通常',
            status: '未対応',
            timeBand: '朝',
            createdByName: 'E2E Tester',
            createdAt: `${today}T09:00:00.000Z`,
            isDraft: false,
          },
        ],
      };

      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.removeItem(collapsedParentsKey);
      window.localStorage.setItem(handoffStorageKey, JSON.stringify(seeded));
    }, {
      handoffStorageKey: HANDOFF_STORAGE_KEY,
      collapsedParentsKey: COLLAPSED_PARENTS_STORAGE_KEY,
    });

    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/admin/exception-center',
    });

    await expect(page.getByTestId('exception-table')).toBeVisible();

    await page.getByTestId('exception-filter-category').click();
    await page.getByRole('option', { name: /重要申し送り/ }).click();

    // 1) flat: parent 配下に child が表示される
    await expect(page.getByTestId('exception-row-handoff-user-U-001')).toBeVisible();
    await expect(page.getByTestId('exception-row-handoff-701')).toBeVisible();
    await expect(page.getByTestId('exception-row-handoff-702')).toBeVisible();
    await expect(page.getByTestId('exception-row-handoff-701')).toContainText('└ 個別');

    // 2) grouped: parent 行の二重集約を防ぐ
    await page.getByTestId('exception-mode-grouped').click();
    await expect(page.getByTestId('exception-row-handoff-user-U-001')).toHaveCount(0);
    await expect(page.getByText(/の例外 \(2件\)/)).toHaveCount(1);

    await page.getByTestId('exception-mode-flat').click();

    // 3) child CTA で handoff deep link に遷移する
    await page.getByTestId('corrective-primary-handoff-701').click();
    await expect(page).toHaveURL(/\/handoff-timeline\?range=day&date=\d{4}-\d{2}-\d{2}&handoffId=701/);
    await expect(page.getByText('申し送りタイムライン')).toBeVisible();

    // URL handoffId により対象カードが先頭表示される（highlight order）
    const firstItem = page.locator('[data-testid="agenda-timeline-item"]').first();
    await expect(firstItem).toContainText('E2E handoff target');

    const landed = new URL(page.url());
    expect(landed.pathname).toBe('/handoff-timeline');
    expect(landed.searchParams.get('range')).toBe('day');
    expect(landed.searchParams.get('handoffId')).toBe('701');
    expect(landed.searchParams.get('date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
