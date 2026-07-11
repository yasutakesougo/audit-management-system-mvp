import { expect, test } from '@playwright/test';
import { bootTodayOpsPage } from './_helpers/bootTodayOpsPage';
import { TESTIDS } from '@/testids';

test.describe('Today Ops handoff quicknote dialog', () => {
  test.beforeEach(async ({ page }) => {
    await bootTodayOpsPage(page);
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
    await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('hero-action-card')).toBeVisible({ timeout: 15_000 });

    const openButton = page.getByTestId('handoff-panel-add-button').or(
      page.getByRole('button', { name: '申し送り追加' }),
    );
    const panelDialog = page.getByTestId('handoff-panel-quicknote-dialog');
    const footerDialog = page.getByTestId('handoff-quicknote-dialog');

    await expect(openButton).toBeVisible({ timeout: 10_000 });
    await openButton.click();

    await expect(panelDialog).toBeVisible();
    await expect(footerDialog).toBeHidden();
    await expect(panelDialog.getByTestId('handoff-quicknote-card')).toBeVisible();

    await panelDialog.getByRole('button', { name: '申し送りダイアログを閉じる' }).click();
    await expect(panelDialog).toBeHidden();

    expect(ariaHiddenWarnings, ariaHiddenWarnings.join('\n')).toEqual([]);
  });
});
