import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

type TestRole = 'admin' | 'reception' | 'viewer';

async function bootstrapRole(page: Page, role: TestRole, path = '/schedules/week?tab=week') {
  await page.addInitScript((opts: { role: TestRole }) => {
    const w = window as typeof window & { __ENV__?: Record<string, string> };
    w.__ENV__ = {
      ...(w.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_E2E_ENFORCE_AUDIENCE: '1',
      VITE_TEST_ROLE: opts.role,
      VITE_AAD_ADMIN_GROUP_ID: 'e2e-admin-group-id',
      VITE_AAD_RECEPTION_GROUP_ID: 'e2e-reception-group-id',
      VITE_SKIP_SHAREPOINT: '1',
      VITE_FEATURE_SCHEDULES: '1',
      VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
      VITE_SCHEDULES_SAVE_MODE: 'mock',
    };

    window.localStorage.setItem('skipLogin', '1');
    window.localStorage.setItem('feature:schedules', '1');
    window.localStorage.setItem('feature:schedulesWeekV2', '1');
  }, { role });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(TESTIDS['schedules-week-page'])).toBeVisible();
}

async function openCreateDialogByUrl(page: Page) {
  const url = new URL(page.url());
  const dateParam = url.searchParams.get('date') ?? '2025-11-24';
  url.searchParams.set('dialog', 'create');
  url.searchParams.set('dialogDate', dateParam);
  url.searchParams.set('dialogStart', '10:00');
  url.searchParams.set('dialogEnd', '10:30');
  await page.goto(`${url.pathname}?${url.searchParams.toString()}`, { waitUntil: 'domcontentloaded' });
}

async function createAndSaveFromWeek(page: Page, title: string) {
  await openCreateDialogByUrl(page);

  const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
  await expect(dialog).toBeVisible();

  await dialog.getByTestId(TESTIDS['schedule-create-title']).fill(title);

  const categorySelect = dialog.getByTestId(TESTIDS['schedule-create-category-select']);
  await categorySelect.click();
  await page.getByRole('option', { name: /職員/ }).first().click();
  await expect(categorySelect).toContainText(/職員/);

  await dialog.getByTestId(TESTIDS['schedule-create-staff-id']).fill('1');

  const saveButton = dialog.getByTestId(TESTIDS['schedule-create-save']);
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect
    .poll(() => new URL(page.url()).searchParams.get('dialog'), { timeout: 15_000 })
    .toBeNull();
}

test.describe('reception schedule week create-save guard e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('viewer cannot create from week view', async ({ page }) => {
    await bootstrapRole(page, 'viewer');

    await openCreateDialogByUrl(page);
    await expect(page.getByTestId(TESTIDS['schedule-create-dialog'])).toHaveCount(0);
  });

  test('reception can create and save from week view', async ({ page }) => {
    await bootstrapRole(page, 'reception');
    await createAndSaveFromWeek(page, `reception-week-${Date.now()}`);
  });

  test('admin can create and save from week view', async ({ page }) => {
    await bootstrapRole(page, 'admin');
    await createAndSaveFromWeek(page, `admin-week-${Date.now()}`);
  });
});
