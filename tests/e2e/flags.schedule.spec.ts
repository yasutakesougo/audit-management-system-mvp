import { test, expect } from "@playwright/test";
import { enableSchedulesFeature } from "./_helpers/flags";

const BASE_URL = "http://localhost:5173";

const scheduleNavLabel = "スケジュール（月表示）";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test.describe("schedule feature flag", () => {
  test("hides schedule navigation and redirects deep links when flag disabled", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    await expect(page.getByRole("link", { name: scheduleNavLabel })).toHaveCount(0);

    await page.goto(`${BASE_URL}/schedules/month`);
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test("shows navigation and loads schedule month when flag enabled", async ({ page }) => {
    await enableSchedulesFeature(page);

    await page.goto(`${BASE_URL}/`);

    const monthNav = page.getByRole("link", { name: scheduleNavLabel });
    await expect(monthNav).toBeVisible();

    await monthNav.click();

    await expect(page).toHaveURL(`${BASE_URL}/schedules/month`);
    await expect(page.getByRole("heading", { name: scheduleNavLabel })).toBeVisible();
  });
});
