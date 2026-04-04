import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');
const SCRIPT = path.join(ROOT, 'scripts/ops/nightly-apply.mjs');

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function cleanup(files: string[]) {
  for (const file of files) {
    try {
      unlinkSync(file);
    } catch {
      // noop
    }
  }
}

describe('nightly-apply reason context', () => {
  it('classification actionable が無くても fail reason code で control issue を作る', () => {
    const date = '2099-12-27';
    const classificationPath = path.join(REPORT_DIR, `classification-${date}.json`);
    const decisionPath = path.join(REPORT_DIR, `decision-${date}.json`);
    const applyPath = path.join(REPORT_DIR, `apply-results-${date}.json`);

    writeJson(classificationPath, {
      version: 1,
      date,
      overall: 'monitor',
      classifications: [],
      actions: [],
    });
    writeJson(decisionPath, {
      version: 1,
      date,
      final: { label: 'action_required', line: '🔴 Action Required（明日対応必須）' },
      reasonCodes: {
        fail: ['ADMIN_STATUS_FAIL'],
        warn: ['PATROL_MONITOR'],
      },
    });

    try {
      execFileSync('node', [SCRIPT, '--date', date], { cwd: ROOT, stdio: 'pipe' });
      const result = JSON.parse(readFileSync(applyPath, 'utf8')) as {
        summary: { processed: number };
        decision: { failCodes: string[] };
        results: Array<{ kind: string; status: string }>;
      };

      expect(result.summary.processed).toBe(1);
      expect(result.decision.failCodes).toEqual(expect.arrayContaining(['ADMIN_STATUS_FAIL']));
      expect(result.results[0]).toEqual(expect.objectContaining({ kind: 'nightly-decision-control', status: 'dry-run' }));
    } finally {
      cleanup([classificationPath, decisionPath, applyPath]);
    }
  });

  it('通常の actionable issue に decision fail/warn code を付与する', () => {
    const date = '2099-12-28';
    const classificationPath = path.join(REPORT_DIR, `classification-${date}.json`);
    const decisionPath = path.join(REPORT_DIR, `decision-${date}.json`);
    const applyPath = path.join(REPORT_DIR, `apply-results-${date}.json`);

    writeJson(classificationPath, {
      version: 1,
      date,
      overall: 'needs-review',
      classifications: [
        {
          kind: 'any-regression',
          severity: 'high',
          classification: 'needs-review',
          action: 'draft-issue',
          errorCount: 3,
          isTestOnly: false,
          affectedFiles: ['src/x.ts'],
        },
      ],
      actions: [{ kind: 'any-regression', action: 'draft-issue', priority: 'high', fileCount: 1 }],
    });
    writeJson(decisionPath, {
      version: 1,
      date,
      final: { label: 'action_required', line: '🔴 Action Required（明日対応必須）' },
      reasonCodes: {
        fail: ['EXCEPTION_HIGH_SEVERITY'],
        warn: ['EXCEPTION_OVERDUE_PRESENT'],
      },
    });

    try {
      execFileSync('node', [SCRIPT, '--date', date], { cwd: ROOT, stdio: 'pipe' });
      const result = JSON.parse(readFileSync(applyPath, 'utf8')) as {
        results: Array<{ decisionFailCodes?: string[]; decisionWarnCodes?: string[] }>;
      };

      expect(result.results).toHaveLength(1);
      expect(result.results[0].decisionFailCodes).toEqual(expect.arrayContaining(['EXCEPTION_HIGH_SEVERITY']));
      expect(result.results[0].decisionWarnCodes).toEqual(expect.arrayContaining(['EXCEPTION_OVERDUE_PRESENT']));
    } finally {
      cleanup([classificationPath, decisionPath, applyPath]);
    }
  });
});
