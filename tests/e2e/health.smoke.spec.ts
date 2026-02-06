import { test, expect } from "@playwright/test";

test("health page loads and shows diagnosis header", async ({ page }) => {
  await page.goto("/diagnostics/health");
  await expect(
    page.getByRole("heading", { name: /環境診断/ })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "総合判定" })).toBeVisible();
});

test("health page has re-run button", async ({ page }) => {
  await page.goto("/diagnostics/health");
  const runButton = page.getByRole("button", { name: "再実行" });
  await expect(runButton).toBeVisible();
});

test("health page displays categories", async ({ page }) => {
  await page.goto("/diagnostics/health");
  // Wait for report to load
  await expect(page.getByText(/カテゴリ別/)).toBeVisible({ timeout: 5000 });
  // At least one category should be visible
  await expect(page.getByText(/config:/i)).toBeVisible({ timeout: 5000 });
});

test("health page has share buttons", async ({ page }) => {
  await page.goto("/diagnostics/health");
  
  // ページのロードとHydration完了を待つ
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  // Wait for report to load
  await expect(page.getByText(/カテゴリ別/)).toBeVisible({ timeout: 10000 });
  // Verify share buttons are visible
  const summaryButton = page.getByRole("button", { name: /サマリーをコピー/ });
  const jsonButton = page.getByRole("button", { name: /JSONをコピー/ });
  await expect(summaryButton).toBeVisible();
  await expect(jsonButton).toBeVisible();
  // Buttons should be enabled when report is loaded
  await expect(summaryButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
});
