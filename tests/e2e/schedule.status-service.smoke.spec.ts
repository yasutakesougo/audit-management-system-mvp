import { expect, test } from '@playwright/test';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';
import { expectUserCardStatusEnum } from './_helpers/schedule';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { buildScheduleFixturesForDate } from './utils/schedule.fixtures';

const LIST_TITLE = 'Schedules_Master';

const buildScheduleItems = () => {
  const fixtures = buildScheduleFixturesForDate(new Date());
  const items = [...fixtures.User, ...fixtures.Staff, ...fixtures.Org].map((item) => ({ ...item }));

  const livingCare = items.find((item) => item.Id === 9101) ?? items.find((item) => item.cr014_category === 'User');
  if (livingCare) {
    livingCare.Title = '生活介護 午後ケア';
    livingCare.Status = '承認済み';
    livingCare.cr014_serviceType = '生活介護';
  }

  const legacyPending = items.find((item) => item.Id === 9102);
  if (legacyPending) {
    legacyPending.Status = '申請中';
  }

  return items;
};

test.describe('Schedule dialog: status/service end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    const scheduleItems = buildScheduleItems();

    await page.addInitScript(({ env }) => {
      const scope = window as typeof window & { __ENV__?: Record<string, string> };
      scope.__ENV__ = {
        ...(scope.__ENV__ ?? {}),
        ...env,
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('feature:schedules', '1');
      const resetKey = '__scheduleDraftsCleared__';
      if (!window.localStorage.getItem(resetKey)) {
        window.localStorage.removeItem('schedule.localDrafts.v1');
        window.localStorage.setItem(resetKey, '1');
      }
    }, {
      env: {
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_FEATURE_SCHEDULES: '1',
        VITE_DEMO_MODE: '0',
  MODE: 'production',
        DEV: '0',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/AuditSystem',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
      },
    });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await mockEnsureScheduleList(page);

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 101 } },
      fallback: { status: 404, body: {} },
      lists: [
        {
          name: LIST_TITLE,
          aliases: ['Schedules', 'ScheduleEvents', 'SupportSchedule'],
          items: scheduleItems,
          onUpdate: (_id, payload, ctx) => ({
            ...ctx.previous,
            ...(payload as Record<string, unknown>),
          }),
          onCreate: (payload, ctx) => {
            type ScheduleRecord = Record<string, unknown> & { Id: number; Status?: string };
            const record = {
              Id: ctx.takeNextId(),
              ...(payload as Record<string, unknown>),
            } as ScheduleRecord;
            const status = typeof record.Status === 'string' ? record.Status.trim() : '';
            if (!status) {
              record.Status = '予定';
            }
            return record;
          },
        },
      ],
    });

    await page.goto('/schedules/week');
    await expect(page.getByTestId('schedule-page-root')).toBeVisible();

    const searchBox = page.getByRole('textbox', { name: '検索' });
    if (await searchBox.count()) {
      await searchBox.fill('');
    }
  });

  test('edit existing -> service=生活介護 + status=遅刻 persists', async ({ page }) => {
    const livingCareCard = page
      .locator('[data-testid^="event-card-"][data-category="User"]').filter({ hasText: '生活介護' })
      .first();
    await expect(livingCareCard).toBeVisible();
    await livingCareCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const serviceTypeSelect = dialog.getByRole('combobox', { name: 'サービス種別' });
    await serviceTypeSelect.click();
    await page.getByRole('option', { name: '生活介護' }).click();

    const statusSelect = dialog.getByRole('combobox', { name: /ステータス|状態/ });
    await statusSelect.click();
    await page.getByRole('option', { name: '遅刻' }).click();
    await expect(statusSelect).toHaveText(/遅刻/);

    await dialog.getByRole('button', { name: '保存' }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });

    const cardAfterSave = await expectUserCardStatusEnum(page, '生活介護', 'late');
    await expect(cardAfterSave).toContainText(/遅刻|late/, { timeout: 10_000 });

    await page.reload();
    await expect(page.getByTestId('schedule-page-root')).toBeVisible();

    const cardAfterReload = await expectUserCardStatusEnum(page, '生活介護', 'late');
    await expect(cardAfterReload).toContainText(/遅刻|late/, { timeout: 10_000 });
  });

  test('create new: 生活介護 + 休み -> timeline card shows status', async ({ page }) => {
    await page.getByRole('button', { name: '新規作成' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const serviceSelect = dialog.getByRole('combobox', { name: 'サービス種別' });
    await serviceSelect.click();
    await page.getByRole('option', { name: '生活介護' }).click();

  const statusSelect = dialog.getByRole('combobox', { name: /ステータス|状態/ });
  await statusSelect.click();
  await page.getByRole('option', { name: '休み' }).click();

  await dialog.getByLabel('利用者 ID').fill('U-301');
  await dialog.getByLabel('利用者名').fill('自動テスト 利用者');
  await dialog.getByLabel('タイトル').fill('生活介護 休み');

    const todayBase = await page.evaluate(() => {
      const now = new Date();
      const pad = (value: number) => (value < 10 ? `0${value}` : `${value}`);
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      return `${year}-${month}-${day}`;
    });

    const startLocal = `${todayBase}T05:00`;
    const endLocal = `${todayBase}T05:30`;

    await dialog.getByLabel('開始日時').fill(startLocal);
    await dialog.getByLabel('終了日時').fill(endLocal);

    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    const newCard = page
      .locator('[data-testid^="event-card-"]').filter({ hasText: /生活介護/ })
      .filter({ hasText: /休み/ })
      .first();
    await expect(newCard).toBeVisible({ timeout: 10_000 });
    await expect(newCard).toContainText('休み');
    await expect(newCard).toHaveAttribute('data-status-enum', 'holiday');

    const statusChip = newCard.getByTestId('status-chip').first();
    await expect(statusChip).toHaveAttribute('data-status-enum', 'holiday');
    await expect(statusChip).toHaveAttribute('data-status-label', /休み|holiday/i);
    await expect(statusChip).toHaveAttribute('data-color', /success|info|warning|error|default|primary/);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /今日の予定/ })).toBeVisible({ timeout: 10_000 });

    const agendaBadge = page.locator('[data-testid="agenda-badge-status"][data-status-enum="holiday"]').first();
    if (await agendaBadge.count()) {
      await expect(agendaBadge).toBeVisible({ timeout: 5_000 });
      await expect(agendaBadge).toHaveAttribute('data-status-enum', 'holiday');
      await expect(agendaBadge).toHaveAttribute('data-variant', /outlined|filled/);
      await expect(agendaBadge).toHaveAttribute('data-color', /success|info|warning|error|default|primary/);
      await expect(agendaBadge).toHaveAttribute('data-status-label', /休み|holiday/i);
    } else {
      test.info().annotations.push({ type: 'info', description: 'Agenda badge not rendered on dashboard; validated timeline card instead.' });
    }
  });

  test('legacy 申請中 -> その他 (normalised)', async ({ page }) => {
    const normalisedCard = page.locator('[data-testid^="event-card-"]').filter({ hasText: 'その他' }).first();
    await expect(normalisedCard).toBeVisible();
  });
});
