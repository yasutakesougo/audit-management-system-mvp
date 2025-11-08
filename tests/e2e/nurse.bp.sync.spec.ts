import { expect, test, type Page } from '@playwright/test';
import { enableNurseFlag } from './utils/enableNurseFlag';
import { waitForSyncFeedback } from './utils/nurse';

const PAGE_URL = '/nurse/observation?user=I022&tab=bp';

const pulseFieldId = 'nurse-bp-input-pulse';
const sysFieldId = 'nurse-bp-input-sys';
const diaFieldId = 'nurse-bp-input-dia';
const saveId = 'nurse-bp-save';
const panelId = 'nurse-bp-panel';
const lastSavedId = 'nurse-bp-last-saved';
const queueId = 'nurse-bp-queue';

const getQueueLength = (page: Page) =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('nurse.queue.v2');
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });

const waitForQueueToDrain = (page: Page) =>
  page.waitForFunction(() => {
    const raw = window.localStorage.getItem('nurse.queue.v2');
    if (!raw) return true;
    try {
      const parsed = JSON.parse(raw);
      return !Array.isArray(parsed) || parsed.length === 0;
    } catch {
      return false;
    }
  }, null, { timeout: 8000 });

test.describe('Nurse BP panel sync flow', () => {
  test.beforeEach(async ({ page }) => {
    await enableNurseFlag(page);
    await page.route('**/api/sp/lists/**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ status: 200, body: JSON.stringify({ value: [] }), headers: { 'Content-Type': 'application/json' } });
        return;
      }
      if (method === 'POST') {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: Date.now() }), headers: { 'Content-Type': 'application/json' } });
        return;
      }
      await route.continue();
    });
    await page.goto(PAGE_URL);
    await page.evaluate(() => {
      window.localStorage?.removeItem('nurse.queue.v2');
    });
    await expect(page.getByTestId(panelId)).toBeVisible();
  });

  test('enqueues blood pressure & pulse values then flushes pending queue', async ({ page }) => {
    await page.getByTestId(pulseFieldId).fill('72');
    await page.getByTestId(sysFieldId).fill('118');
    await page.getByTestId(diaFieldId).fill('74');

    const saveButton = page.getByTestId(saveId);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    const lastSaved = page.getByTestId(lastSavedId);
    await expect(lastSaved).toContainText(/脈拍\s*72/);
    await expect(page.getByTestId(queueId)).toContainText(/収縮期\s*118/);

    expect(await getQueueLength(page)).toBe(1);

    await page.getByTestId('nurse.sync.button').click();

    await waitForQueueToDrain(page);
  });

  test('Alt+S emits BP success feedback', async ({ page }) => {
    await page.getByTestId(pulseFieldId).fill('70');
    await page.getByTestId(sysFieldId).fill('120');
    await page.getByTestId(diaFieldId).fill('76');
    await page.getByTestId(saveId).click();

    expect(await getQueueLength(page)).toBe(1);

    await page.keyboard.press('Alt+S');

    await waitForQueueToDrain(page);
    const message = await waitForSyncFeedback(page);

    expect(message).toMatch(/BP記録を保存しました（\d+件）|同期完了（\d+件）/);
  });

  test('marks out-of-range measurements as invalid', async ({ page }) => {
    const pulseInput = page.getByTestId(pulseFieldId);
    await pulseInput.fill('8');
    await expect(pulseInput).toHaveAttribute('aria-invalid', 'true');

    const sysInput = page.getByTestId(sysFieldId);
    await sysInput.fill('260');
    await expect(sysInput).toHaveAttribute('aria-invalid', 'true');

    const diaInput = page.getByTestId(diaFieldId);
    await diaInput.fill('10');
    await expect(diaInput).toHaveAttribute('aria-invalid', 'true');
  });
});
