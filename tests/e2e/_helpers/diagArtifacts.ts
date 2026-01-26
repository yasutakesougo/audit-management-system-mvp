import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Ring buffer for console messages (max 100 entries to avoid OOM)
 */
export class ConsoleLogger {
  private logs: string[] = [];
  private readonly maxSize = 100;

  add(type: string, text: string) {
    this.logs.push(`[${type.toUpperCase()}] ${text}`);
    if (this.logs.length > this.maxSize) {
      this.logs.shift();
    }
  }

  get content(): string {
    return this.logs.join('\n');
  }
}

/**
 * Collector for page errors
 */
export class PageErrorCollector {
  private errors: string[] = [];

  add(error: Error) {
    this.errors.push(`${error.name}: ${error.message}\n${error.stack || ''}`);
  }

  get content(): string {
    return this.errors.join('\n---\n');
  }
}

export async function setupConsoleAndErrorCapture(
  page: Page,
  consoleLogger: ConsoleLogger,
  errorCollector: PageErrorCollector
) {
  page.on('console', (msg) => {
    consoleLogger.add(msg.type(), msg.text());
  });

  page.on('pageerror', (error) => {
    errorCollector.add(error);
  });
}

export async function attachUIState(page: Page, testInfo: TestInfo, name = 'ui-state') {
  // URL
  await testInfo.attach(`${name}.url.txt`, {
    body: Buffer.from(page.url(), 'utf-8'),
    contentType: 'text/plain',
  });

  // DOM snapshot（巨大になりやすいので軽めに）
  const html = await page.content();
  await testInfo.attach(`${name}.html`, {
    body: Buffer.from(html, 'utf-8'),
    contentType: 'text/html',
  });
}

export async function attachOnFailure(
  page: Page,
  testInfo: TestInfo,
  consoleLogger?: ConsoleLogger,
  errorCollector?: PageErrorCollector
) {
  if (testInfo.status !== testInfo.expectedStatus) {
    // screenshot / trace は config で取れてる前提でも、ここで追撃の1枚を確実に残す
    await testInfo.attach('failure.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await attachUIState(page, testInfo, 'failure');

    // Attach console logs if captured
    if (consoleLogger && consoleLogger.content) {
      await testInfo.attach('failure.console.log', {
        body: Buffer.from(consoleLogger.content, 'utf-8'),
        contentType: 'text/plain',
      });
    }

    // Attach page errors if captured
    if (errorCollector && errorCollector.content) {
      await testInfo.attach('failure.pageerror.log', {
        body: Buffer.from(errorCollector.content, 'utf-8'),
        contentType: 'text/plain',
      });
    }
  }
}

export async function expectVisibleWithShot(
  locator: ReturnType<Page['locator']> | any,
  page: Page,
  testInfo: TestInfo,
  label: string,
  timeout = 10_000
) {
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (e) {
    await testInfo.attach(`missing-${label}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    throw e;
  }
}
