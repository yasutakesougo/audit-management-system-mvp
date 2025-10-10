import { expect, Page } from '@playwright/test';

type FilterActionOptions = {
  scope?: string;
  timeout?: number;
};

const buildLocator = (page: Page, action: string, scope?: string) => {
  if (scope) {
    return page
      .locator(`[data-filter-toolbar][data-scope="${scope}"]`)
      .locator(`[data-filter-action="${action}"]`)
      .first();
  }
  return page.locator(`[data-filter-action="${action}"]`).first();
};

export async function clickEnabledFilterAction(page: Page, action: string, options: FilterActionOptions = {}): Promise<void> {
  const { scope, timeout = 5_000 } = options;
  const locator = buildLocator(page, action, scope);
  await expect(locator).toBeVisible({ timeout });
  const ariaDisabled = await locator.getAttribute('aria-disabled');
  if (ariaDisabled === 'true') {
    throw new Error(`Filter action "${action}" is disabled via aria-disabled attribute.`);
  }
  await expect(locator).toBeEnabled({ timeout });
  await locator.click();
}
