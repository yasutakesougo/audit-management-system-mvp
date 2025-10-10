import { expect, Page } from '@playwright/test';

type ToastOptions = {
  message: string | RegExp;
  timeout?: number;
};

export async function expectToastAnnounce(page: Page, options: ToastOptions): Promise<void> {
  const { message, timeout = 5_000 } = options;
  const statusRegion = page.getByRole('status');
  await expect(statusRegion).toBeVisible({ timeout });
  if (typeof message === 'string') {
    await expect(statusRegion.getByText(message, { exact: true })).toBeVisible({ timeout });
  } else {
    await expect(statusRegion).toContainText(message, { timeout });
  }
}
