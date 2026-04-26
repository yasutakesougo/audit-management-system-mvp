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
  const tmpDir = mkTmpDir();
  const emptyJson = path.join(tmpDir, 'empty.json');
  writeFileSync(emptyJson, JSON.stringify({}), 'utf8');

  execFileSync('node', [SCRIPT, '--date', date], {
    cwd: ROOT,
    env: {
      ...process.env,
      CONTRACT_DRIFT_SUMMARY_PATH: emptyJson,
      DRIFT_LEDGER_SUMMARY_PATH: emptyJson,
      ...env,
    },
    stdio: 'pipe',
  });
}

function writeDecisionSnapshot(date: string, options: { label: string; warnCodes?: string[]; failCodes?: string[] }) {
  writeFileSync(
    path.join(REPORT_DIR, `decision-${date}.json`),
    JSON.stringify({
      version: 1,
      date,
      final: {
        label: options.label,
        line: options.label,
      },
      reasonCodes: {
        fail: options.failCodes ?? [],
        warn: options.warnCodes ?? [],
      },
    }, null, 2),
    'utf8',
  );
}

function readDecision(date: string) {
  return JSON.parse(readFileSync(path.join(REPORT_DIR, `decision-${date}.json`), 'utf8')) as {
    final: { label: string };
    reasonCodes: { fail: string[]; warn: string[] };
    escalations?: Array<{ type: string; days: number; code: string }>;
    runbook?: {
      reasonCodeActions?: {
        fail?: Array<{
          code: string;
          owner: string;
          severity: 'watch' | 'action_required' | 'blocked';
          firstAction: string;
          runbookLink: string | null;
        }>;
        warn?: Array<{
          code: string;
          owner: string;
          severity: 'watch' | 'action_required' | 'blocked';
          firstAction: string;
          runbookLink: string | null;
        }>;
      };
    };
  };
}

function assertReasonCodeActions(result: ReturnType<typeof readDecision>) {
  const verifyBucket = (
    bucket: 'fail' | 'warn',
    codes: string[],
    actions: Array<{
      code: string;
      owner: string;
      severity: 'watch' | 'action_required' | 'blocked';
      firstAction: string;
      runbookLink: string | null;
    }> | undefined,
  ) => {
    const safeActions = actions ?? [];
    expect(safeActions.length).toBe(codes.length);

    for (const code of codes) {
      const action = safeActions.find((entry) => entry.code === code);
      expect(action, `${bucket} bucket missing action metadata for ${code}`).toBeDefined();
      expect(action?.owner?.trim().length).toBeGreaterThan(0);
      expect(action?.severity).toMatch(/^(watch|action_required|blocked)$/);
      expect(action?.firstAction?.trim().length).toBeGreaterThan(0);
      expect(action?.runbookLink).toBeTruthy();
      expect(action?.runbookLink).toContain('PRODUCTION-GO-LIVE.md#rc-');
    }
  };

  verifyBucket('fail', result.reasonCodes.fail, result.runbook?.reasonCodeActions?.fail);
  verifyBucket('warn', result.reasonCodes.warn, result.runbook?.reasonCodeActions?.warn);
}

function cleanupDates(dates: string[]) {
  for (const date of dates) {
    cleanupDateArtifacts(date);
  }
}

function writeSummaryFiles(
  dir: string,
  options: {
    adminOverall?: string;
    adminFailCount?: number;
    adminWarnCount?: number;
    exceptionHighSeverityCount?: number;
    exceptionOverdueCount?: number;
    exceptionStaleCount?: number;
    exceptionRecurringCount?: number;
  } = {},
) {
  const logPath = path.join(dir, 'nightly.log');
  const adminSummaryPath = path.join(dir, 'admin-summary.json');
  const exceptionSummaryPath = path.join(dir, 'exception-summary.json');

  writeFileSync(logPath, '', 'utf8');
  writeFileSync(adminSummaryPath, JSON.stringify({
    overall: options.adminOverall ?? 'pass',
    failCount: options.adminFailCount ?? 0,
    warnCount: options.adminWarnCount ?? 0,
    missingInput: false,
  }), 'utf8');
  writeFileSync(exceptionSummaryPath, JSON.stringify({
    highSeverityCount: options.exceptionHighSeverityCount ?? 0,
    overdueCount: options.exceptionOverdueCount ?? 0,
    staleExceptionCount: options.exceptionStaleCount ?? 0,
    recurringExceptionCount: options.exceptionRecurringCount ?? 0,
    missingInput: false,
  }), 'utf8');

  return {
    logPath,
    adminSummaryPath,
    exceptionSummaryPath,
  };
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
        runbook?: {
          reasonCodeActions?: {
            fail?: Array<{
              code: string;
              owner: string;
              severity: 'watch' | 'action_required' | 'blocked';
              firstAction: string;
              runbookLink: string | null;
            }>;
            warn?: Array<{
              code: string;
              owner: string;
              severity: 'watch' | 'action_required' | 'blocked';
              firstAction: string;
              runbookLink: string | null;
            }>;
          };
        };
      };

      expect(result.final.label).toBe('action_required');
      expect(result.reasonCodes.fail).toEqual(expect.arrayContaining(['ADMIN_STATUS_FAIL', 'EXCEPTION_HIGH_SEVERITY']));
      expect(result.reasonCodes.warn).toEqual(expect.arrayContaining(['PATROL_MONITOR', 'EXCEPTION_OVERDUE_PRESENT']));
      assertReasonCodeActions(result as ReturnType<typeof readDecision>);
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
        runbook?: {
          reasonCodeActions?: {
            fail?: Array<{
              code: string;
              owner: string;
              severity: 'watch' | 'action_required' | 'blocked';
              firstAction: string;
              runbookLink: string | null;
            }>;
            warn?: Array<{
              code: string;
              owner: string;
              severity: 'watch' | 'action_required' | 'blocked';
              firstAction: string;
              runbookLink: string | null;
            }>;
          };
        };
      };

      expect(result.reasonCodes.warn).toEqual(
        expect.arrayContaining(['ADMIN_STATUS_SUMMARY_MISSING', 'EXCEPTION_CENTER_SUMMARY_MISSING']),
      );
      assertReasonCodeActions(result as ReturnType<typeof readDecision>);
    } finally {
      cleanupDateArtifacts(date);
    }
  });

  it('同一 warn code が3日連続なら Action Required に昇格する', () => {
    const date = '2099-12-29';
    const prev1 = '2099-12-28';
    const prev2 = '2099-12-27';
    const dir = mkTmpDir();
    const files = writeSummaryFiles(dir, {
      exceptionOverdueCount: 1,
    });

    writeRequiredInputs(date, 'stable');
    writeDecisionSnapshot(prev1, { label: 'watch', warnCodes: ['EXCEPTION_OVERDUE_PRESENT'] });
    writeDecisionSnapshot(prev2, { label: 'watch', warnCodes: ['EXCEPTION_OVERDUE_PRESENT'] });

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: files.adminSummaryPath,
        EXCEPTION_CENTER_SUMMARY_PATH: files.exceptionSummaryPath,
        LOG_FILE: files.logPath,
      });

      const result = readDecision(date);
      expect(result.final.label).toBe('action_required');
      expect(result.reasonCodes.fail).toEqual(expect.arrayContaining(['WATCH_STREAK_3D::EXCEPTION_OVERDUE_PRESENT']));
      expect(result.escalations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'watch_streak',
          days: 3,
          code: 'EXCEPTION_OVERDUE_PRESENT',
        }),
      ]));
      assertReasonCodeActions(result);
    } finally {
      cleanupDates([date, prev1, prev2]);
    }
  });

  it('2日連続だけでは昇格しない', () => {
    const date = '2099-12-31';
    const prev1 = '2099-12-30';
    const dir = mkTmpDir();
    const files = writeSummaryFiles(dir, {
      exceptionOverdueCount: 1,
    });

    writeRequiredInputs(date, 'stable');
    writeDecisionSnapshot(prev1, { label: 'watch', warnCodes: ['EXCEPTION_OVERDUE_PRESENT'] });

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: files.adminSummaryPath,
        EXCEPTION_CENTER_SUMMARY_PATH: files.exceptionSummaryPath,
        LOG_FILE: files.logPath,
      });

      const result = readDecision(date);
      expect(result.final.label).toBe('watch');
      expect(result.reasonCodes.fail).not.toEqual(expect.arrayContaining(['WATCH_STREAK_3D::EXCEPTION_OVERDUE_PRESENT']));
      expect(result.escalations ?? []).toHaveLength(0);
      assertReasonCodeActions(result);
    } finally {
      cleanupDates([date, prev1]);
    }
  });

  it('3日分のうち途中1日が欠損している場合は昇格しない', () => {
    const date = '2100-01-03';
    const prev2 = '2100-01-01';
    const dir = mkTmpDir();
    const files = writeSummaryFiles(dir, {
      exceptionOverdueCount: 1,
    });

    writeRequiredInputs(date, 'stable');
    writeDecisionSnapshot(prev2, { label: 'watch', warnCodes: ['EXCEPTION_OVERDUE_PRESENT'] });

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: files.adminSummaryPath,
        EXCEPTION_CENTER_SUMMARY_PATH: files.exceptionSummaryPath,
        LOG_FILE: files.logPath,
      });

      const result = readDecision(date);
      expect(result.final.label).toBe('watch');
      expect(result.reasonCodes.fail).not.toEqual(expect.arrayContaining(['WATCH_STREAK_3D::EXCEPTION_OVERDUE_PRESENT']));
      expect(result.escalations ?? []).toHaveLength(0);
      assertReasonCodeActions(result);
    } finally {
      cleanupDates([date, prev2]);
    }
  });

  it('毎日 Watch でも reason code が異なれば昇格しない', () => {
    const date = '2100-01-06';
    const prev1 = '2100-01-05';
    const prev2 = '2100-01-04';
    const dir = mkTmpDir();
    const files = writeSummaryFiles(dir, {
      exceptionOverdueCount: 1,
    });

    writeRequiredInputs(date, 'stable');
    writeDecisionSnapshot(prev1, { label: 'watch', warnCodes: ['EXCEPTION_CENTER_SUMMARY_MISSING'] });
    writeDecisionSnapshot(prev2, { label: 'watch', warnCodes: ['ADMIN_STATUS_SUMMARY_MISSING'] });

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: files.adminSummaryPath,
        EXCEPTION_CENTER_SUMMARY_PATH: files.exceptionSummaryPath,
        LOG_FILE: files.logPath,
      });

      const result = readDecision(date);
      expect(result.final.label).toBe('watch');
      expect(result.reasonCodes.fail).not.toEqual(expect.arrayContaining(['WATCH_STREAK_3D::EXCEPTION_OVERDUE_PRESENT']));
      expect(result.escalations ?? []).toHaveLength(0);
      assertReasonCodeActions(result);
    } finally {
      cleanupDates([date, prev1, prev2]);
    }
  });

  it('当日が既に Action Required の場合でも判定は壊れない', () => {
    const date = '2100-01-09';
    const prev1 = '2100-01-08';
    const prev2 = '2100-01-07';
    const dir = mkTmpDir();
    const files = writeSummaryFiles(dir, {
      adminOverall: 'fail',
      adminFailCount: 1,
      exceptionOverdueCount: 1,
    });

    writeRequiredInputs(date, 'stable');
    writeDecisionSnapshot(prev1, { label: 'watch', warnCodes: ['EXCEPTION_OVERDUE_PRESENT'] });
    writeDecisionSnapshot(prev2, { label: 'watch', warnCodes: ['EXCEPTION_OVERDUE_PRESENT'] });

    try {
      runDecision(date, {
        ADMIN_STATUS_SUMMARY_PATH: files.adminSummaryPath,
        EXCEPTION_CENTER_SUMMARY_PATH: files.exceptionSummaryPath,
        LOG_FILE: files.logPath,
      });

      const result = readDecision(date);
      expect(result.final.label).toBe('action_required');
      expect(result.reasonCodes.fail).toEqual(expect.arrayContaining(['ADMIN_STATUS_FAIL']));
      expect(result.reasonCodes.fail).not.toEqual(expect.arrayContaining(['WATCH_STREAK_3D::EXCEPTION_OVERDUE_PRESENT']));
      expect(result.escalations ?? []).toHaveLength(0);
      assertReasonCodeActions(result);
    } finally {
      cleanupDates([date, prev1, prev2]);
    }
  });
});
