import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

test("Schedule week view loads", async ({ page }) => {
  await page.goto(`${BASE_URL}/schedules/week`);
  await expect(page.getByRole("heading", { name: "スケジュール（週表示）" })).toBeVisible();
});
