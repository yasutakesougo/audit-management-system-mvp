#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = process.env.BOOTSTRAP_DIAG_DIR || 'reports/e2e-bootstrap';
const targetUrl = process.env.BOOTSTRAP_DIAG_URL || 'http://127.0.0.1:5173/schedules/week?tab=week';
const safeEnvKeys = [
  'MODE',
  'NODE_ENV',
  'VITE_APP_ENV',
  'VITE_E2E',
  'VITE_E2E_MSAL_MOCK',
  'VITE_SKIP_LOGIN',
  'VITE_SKIP_SHAREPOINT',
  'VITE_FORCE_SHAREPOINT',
  'VITE_DATA_PROVIDER',
  'VITE_DEMO_MODE',
  'VITE_FEATURE_SCHEDULES',
  'VITE_FEATURE_SCHEDULES_WEEK_V2',
];

fs.mkdirSync(outputDir, { recursive: true });

const diagnostics = {
  targetUrl,
  finalUrl: null,
  capturedAt: new Date().toISOString(),
  console: [],
  pageErrors: [],
  requestFailures: [],
  responses: [],
  runtimeFlags: {},
  bodyHtml: '',
  rootHtml: '',
  documentHtml: '',
  error: null,
};

const writeDiagnostics = () => {
  fs.writeFileSync(path.join(outputDir, 'bootstrap-diagnostics.json'), `${JSON.stringify(diagnostics, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'document.html'), diagnostics.documentHtml, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'body.html'), diagnostics.bodyHtml, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'root.html'), diagnostics.rootHtml, 'utf8');
};

const responseBody = async (response) => {
  if (!/\/env\.runtime\.json$|\/manifest\.webmanifest$/.test(response.url())) return undefined;
  try {
    const body = await response.text();
    return body.slice(0, 50_000);
  } catch {
    return undefined;
  }
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (message) => {
    diagnostics.console.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push({ name: error.name, message: error.message, stack: error.stack ?? '' });
  });
  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText ?? 'unknown',
    });
  });
  page.on('response', async (response) => {
    if (!/\/env\.runtime\.json$|\/manifest\.webmanifest$/.test(response.url())) return;
    diagnostics.responses.push({
      url: response.url(),
      status: response.status(),
      body: await responseBody(response),
    });
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5_000);
  diagnostics.finalUrl = page.url();
  const snapshot = await page.evaluate((keys) => {
    const env = (window.__ENV__ ?? {});
    return {
      runtimeFlags: Object.fromEntries(keys.map((key) => [key, env[key] ?? null])),
      bodyHtml: document.body?.innerHTML ?? '',
      rootHtml: document.querySelector('#root')?.innerHTML ?? '',
      documentHtml: document.documentElement?.outerHTML ?? '',
    };
  }, safeEnvKeys);
  Object.assign(diagnostics, snapshot);
  await page.screenshot({ path: path.join(outputDir, 'bootstrap.png'), fullPage: true });
} catch (error) {
  diagnostics.error = { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? '' };
} finally {
  if (browser) await browser.close();
  writeDiagnostics();
}

console.log(JSON.stringify({
  targetUrl: diagnostics.targetUrl,
  finalUrl: diagnostics.finalUrl,
  rootLength: diagnostics.rootHtml.length,
  consoleCount: diagnostics.console.length,
  pageErrorCount: diagnostics.pageErrors.length,
  requestFailureCount: diagnostics.requestFailures.length,
  error: diagnostics.error,
}, null, 2));
