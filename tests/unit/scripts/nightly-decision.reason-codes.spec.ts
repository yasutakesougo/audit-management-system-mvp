import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');
const SCRIPT = path.join(ROOT, 'scripts/ops/nightly-decision.mjs');

const tempDirs: string[] = [];

function mkTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'nightly-decision-'));
  tempDirs.push(dir);
  return dir;
}

function writeRequiredInputs(date: string, overall: 'stable' | 'monitor' | 'needs-review' = 'stable') {
  writeFileSync(
    path.join(REPORT_DIR, `${date}.json`),
    JSON.stringify({ version: 1, date, gates: { unitTest: { pass: true }, typeCheck: { pass: true } } }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(REPORT_DIR, `classification-${date}.json`),
    JSON.stringify({ version: 1, date, overall, classifications: [], actions: [] }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(REPORT_DIR, `dashboard-${date}.md`),
    `# dashboard\n\nscore: 88 / 100 (Grade A)\n`,
    'utf8',
  );
}

function cleanupDateArtifacts(date: string) {
  const files = [
    path.join(REPORT_DIR, `${date}.json`),
    path.join(REPORT_DIR, `classification-${date}.json`),
    path.join(REPORT_DIR, `dashboard-${date}.md`),
    path.join(REPORT_DIR, `decision-${date}.json`),
    path.join(REPORT_DIR, `decision-${date}.md`),
  ];
  for (const file of files) {
    try {
      unlinkSync(file);
    } catch {
      // noop
    }
  }
}

function runDecision(date: string, env: Record<string, string>) {
  execFileSync('node', [SCRIPT, '--date', date], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('nightly-decision reason codes', () => {
  it('admin/exception 起因の reason code を出力する', () => {
    const date = '2099-12-25';
    const dir = mkTmpDir();
    const logPath = path.join(dir, 'nightly.log');
    const adminSummaryPath = path.join(dir, 'admin-summary.json');
    const exceptionSummaryPath = path.join(dir, 'exception-summary.json');

    writeRequiredInputs(date, 'monitor');
    writeFileSync(logPath, '', 'utf8');
    writeFileSync(adminSummaryPath, JSON.stringify({
      overall: 'fail',
      failCount: 1,
      warnCount: 0,
      missingInput: false,
    }), 'utf8');
    writeFileSync(exceptionSummaryPath, JSON.stringify({
      highSeverityCount: 2,
      overdueCount: 1,
      staleExceptionCount: 0,
      recurringExceptionCount: 0,
      missingInput: false,
    }), 'utf8');

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: adminSummaryPath,
        EXCEPTION_CENTER_SUMMARY_PATH: exceptionSummaryPath,
        LOG_FILE: logPath,
      });

      const result = JSON.parse(readFileSync(path.join(REPORT_DIR, `decision-${date}.json`), 'utf8')) as {
        final: { label: string };
        reasonCodes: { fail: string[]; warn: string[] };
      };

      expect(result.final.label).toBe('action_required');
      expect(result.reasonCodes.fail).toEqual(expect.arrayContaining(['ADMIN_STATUS_FAIL', 'EXCEPTION_HIGH_SEVERITY']));
      expect(result.reasonCodes.warn).toEqual(expect.arrayContaining(['PATROL_MONITOR', 'EXCEPTION_OVERDUE_PRESENT']));
    } finally {
      cleanupDateArtifacts(date);
    }
  });

  it('summary 欠損時に missing reason code を出力する', () => {
    const date = '2099-12-26';
    const dir = mkTmpDir();
    const logPath = path.join(dir, 'nightly.log');

    writeRequiredInputs(date, 'stable');
    writeFileSync(logPath, '', 'utf8');

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: path.join(dir, 'missing-admin-summary.json'),
        EXCEPTION_CENTER_SUMMARY_PATH: path.join(dir, 'missing-exception-summary.json'),
        LOG_FILE: logPath,
      });

      const result = JSON.parse(readFileSync(path.join(REPORT_DIR, `decision-${date}.json`), 'utf8')) as {
        reasonCodes: { fail: string[]; warn: string[] };
      };

      expect(result.reasonCodes.warn).toEqual(
        expect.arrayContaining(['ADMIN_STATUS_SUMMARY_MISSING', 'EXCEPTION_CENTER_SUMMARY_MISSING']),
      );
    } finally {
      cleanupDateArtifacts(date);
    }
  });
});
