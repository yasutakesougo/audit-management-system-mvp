// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function runAudit(scenario: string) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'index-audit-test-'));
  try {
    const result = spawnSync(process.execPath, [
      path.join(root, 'node_modules/tsx/dist/cli.mjs'),
      '--tsconfig', path.join(root, 'tsconfig.json'),
      '--import', path.join(root, 'tests/unit/fixtures/indexAuditFetchStub.mjs'),
      path.join(root, 'scripts/ops/index-audit.ts'),
      '--json',
    ], {
      cwd,
      encoding: 'utf8',
      timeout: 15000,
      env: {
        PATH: process.env.PATH,
        SP_TOKEN: 'synthetic-audit-token',
        VITE_SP_RESOURCE: 'https://audit-fixture.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Test',
        VITE_MSAL_CLIENT_ID: 'synthetic-client-id',
        VITE_MSAL_TENANT_ID: 'synthetic-tenant-id',
        INDEX_AUDIT_TEST_SCENARIO: scenario,
      },
    });
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    const report = scenario === 'network' ? undefined : JSON.parse(
      readFileSync(path.join(cwd, 'docs/nightly-patrol/index-pressure.json'), 'utf8'),
    ) as { results: Array<{ status: string }> } | undefined;
    return { status: result.status, output, report };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('Index Audit CLI gate', () => {
  it('succeeds when required indexes are returned from the configured site', () => {
    const result = runAudit('indexed');
    expect(result.output).not.toContain('Configuration error');
    expect(result.status).toBe(0);
    expect(result.report?.results.length).toBeGreaterThan(0);
    expect(result.report?.results.every(item => item.status === 'indexed')).toBe(true);
  });

  it('fails when required indexes are missing', () => {
    const result = runAudit('missing');
    expect(result.report?.results.some(item => item.status === 'missing_index')).toBe(true);
    expect(result.status).toBe(1);
  });

  it('fails when SharePoint rejects the index read', () => {
    const result = runAudit('denied');
    expect(result.output).toContain('403');
    expect(result.status).toBe(1);
  });

  it('fails when the audit cannot complete its HTTP request', () => {
    const result = runAudit('network');
    expect(result.output).toContain('Synthetic network failure');
    expect(result.status).toBe(1);
  });
});
