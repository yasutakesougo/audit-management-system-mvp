import { expect, type Page } from '@playwright/test';

export async function waitForTestId(page: Page, id: string, timeout = 10_000): Promise<void> {
  await expect(page.getByTestId(id)).toBeVisible({ timeout });
}
