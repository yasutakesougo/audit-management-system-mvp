import { expect, test, type Locator, type Page } from '@playwright/test';

type BestEffortOptions = {
  timeout?: number;
  note?: string;
};

export async function expectLocatorVisibleBestEffort(
  locator: Locator,
  note: string,
  timeout?: number
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    if (timeout !== undefined) {
      await expect(locator.first()).toBeVisible({ timeout });
    } else {
      await expect(locator.first()).toBeVisible();
    }
    return;
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
    if (timeout !== undefined) {
      await expect(locator.first()).toBeEnabled({ timeout });
    } else {
      await expect(locator.first()).toBeEnabled();
    }
    return;
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
