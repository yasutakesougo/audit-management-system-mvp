import { test, expect } from "@playwright/test";

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
      VITE_SKIP_LOGIN: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/Audit',
    };
  });
});

test.describe("schedule feature flag", () => {
  test("hides schedule navigation and redirects deep links when flag disabled", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 });

    await expect(page.getByRole("link", { name: scheduleNavLabel })).toHaveCount(0);

    await page.goto("/schedules/month");
    await page.waitForLoadState("networkidle", { timeout: 5_000 });
    await page.waitForURL("**/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: scheduleNavLabel })).toHaveCount(0);
  });

  test("shows navigation and loads schedule when flag enabled", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("feature:schedules", "true");
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_FEATURE_SCHEDULES: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 });

    const monthNav = page.getByRole("link", { name: scheduleNavLabel });
    await expect(monthNav).toBeVisible();

    await monthNav.click();

  await expect(page).toHaveURL(/\/schedules\/week$/);
    await expect(page.getByRole("heading", { name: scheduleNavLabel })).toBeVisible();
  });
});
