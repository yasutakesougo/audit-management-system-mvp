import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.createContext({
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto('http://localhost:5173/schedules/week?tab=month');
await page.waitForTimeout(800);

// Measure vertical overflow
const contentHeight = await page.evaluate(() => {
  const container = document.querySelector('[data-testid="schedules-header-root"]');
  return {
    offsetHeight: container?.offsetHeight,
    scrollHeight: container?.scrollHeight,
    clientHeight: container?.clientHeight,
    subLabel: document.querySelector('[variant="caption"]')?.offsetHeight,
  };
});

console.log('Header Measurements (iPad 1194x834):');
console.log(JSON.stringify(contentHeight, null, 2));

await browser.close();
