import { Page } from '@playwright/test';

export async function enableSchedulesFeature(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('feature:schedules', '1');
    // localStorage.setItem('feature:schedules:graph', '1');
    // sessionStorage.setItem('e2e:msal:mock', '1');
  });
}
