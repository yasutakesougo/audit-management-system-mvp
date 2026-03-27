import { expect, test } from '@playwright/test';

test.describe('Today Ops handoff quicknote dialog', () => {
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1',
    },
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } }),
    }));
  });

  test('panel quicknote opens only panel dialog and avoids aria-hidden focus warning', async ({ page }) => {
    const ariaHiddenWarnings: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Blocked aria-hidden')) {
        ariaHiddenWarnings.push(text);
      }
    });

    await page.goto('/today');

    const openButton = page.getByTestId('handoff-panel-add-button');
    const panelDialog = page.getByTestId('handoff-panel-quicknote-dialog');
    const footerDialog = page.getByTestId('handoff-quicknote-dialog');

    await expect(openButton).toBeVisible({ timeout: 5000 });
    await openButton.click();

    await expect(panelDialog).toBeVisible();
    await expect(footerDialog).toBeHidden();
    await expect(panelDialog.getByTestId('handoff-quicknote-card')).toBeVisible();

    await panelDialog.getByRole('button', { name: '申し送りダイアログを閉じる' }).click();
    await expect(panelDialog).toBeHidden();

    expect(ariaHiddenWarnings, ariaHiddenWarnings.join('\n')).toEqual([]);
  });
});
