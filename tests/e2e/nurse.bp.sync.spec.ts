import { TESTIDS } from '@/testids';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { enableNurseFlag } from './utils/enableNurseFlag';
import { waitForSyncFeedback } from './utils/nurse';

const PAGE_URL = '/nurse/observation?user=I022&tab=bp';

const pulseFieldId = TESTIDS.NURSE_BP_INPUT_PULSE;
const sysFieldId = TESTIDS.NURSE_BP_INPUT_SYS;
const diaFieldId = TESTIDS.NURSE_BP_INPUT_DIA;
const saveId = TESTIDS.NURSE_OBS_SAVE;
const panelId = TESTIDS.NURSE_BP_PANEL;

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

type QueueSnapshotEntry = {
  vitals?: {
    pulse?: number;
    sys?: number;
    dia?: number;
  };
} & Record<string, unknown>;

const getQueueSnapshot = (page: Page): Promise<QueueSnapshotEntry[]> =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('nurse.queue.v2');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

const assertPulseInputInteractive = async (page: Page, testInfo: TestInfo) => {
  const locator = page.locator(`[data-testid="${pulseFieldId}"]`);

  await expect(locator).toHaveCount(1, { timeout: 10_000 });
  await locator.scrollIntoViewIfNeeded();

  try {
    await expect(locator).toBeVisible({ timeout: 5000 });
  } catch (error) {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('debug-pulse-not-visible.png', {
      body: screenshot,
      contentType: 'image/png',
    });
    throw error;
  }

  await expect
    .poll(async () => locator.evaluate((el) => (el as HTMLInputElement).readOnly), { timeout: 5000 })
    .toBe(false);

  const attrs = await locator.evaluate((el) => {
    const input = el as HTMLInputElement;
    return {
      disabled: input.disabled,
      readOnly: input.readOnly,
      ariaDisabled: input.getAttribute('aria-disabled'),
      ariaReadonly: input.getAttribute('aria-readonly'),
      className: input.className,
      outerHTML: input.outerHTML,
    };
  });
  const isDisabled = attrs.disabled === true || attrs.ariaDisabled === 'true' || (attrs.className ?? '').includes('Mui-disabled');
  if (isDisabled) {
    const url = await page.url();
    console.log('DEBUG: pulse input disabled — URL:', url);
    console.log('DEBUG: pulse input attrs:', attrs);
    const parentHtml = await locator.evaluate((el) => el.parentElement?.outerHTML ?? '');
    console.log('DEBUG: pulse input parent HTML snippet:', parentHtml.slice(0, 5000));
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('debug-pulse-disabled.png', {
      body: screenshot,
      contentType: 'image/png',
    });
    await testInfo.attach('debug-pulse-disabled.json', {
      body: JSON.stringify({ url, attrs }, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('debug-pulse-parent.html', {
      body: parentHtml,
      contentType: 'text/html',
    });
    throw new Error('Pulse input disabled (see debug attachments for context)');
  }
};

const openNumericDialog = async (page: Page, fieldId: string) => {
  const input = page.getByTestId(fieldId);
  await input.click();
  const clearButton = page.getByRole('button', { name: 'クリア' });
  await clearButton.waitFor();
  await clearButton.click();
};

const commitNumericDialog = async (page: Page, value: string) => {
  for (const char of value) {
    if (char === '.') {
      await page.getByRole('button', { name: '小数点' }).click();
    } else {
      await page.getByRole('button', { name: char }).click();
    }
  }
  await page.getByRole('button', { name: '決定' }).click();
};

const setVitalValue = async (page: Page, fieldId: string, value: string) => {
  await openNumericDialog(page, fieldId);
  await commitNumericDialog(page, value);
};

test.describe('Nurse BP panel sync flow', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await enableNurseFlag(page);
    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/api/')) {
        return;
      }
      const status = response.status();
      if (status < 400) {
        return;
      }
      let body: string;
      try {
        body = await response.text();
      } catch {
        body = '<no-body>';
      }
      console.log('DEBUG: API error', status, url, body.slice(0, 2000));
    });
    await page.route('**/api/sp/lists/**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ value: [] }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }
      await route.continue();
    });
    await page.route('**/api/users/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ Id: 1, UserID: 'I022', FullName: 'テスト 利用者' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
    await page.route('**/api/patients/**/observations', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ observations: [] }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await expect(page).toHaveURL(/\/nurse\/observation/);
    await assertPulseInputInteractive(page, testInfo);
    await page.evaluate(() => {
      window.localStorage?.removeItem('nurse.queue.v2');
    });
    await expect(page.getByTestId(panelId)).toBeVisible();
  });

  test('enqueues blood pressure & pulse values then flushes pending queue', async ({ page }, testInfo) => {
    await assertPulseInputInteractive(page, testInfo);
    await setVitalValue(page, pulseFieldId, '72');
    await setVitalValue(page, sysFieldId, '118');
    await setVitalValue(page, diaFieldId, '74');

    const saveButton = page.getByTestId(saveId);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    expect(await getQueueLength(page)).toBe(1);
    const queueSnapshot = await getQueueSnapshot(page);
    expect(queueSnapshot).toHaveLength(1);
    const [first] = queueSnapshot;
    expect(first?.vitals?.pulse).toBe(72);
    expect(first?.vitals?.sys).toBe(118);
    expect(first?.vitals?.dia).toBe(74);

    await page.getByTestId(TESTIDS.NURSE_SYNC_BUTTON).click();

    await waitForQueueToDrain(page);
  });

  test('Alt+S emits BP success feedback', async ({ page }, testInfo) => {
    await assertPulseInputInteractive(page, testInfo);
    await setVitalValue(page, pulseFieldId, '70');
    await setVitalValue(page, sysFieldId, '120');
    await setVitalValue(page, diaFieldId, '76');
    await page.getByTestId(saveId).click();

    expect(await getQueueLength(page)).toBe(1);

    await page.keyboard.press('Alt+S');

    const message = await waitForSyncFeedback(page);
    expect(message).toMatch(/BP記録を保存しました（\d+件）|同期完了（\d+件）/);
  });

  test('marks out-of-range measurements as invalid', async ({ page }, testInfo) => {
    await assertPulseInputInteractive(page, testInfo);
    await setVitalValue(page, pulseFieldId, '8');
    await expect(page.getByTestId(pulseFieldId)).toHaveAttribute('aria-invalid', 'true');

    await setVitalValue(page, sysFieldId, '260');
    await expect(page.getByTestId(sysFieldId)).toHaveAttribute('aria-invalid', 'true');

    await setVitalValue(page, diaFieldId, '10');
    await expect(page.getByTestId(diaFieldId)).toHaveAttribute('aria-invalid', 'true');
  });
});
