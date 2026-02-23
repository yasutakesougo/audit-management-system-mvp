import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { getSchedulesTodaySeedDate } from './_helpers/schedulesTodaySeed';
import { gotoDay } from './utils/scheduleNav';
import { getVisibleListbox, waitForDayViewReady } from './utils/scheduleActions';

type TestRole = 'admin' | 'reception' | 'viewer';

const TEST_DATE = new Date(getSchedulesTodaySeedDate());

async function bootstrapRole(page: Page, role: TestRole) {
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
      VITE_E2E_FORCE_SCHEDULES_WRITE: opts.role === 'viewer' ? '0' : '1',
    };

    window.localStorage.setItem('skipLogin', '1');
    window.localStorage.setItem('feature:schedules', '1');
    window.localStorage.setItem('feature:schedulesWeekV2', '1');
  }, { role });

  await bootSchedule(page, {
    seed: { schedulesToday: true },
    route: '/schedules/week?tab=day',
    envOverrides: {
      VITE_E2E_FORCE_SCHEDULES_WRITE: role === 'viewer' ? '0' : '1',
    },
  });

  await gotoDay(page, TEST_DATE);
  await waitForDayViewReady(page);
  await expect(page.getByTestId(TESTIDS['schedules-day-page']).first()).toBeVisible();
}

async function openEditDialogByUrl(page: Page) {
  const url = new URL(page.url());
  const dateIso = url.searchParams.get('date') ?? '2025-02-02';
  url.searchParams.set('dialog', 'edit');
  url.searchParams.set('eventId', '70000');
  url.searchParams.set('dialogDate', dateIso);
  url.searchParams.set('dialogStart', '09:00');
  url.searchParams.set('dialogEnd', '09:30');
  url.searchParams.set('dialogCategory', 'User');
  await page.goto(`${url.pathname}?${url.searchParams.toString()}`, { waitUntil: 'domcontentloaded' });

  const editor = page.getByTestId(TESTIDS['schedule-editor-root']);
  await expect(editor).toBeVisible({ timeout: 15_000 });
  return editor;
}

async function editAndSave(page: Page, title: string) {
  const editor = await openEditDialogByUrl(page);

  const titleInput = editor.getByTestId(TESTIDS['schedule-create-title']).first();
  await expect(titleInput).toBeVisible();
  await titleInput.fill(title);

  const serviceTypeSelect = editor.getByTestId(TESTIDS['schedule-create-service-type']).first();
  await expect(serviceTypeSelect).toBeVisible();
  await serviceTypeSelect.click();
  const listbox = getVisibleListbox(page);
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  await listbox.getByRole('option').first().click();

  const saveButton = editor
    .getByTestId(TESTIDS['schedule-editor-save'])
    .or(editor.getByTestId(TESTIDS['schedule-create-save']))
    .first();
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(editor).toBeHidden({ timeout: 15_000 });
}

test.describe('reception schedule day edit-save guard e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('viewer cannot enter edit flow from day view', async ({ page }) => {
    await bootstrapRole(page, 'viewer');

    const editor = await openEditDialogByUrl(page);
    const saveButton = editor
      .getByTestId(TESTIDS['schedule-editor-save'])
      .or(editor.getByTestId(TESTIDS['schedule-create-save']))
      .first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    await expect(editor).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('dialog'), { timeout: 5_000 })
      .toBe('edit');
  });

  test('reception can edit and save from day view', async ({ page }) => {
    await bootstrapRole(page, 'reception');
    await editAndSave(page, `reception-day-edit-${Date.now()}`);
  });

  test('admin can edit and save from day view', async ({ page }) => {
    await bootstrapRole(page, 'admin');
    await editAndSave(page, `admin-day-edit-${Date.now()}`);
  });
});
