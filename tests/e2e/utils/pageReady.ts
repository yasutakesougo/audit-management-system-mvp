import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

type ReadyOpts = {
  timeout?: number;
  testInfo?: TestInfo;
  label?: string;
};

async function attachOnFailure(page: Page, opts: ReadyOpts, reason: string) {
  const { testInfo } = opts;
  if (!testInfo) return;

  const suffix = `${Date.now()}`;
  const label = opts.label ?? 'ready';
  const dir = path.join(process.cwd(), 'test-results');
  await fs.mkdir(dir, { recursive: true }).catch(() => undefined);

  const pngPath = path.join(dir, `${label}-${reason}-${suffix}.png`);
  try {
    await page.screenshot({ path: pngPath, fullPage: true });
    const body = await fs.readFile(pngPath).catch(() => Buffer.from(''));
    await testInfo.attach(path.basename(pngPath), {
      body,
      contentType: 'image/png',
    });
  } catch {
    /* ignore */
  }

  try {
    const html = await page.content();
    const htmlPath = path.join(dir, `${label}-${reason}-${suffix}.html`);
    await fs.writeFile(htmlPath, html).catch(() => undefined);
    await testInfo.attach(path.basename(htmlPath), {
      body: html,
      contentType: 'text/html',
    });
  } catch {
    /* ignore */
  }
}

export async function waitForAppRoot(page: Page, rootTestId: string | string[] = ['app-root', 'app-shell'], opts: ReadyOpts = {}) {
  const timeout = opts.timeout ?? 20_000;
  const candidates = Array.isArray(rootTestId) ? rootTestId : [rootTestId];
  let lastError: unknown;

  for (const id of candidates) {
    try {
      await expect(page.getByTestId(id)).toBeVisible({ timeout });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  await attachOnFailure(page, { ...opts, label: opts.label ?? 'app-root' }, 'not-visible');
  throw lastError;
}

export async function waitVisible(locator: Locator, page: Page, opts: ReadyOpts = {}) {
  const timeout = opts.timeout ?? 20_000;
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (error) {
    await attachOnFailure(page, { ...opts, label: opts.label ?? 'visible' }, 'not-visible');
    throw error;
  }
}

export async function scrollAndClick(locator: Locator, page: Page, opts: ReadyOpts = {}) {
  await waitVisible(locator, page, { ...opts, label: opts.label ?? 'click-target' });
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click({ timeout: opts.timeout ?? 20_000 });
}
