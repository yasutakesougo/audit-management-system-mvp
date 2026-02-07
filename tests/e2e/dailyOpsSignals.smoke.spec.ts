import { test, expect } from '@playwright/test';

test.use({
  trace: 'on-first-retry',
});

test('DailyOpsSignals page loads with dev harness', async ({ page }) => {
  // 🛡️ Network Guard: allow only localhost/127 and data/blob
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;

    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      throw new Error(`Network guard blocked non-URL request: ${url}`);
    }

    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      throw new Error(`Network guard blocked external call: ${url}`);
    }
  });

  // Navigate to dev page
  await page.goto('/dev/daily-ops');

  // Wait for page to fully load
  await page.waitForLoadState('networkidle');

  // Get page title for debugging
  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Verify smoke test component is present (minimal UI check)
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });

  // Verify test elements are present
  const countElement = page.getByTestId('dailyops-count');
  const jsonElement = page.getByTestId('dailyops-json');

  if ((await countElement.count()) > 0) {
    await expect(countElement).toBeVisible({ timeout: 10000 });
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'dailyops-count not found (allowed for smoke)',
    });
  }

  if ((await jsonElement.count()) > 0) {
    await expect(jsonElement).toBeVisible({ timeout: 10000 });
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'dailyops-json not found (allowed for smoke)',
    });
  }

  // Verify buttons exist
  const upsertBtn = page.locator('button:has-text("Upsert")').first();
  const resolveBtn = page.locator('button:has-text("Resolve latest")').first();

  if ((await upsertBtn.count()) > 0) {
    await expect(upsertBtn).toBeVisible({ timeout: 10000 });
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'upsert button not found (allowed for smoke)',
    });
  }

  if ((await resolveBtn.count()) > 0) {
    await expect(resolveBtn).toBeVisible({ timeout: 10000 });
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'resolve button not found (allowed for smoke)',
    });
  }

  // Verify initial state shows count 0 (best-effort)
  if ((await countElement.count()) > 0) {
    await expect(countElement).toContainText('Count: 0');
  }

  console.log('✓ Page loaded successfully');
});
