import { expect, Page } from '@playwright/test';

type ToastOptions = {
  message: string | RegExp;
  timeout?: number;
};

export async function expectToastAnnounce(page: Page, options: ToastOptions): Promise<void> {
  const { message, timeout = 5_000 } = options;
  const announcer = page.getByTestId('toast-announcer');

  const targetToast = announcer.getByTestId('toast-message').filter({ hasText: message }).first();

  await expect(targetToast).toBeVisible({ timeout });

  if (typeof message === 'string') {
    await expect(targetToast).toContainText(message, { timeout });
  } else {
    await expect(targetToast).toContainText(message, { timeout });
  }
}
