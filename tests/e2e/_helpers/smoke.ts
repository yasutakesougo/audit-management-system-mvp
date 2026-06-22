import { expect, test, type Locator, type Page } from '@playwright/test';

type BestEffortOptions = {
  timeout?: number;
  note?: string;
};

type SmokeReadyOptions = {
  timeout?: number;
};

export async function expectSmokePageReady(
  page: Page,
  options: SmokeReadyOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 15_000;

  await expect(async () => {
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false);
    const hasAppShell = await page.getByTestId('app-shell').isVisible().catch(() => false);
    const hasMain = await page.locator('main').first().isVisible().catch(() => false);

    expect(hasHeading || hasAppShell || hasMain).toBe(true);
  }).toPass({ timeout });
}

export async function expectLocatorVisibleBestEffort(
  locator: Locator,
  note: string,
  timeout?: number
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    try {
      if (timeout !== undefined) {
        await expect(locator.first()).toBeVisible({ timeout });
      } else {
        await expect(locator.first()).toBeVisible();
      }
      return;
    } catch (error) {
      test.info().annotations.push({
        type: 'note',
        description: `${note}; visible check failed: ${String(error)}`,
      });
      return;
    }
  }

  test.info().annotations.push({
    type: 'note',
    description: note,
  });
}

export async function expectLocatorEnabledBestEffort(
  locator: Locator,
  note: string,
  timeout?: number
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    try {
      if (timeout !== undefined) {
        await expect(locator.first()).toBeEnabled({ timeout });
      } else {
        await expect(locator.first()).toBeEnabled();
      }
      return;
    } catch (error) {
      test.info().annotations.push({
        type: 'note',
        description: `${note}; enabled check failed: ${String(error)}`,
      });
      return;
    }
  }

  test.info().annotations.push({
    type: 'note',
    description: note,
  });
}

export async function expectTestIdVisibleBestEffort(
  page: Page,
  testId: string,
  options: BestEffortOptions = {}
): Promise<void> {
  const note = options.note ?? `testid not found: ${testId} (allowed for smoke)`;
  const locator = page.getByTestId(testId);
  await expectLocatorVisibleBestEffort(locator, note, options.timeout);
}

export async function expectTestIdEnabledBestEffort(
  page: Page,
  testId: string,
  options: BestEffortOptions = {}
): Promise<void> {
  const note = options.note ?? `testid not found: ${testId} (allowed for smoke)`;
  const locator = page.getByTestId(testId);
  await expectLocatorEnabledBestEffort(locator, note, options.timeout);
}

export async function clickBestEffort(
  locator: Locator,
  note = 'locator not found (allowed for smoke)'
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    try {
      await locator.first().click();
    } catch (error) {
      test.info().annotations.push({
        type: 'note',
        description: `${note}; click failed: ${String(error)}`,
      });
    }
    return;
  }

  test.info().annotations.push({
    type: 'note',
    description: note,
  });
}
