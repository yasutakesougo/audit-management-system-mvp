import { test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

test('Dump health status to console', async ({ page }) => {
  // 1. Prime the environment
  await primeOpsEnv(page);
  
  // 2. Navigate to diagnostics (Correct path is /admin/status)
  console.log('Navigating to /admin/status...');
  await page.goto('/admin/status');
  
  // 3. Wait for content
  await page.waitForLoadState('networkidle');
  
  // 4. Try to wait for "環境診断" or "総合判定"
  // The page has <Typography variant="h5">環境診断</Typography>
  await page.waitForSelector('text=環境診断', { timeout: 15000 }).catch(() => {
    console.log('WARNING: "環境診断" not found within 15s. Checking page state...');
  });

  // 5. Capture state for debugging
  const url = page.url();
  const title = await page.title();
  const content = await page.textContent('body');
  
  console.log(`--- PAGE STATE ---`);
  console.log(`URL: ${url}`);
  console.log(`Title: ${title}`);
  console.log(`Body contains "環境診断": ${content?.includes('環境診断')}`);
  console.log(`Body contains "総合判定": ${content?.includes('総合判定')}`);

  // 6. Extract diagnostic data logic
  const diagnosticData = await page.evaluate(() => {
    const results: { label: string; status: string; detail?: string | null }[] = [];
    // Search for all relevant items
    const papers = document.querySelectorAll('.MuiPaper-root');
    papers.forEach(p => {
      const labelText = p.querySelector('.MuiTypography-subtitle2')?.textContent?.trim();
      const statusText = p.querySelector('.MuiChip-label')?.textContent?.trim();
      const detailText = p.querySelector('.MuiTypography-body2')?.textContent?.trim();

      if (labelText && statusText && (statusText === 'PASS' || statusText === 'WARN' || statusText === 'FAIL')) {
        results.push({
          label: labelText,
          status: statusText,
          detail: detailText
        });
      }
    });

    // Extract Overall Status
    let overall = 'UNKNOWN';
    const chips = document.querySelectorAll('.MuiChip-root');
    for (const chip of Array.from(chips)) {
        // If it's the big one or near "総合判定"
        const parentText = chip.parentElement?.textContent || '';
        if (parentText.includes('総合判定')) {
            overall = chip.querySelector('.MuiChip-label')?.textContent?.trim() || overall;
        }
    }

    return { overall, results };
  });

  console.log('--- SYSTEM HEALTH DIAGNOSTICS ---');
  console.log(JSON.stringify(diagnosticData, null, 2));
  console.log('---------------------------------');
  
  // Assertion to keep the test failing if no data is found
  if (diagnosticData.results.length === 0) {
      await page.screenshot({ path: 'health-diagnosis-empty.png' });
      throw new Error('No diagnostic results found on the page. See screenshot and logs.');
  }
});
