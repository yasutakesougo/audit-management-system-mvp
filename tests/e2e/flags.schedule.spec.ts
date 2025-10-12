import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:5173";

const scheduleNavLabel = /スケジュール/;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.addInitScript(() => {
    const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
    globalWithEnv.__ENV__ = {
      ...(globalWithEnv.__ENV__ ?? {}),
      VITE_FEATURE_SCHEDULES: '0',
      VITE_FEATURE_SCHEDULES_CREATE: '0',
    };
  });
});

test.describe("schedule feature flag", () => {
  test("hides schedule navigation and redirects deep links when flag disabled", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    await expect(page.getByRole("link", { name: scheduleNavLabel })).toHaveCount(0);

    await page.goto(`${BASE_URL}/schedules/month`);
    await page.waitForURL(`${BASE_URL}/`, { waitUntil: "commit" });
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByRole("heading", { name: scheduleNavLabel })).toHaveCount(0);
  });

  test("shows navigation and loads schedule when flag enabled", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("feature:schedules", "true");
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_FEATURE_SCHEDULES: '1',
      };
    });

    await page.goto(`${BASE_URL}/`);

    const monthNav = page.getByRole("link", { name: scheduleNavLabel });
    await expect(monthNav).toBeVisible();

    await monthNav.click();

    await expect(page).toHaveURL(`${BASE_URL}/schedules/week`);
    await expect(page.getByRole("heading", { name: scheduleNavLabel })).toBeVisible();
  });
});
