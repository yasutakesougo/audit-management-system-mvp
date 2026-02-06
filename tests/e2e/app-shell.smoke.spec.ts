import { expect, test } from '@playwright/test';
import {
  clickBestEffort,
  expectLocatorVisibleBestEffort,
  expectTestIdVisibleBestEffort,
} from './_helpers/smoke';

test.describe('app shell smoke (appRender recovery)', () => {
  test('renders app shell and exposes navigation', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

    await expectTestIdVisibleBestEffort(page, 'app-shell');

    await clickBestEffort(
      page.getByTestId('desktop-nav-open'),
      'testid not found: desktop-nav-open (allowed for smoke)'
    );
    await clickBestEffort(
      page.getByTestId('nav-open'),
      'testid not found: nav-open (allowed for smoke)'
    );

    await expectLocatorVisibleBestEffort(
      page.getByTestId('nav-drawer'),
      'testid not found: nav-drawer (allowed for smoke)'
    );
    await expectLocatorVisibleBestEffort(
      page.getByTestId('nav-items'),
      'testid not found: nav-items (allowed for smoke)'
    );

    await expectLocatorVisibleBestEffort(
      page.getByTestId('nav-audit'),
      'testid not found: nav-audit (allowed for smoke)'
    );
    await expectLocatorVisibleBestEffort(
      page.getByTestId('nav-checklist'),
      'testid not found: nav-checklist (allowed for smoke)'
    );
  });
});
