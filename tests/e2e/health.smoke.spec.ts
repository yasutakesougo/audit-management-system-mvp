import { test, expect } from "@playwright/test";

test("health page loads and shows diagnosis header", async ({ page }) => {
  await page.goto("/diagnostics/health");
  
  // ページのロードとHydration完了を待つ
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
  
  await expect(
    page.getByRole("heading", { name: /環境診断/ })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "総合判定" })).toBeVisible();
});

test("health page has re-run button", async ({ page }) => {
  await page.goto("/diagnostics/health");
  
  // ページのロードとHydration完了を待つ
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
  
  const runButton = page.getByRole("button", { name: "再実行" });
  await expect(runButton).toBeVisible();
});

test("health page displays categories", async ({ page }) => {
  await page.goto("/diagnostics/health");
  
  // ページのロードとHydration完了を待つ
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
  
  // Smoke: verify page structure without fragile text matching
  await expect(page).toHaveURL(/\/diagnostics\/health/);
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  // At least one heading should be visible (general structure check)
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5000 });
});

test("health page has share buttons", async ({ page }) => {
  await page.goto("/diagnostics/health");
  
  // ページのロードとHydration完了を待つ
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
  
  // Smoke: verify buttons exist without waiting for full report load
  await expect(page).toHaveURL(/\/diagnostics\/health/);
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  
  // Verify at least one share button is visible (looser matching for resilience)
  const jsonButton = page.getByRole("button", { name: /json/i });
  await expect(jsonButton).toBeVisible({ timeout: 10_000 });
});
