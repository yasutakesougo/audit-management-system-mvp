import { test, expect } from "@playwright/test";

test("Schedule month view renders", async ({ page }) => {
  await page.goto("http://localhost:5173/schedules/month");
  await expect(page.getByRole("heading", { name: "スケジュール（月表示）" })).toBeVisible();
});
