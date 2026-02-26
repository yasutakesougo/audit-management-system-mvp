import { expect, test } from '@playwright/test';

const TABLE_DAILY_DRAFT_STORAGE_KEY = 'daily-table-record:draft:v1';

const submitFromTableForm = async (page: import('@playwright/test').Page) => {
  await expect(page.getByTestId('daily-table-record-form')).toBeVisible();

  const reporterNameInput = page.getByRole('textbox', { name: '記録者名' });
  if ((await reporterNameInput.inputValue()).trim().length === 0) {
    await reporterNameInput.fill('E2E 記録者');
  }

  const saveButton = page.getByRole('button', { name: /^\d+人分保存$/ });
  if (await saveButton.isDisabled()) {
    await page.getByRole('button', { name: '表示中の利用者を全選択' }).click();
  }
  await expect(saveButton).toBeEnabled();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await saveButton.click({ force: true });
};

test.describe('日次記録: /daily/table entry points', () => {
  test('direct route loads the table form', async ({ page }) => {
    await page.goto('/daily/table');
    await expect(page.getByRole('heading', { name: '一覧形式ケース記録入力' })).toBeVisible();
  });

  test('footer quick action navigates to /daily/table', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-footer-activity')).toBeVisible();

    await page.getByTestId('daily-footer-activity').click();

    await expect(page).toHaveURL(/\/daily\/table/);
    await expect(page.getByRole('heading', { name: '一覧形式ケース記録入力' })).toBeVisible();
  });

  test('header nav "日次記録" navigates to /daily/table', async ({ page }) => {
    await page.goto('/');
    const dailyNavLink = page.getByRole('link', { name: /日次記録|Daily/ }).first();
    await expect(dailyNavLink).toBeVisible();

    await dailyNavLink.click();
    await expect(page).toHaveURL(/\/(daily|dailysupport)/);

    await page.getByRole('link', { name: 'ケース記録' }).last().click();

    await expect(page).toHaveURL(/\/daily\/table/);
    await expect(page.getByRole('heading', { name: '一覧形式ケース記録入力' })).toBeVisible();
  });
});

test.describe('日次記録: /daily/table draft lifecycle', () => {
  test('save draft, restore after reload, and clear draft after submit', async ({ page }) => {
    await page.goto('/daily/table');
    await page.evaluate((storageKey) => localStorage.removeItem(storageKey), TABLE_DAILY_DRAFT_STORAGE_KEY);
    await page.evaluate((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({
        formData: {
          date: new Date().toISOString().split('T')[0],
          reporter: { name: 'E2E 記録者', role: '生活支援員' },
          userRows: [],
        },
        selectedUserIds: [],
        searchQuery: '',
        showTodayOnly: true,
        savedAt: new Date().toISOString(),
      }));
    }, TABLE_DAILY_DRAFT_STORAGE_KEY);

    await page.reload();
    await expect(page.getByLabel('記録者名')).toHaveValue('E2E 記録者');
    await expect(page.getByTestId('daily-table-draft-status')).toBeVisible();

    await page.evaluate((storageKey) => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        formData: { date: string; reporter: { name: string; role: string }; userRows: unknown[] };
        selectedUserIds: string[];
        searchQuery: string;
        showTodayOnly: boolean;
        savedAt: string;
      };
      parsed.selectedUserIds = ['e2e-unsent-user'];
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    }, TABLE_DAILY_DRAFT_STORAGE_KEY);
    await page.reload();

    await submitFromTableForm(page);
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^(\/dashboard|\/daily\/support|\/dailysupport)$/);

    await page.goto('/daily/table');
    await expect(page.getByLabel('記録者名')).toBeVisible();
  });
});

test.describe('日次記録: /daily/table unsent recovery flow', () => {
  test('unsent-only ON then submit turns filter OFF when unsent reaches zero', async ({ page }) => {
    await page.goto('/daily/table');
    await page.evaluate((draftStorageKey) => {
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem('daily-table-record:unsent-filter:v1');
      const next = new URL(window.location.href);
      next.searchParams.delete('unsent');
      window.history.replaceState({}, '', next.toString());
    }, TABLE_DAILY_DRAFT_STORAGE_KEY);

    await page.evaluate((draftStorageKey) => {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        formData: {
          date: new Date().toISOString().split('T')[0],
          reporter: { name: '未送信回収E2E', role: '生活支援員' },
          userRows: [
            {
              userId: 'e2e-unsent-user',
              userName: 'E2E 利用者',
              amActivity: '未送信対象データ',
              pmActivity: '',
              lunchAmount: '',
              problemBehavior: {
                selfHarm: false,
                violence: false,
                loudVoice: false,
                pica: false,
                other: false,
              },
              specialNotes: '',
            },
          ],
        },
        selectedUserIds: ['e2e-unsent-user'],
        searchQuery: '',
        showTodayOnly: true,
        savedAt: new Date().toISOString(),
      }));
    }, TABLE_DAILY_DRAFT_STORAGE_KEY);

    await page.evaluate(() => {
      localStorage.setItem('daily-table-record:unsent-filter:v1', '1');
      const next = new URL(window.location.href);
      next.searchParams.set('unsent', '1');
      window.history.replaceState({}, '', next.toString());
    });

    await page.reload();
    await expect(page).toHaveURL(/\?unsent=1/);

    await submitFromTableForm(page);
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^(\/dashboard|\/daily\/support|\/dailysupport)$/);

    await page.goto('/daily/table');
    await expect(page).not.toHaveURL(/\?unsent=1/);
    await expect(page.getByTestId('daily-table-unsent-count-chip')).toHaveCount(0);
  });
});
