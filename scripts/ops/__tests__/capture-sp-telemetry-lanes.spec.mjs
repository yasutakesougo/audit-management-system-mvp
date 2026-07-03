// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureAndWriteSpTelemetryLanes } from '../capture-sp-telemetry-lanes.mjs';

const ROOT = process.cwd();
const ASSERT_SCRIPT = path.join(ROOT, 'scripts', 'ops', 'assert-telemetry-lanes.mjs');

const BASE_ENV = {
  SP_TOKEN: 'test-token',
  VITE_SP_RESOURCE: 'https://tenant.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/Audit',
};

const tmpDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-telemetry-lanes-'));
  tmpDirs.push(dir);
  return dir;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runAssert(cwd, telemetryPath) {
  return spawnSync(process.execPath, [ASSERT_SCRIPT], {
    cwd,
    env: {
      ...process.env,
      SP_TELEMETRY_PATH: telemetryPath,
      CI_STRICT: 'true',
      CI_READ_QUEUE_THRESHOLD: '1000',
    },
    encoding: 'utf8',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('capture-sp-telemetry-lanes', () => {
  it('writes assert-compatible lane JSON for a successful read probe', async () => {
    const cwd = makeTempDir();
    const outputPath = path.join(cwd, 'docs/nightly-patrol/sp-telemetry.json');
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ Id: 1, Title: 'CI User' }), { status: 200 }));

    const { snapshot } = await captureAndWriteSpTelemetryLanes({
      env: BASE_ENV,
      fetchImpl,
      outputPath,
      now: () => new Date('2026-07-03T00:00:00.000Z'),
    });

    const written = readJson(outputPath);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(snapshot.source.kind).toBe('nightly-patrol-sp-token-read-probe');
    expect(written.metrics.lanes.read.requests).toBe(1);
    expect(written.metrics.lanes.read.failed).toBe(0);
    expect(written.metrics.lanes.write.requests).toBe(0);
    expect(written.metrics.lanes.provisioning.requests).toBe(0);
    expect(written.summary.lanes.read.requests).toBe(1);

    const assertResult = runAssert(cwd, outputPath);
    expect(assertResult.status).toBe(0);
    expect(assertResult.stdout).toContain('Lane assertion passed');
  });

  it.each([
    {
      name: 'missing SP_TOKEN',
      env: { VITE_SP_RESOURCE: BASE_ENV.VITE_SP_RESOURCE, VITE_SP_SITE_RELATIVE: BASE_ENV.VITE_SP_SITE_RELATIVE },
      fetchImpl: vi.fn(),
      code: 'sp_token_missing',
    },
    {
      name: 'HTTP non-OK',
      env: BASE_ENV,
      fetchImpl: vi.fn(async () => new Response('forbidden', { status: 500 })),
      code: 'sp_probe_http_non_ok',
    },
    {
      name: 'fetch error',
      env: BASE_ENV,
      fetchImpl: vi.fn(async () => {
        throw new Error('network unavailable');
      }),
      code: 'sp_probe_fetch_error',
    },
  ])('writes failed read lane JSON for $name', async ({ env, fetchImpl, code }) => {
    const cwd = makeTempDir();
    const outputPath = path.join(cwd, 'docs/nightly-patrol/sp-telemetry.json');

    await captureAndWriteSpTelemetryLanes({
      env,
      fetchImpl,
      outputPath,
      now: () => new Date('2026-07-03T00:00:00.000Z'),
    });

    const written = readJson(outputPath);
    expect(written.metrics.lanes.read.failed).toBeGreaterThan(0);
    expect(written.diagnostics.map((entry) => entry.code)).toContain(code);

    const assertResult = runAssert(cwd, outputPath);
    expect(assertResult.status).toBe(1);
    expect(assertResult.stderr).toContain('[READ LANE] Failures detected');
    expect(assertResult.stderr).not.toContain('SP_TELEMETRY_PATH is required in strict mode');
    expect(assertResult.stderr).not.toContain('Telemetry file missing in strict mode');
  });
});
