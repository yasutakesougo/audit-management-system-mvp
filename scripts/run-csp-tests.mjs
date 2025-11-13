#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

const env = { ...process.env };

if (!env.CSP_PORT) env.CSP_PORT = '8787';
if (!env.CSP_PREFIX) env.CSP_PREFIX = '/__csp__';
if (!env.CSP_REPORT_DIR) env.CSP_REPORT_DIR = 'csp-reports';
if (!env.CSP_PREVIEW_ORIGIN) env.CSP_PREVIEW_ORIGIN = 'http://127.0.0.1:4173';
if (!env.CSP_PREVIEW_PORT) env.CSP_PREVIEW_PORT = '4173';
if (!env.CSP_COLLECTOR_ORIGIN) env.CSP_COLLECTOR_ORIGIN = `http://localhost:${env.CSP_PORT}`;
if (!env.PLAYWRIGHT_SKIP_BUILD) env.PLAYWRIGHT_SKIP_BUILD = '1';

const previewProcess = spawn(process.execPath, [resolve(projectRoot, 'scripts/preview-csp.mjs')], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

const waitForReady = async (url, attempts = 40, intervalMs = 500) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
  } catch {
      // ignore until timeout
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const collectorHealthUrl = `${env.CSP_COLLECTOR_ORIGIN.replace(/\/$/, '')}${env.CSP_PREFIX}/health`;
const previewHealthUrl = `${env.CSP_PREVIEW_ORIGIN.replace(/\/$/, '')}/__health`;

const teardown = (signal = 'SIGTERM') => {
  if (previewProcess.exitCode === null && !previewProcess.killed) {
    previewProcess.kill(signal);
  }
};

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
  process.on(signal, () => {
    teardown(signal);
  });
});

try {
  await waitForReady(previewHealthUrl);
  await waitForReady(collectorHealthUrl);
} catch (error) {
  teardown();
  console.error('[CSP] readiness check failed:', error);
  process.exit(1);
}

if (previewProcess.exitCode !== null) {
  console.error('[CSP] preview process exited before tests could start');
  process.exit(previewProcess.exitCode || 1);
}

const playwrightBin = process.platform === 'win32'
  ? resolve(projectRoot, 'node_modules/.bin/playwright.cmd')
  : resolve(projectRoot, 'node_modules/.bin/playwright');

const extraArgs = process.argv.slice(2);
const args = ['test', 'tests/e2e/csp.guard.spec.ts', '--reporter=line', ...extraArgs];

let testProcess;

previewProcess.on('exit', (code, signal) => {
  if (testProcess && testProcess.exitCode === null) {
    console.error(`[CSP] preview process exited during tests (${code ?? signal ?? 'unknown'})`);
    testProcess.kill('SIGTERM');
  }
});

testProcess = spawn(playwrightBin, args, {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

const [code] = await once(testProcess, 'exit');

teardown();
await once(previewProcess, 'exit').catch(() => {});

process.exit(code ?? 0);
