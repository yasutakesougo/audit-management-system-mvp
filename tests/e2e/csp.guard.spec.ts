import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const COLLECTOR_PORT = Number(process.env.CSP_PORT || 8787);
const COLLECTOR_PREFIX = process.env.CSP_PREFIX || '/__csp__';
const REPORT_DIR = process.env.CSP_REPORT_DIR || 'csp-reports';
const PREVIEW_ORIGIN = process.env.CSP_PREVIEW_ORIGIN || 'http://localhost:4173';

async function fetchCollectorHealth() {
  const response = await fetch(`http://localhost:${COLLECTOR_PORT}${COLLECTOR_PREFIX}/health`);
  return response.ok;
}

async function readViolationLog() {
  const filePath = resolve(process.cwd(), REPORT_DIR, 'violations.ndjson');
  if (!existsSync(filePath)) {
    return '';
  }
  const content = await readFile(filePath, 'utf8');
  return content.trim();
}

test('serves CSP without violations', async ({ page }) => {
  const healthy = await fetchCollectorHealth();
  expect(healthy, 'CSP collector health check should succeed').toBeTruthy();

  const response = await page.goto(`${PREVIEW_ORIGIN}/`, { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toBeVisible();

  const cspHeader = response?.headers()['content-security-policy'] ?? response?.headers()['content-security-policy-report-only'];
  expect(cspHeader, 'CSP header should be present on preview responses').toBeTruthy();
  expect(cspHeader?.includes(COLLECTOR_PREFIX), 'CSP header should reference the report endpoint').toBeTruthy();

  await page.waitForTimeout(750);

  const violations = await readViolationLog();
  expect(violations, 'CSP reports should be empty').toBe('');
});
