import { test, expect, type Page } from '@playwright/test';

type TestRole = 'admin' | 'reception' | 'viewer';

const ATTENDANCE_KEY = 'staff-attendance.v1';

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function bootstrapRole(page: Page, role: TestRole, path = '/dashboard') {
  const date = ymd(new Date());
  const seed = {
    attendances: [
      {
        staffId: 'S001',
        recordDate: date,
        status: '出勤',
        note: 'seed note',
        checkInAt: `${date}T09:00:00.000Z`,
      },
    ],
  };

  await page.addInitScript((opts: { role: TestRole; seedKey: string; seedJson: string }) => {
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
      VITE_FEATURE_STAFF_ATTENDANCE: '1',
      VITE_STAFF_ATTENDANCE_STORAGE: 'local',
      VITE_STAFF_ATTENDANCE_WRITE: '1',
    };

    window.localStorage.setItem('skipLogin', '1');
    window.localStorage.setItem(opts.seedKey, opts.seedJson);
    window.localStorage.removeItem('staff-attendance.finalized.v1');
  }, { role, seedKey: ATTENDANCE_KEY, seedJson: JSON.stringify(seed) });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

const accessDeniedHeading = /アクセス権がありません|設定エラー/;

test.describe('reception attendance finalize action guard e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('viewer is blocked on staff attendance admin route', async ({ page }) => {
    await bootstrapRole(page, 'viewer', '/admin/staff-attendance');

    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    await expect(page.getByTestId('staff-attendance-admin-root')).toHaveCount(0);
  });

  test('reception can finalize attendance day', async ({ page }) => {
    await bootstrapRole(page, 'reception', '/admin/staff-attendance');

    await expect(page.getByTestId('staff-attendance-admin-root')).toBeVisible();
    const finalizeButton = page.getByTestId('staff-attendance-finalize-btn');
    await expect(finalizeButton).toBeVisible();
    await expect(finalizeButton).toBeEnabled();

    await finalizeButton.click();
    await expect(page.getByTestId('staff-attendance-finalized-badge')).toBeVisible();
    await expect(finalizeButton).toBeDisabled();
  });

  test('admin can finalize attendance day', async ({ page }) => {
    await bootstrapRole(page, 'admin', '/admin/staff-attendance');

    await expect(page.getByTestId('staff-attendance-admin-root')).toBeVisible();
    const finalizeButton = page.getByTestId('staff-attendance-finalize-btn');
    await expect(finalizeButton).toBeVisible();
    await expect(finalizeButton).toBeEnabled();

    await finalizeButton.click();
    await expect(page.getByTestId('staff-attendance-finalized-badge')).toBeVisible();
    await expect(finalizeButton).toBeDisabled();
  });
});
