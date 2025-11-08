import { expect, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

export async function waitForSyncFeedback(page: Page, opts?: { timeout?: number }) {
  const timeout = opts?.timeout ?? 6000;
  const toast = page.getByTestId(TESTIDS.NURSE_SYNC_TOAST).or(page.getByTestId('NURSE_SYNC_TOAST'));
  const announce = page
    .getByTestId(TESTIDS.NURSE_SYNC_ANNOUNCE)
    .or(page.getByTestId('NURSE_SYNC_ANNOUNCE'));

  const winner = await Promise.race([
    toast.waitFor({ state: 'visible', timeout }).then(() => 'toast').catch(() => null),
    announce.waitFor({ state: 'visible', timeout }).then(() => 'announce').catch(() => null),
  ]);

  expect(winner).not.toBeNull();

  let message = '';

  if (winner === 'toast') {
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/同期|sync|完了/i);
    message = (await toast.textContent()) ?? '';
    await expect(toast).toBeHidden({ timeout: 8000 });
  } else {
    await expect(announce).toBeVisible();
    await expect(announce).toContainText(/同期|完了|キューなし|no pending/i);
    message = (await announce.textContent()) ?? '';
  }

  return message;
}
