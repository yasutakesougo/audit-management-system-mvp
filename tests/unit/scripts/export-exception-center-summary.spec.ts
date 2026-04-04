import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/ops/export-exception-center-summary.mjs');

const tempDirs: string[] = [];

function mkTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'exception-center-summary-'));
  tempDirs.push(dir);
  return dir;
}

function runScript(args: string[], env: Record<string, string> = {}) {
  execFileSync('node', [SCRIPT, ...args], {
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

describe('export-exception-center-summary', () => {
  it('例外一覧を要約JSONへ正規化する', () => {
    const dir = mkTmpDir();
    const inputPath = path.join(dir, 'exception-raw.json');
    const outputPath = path.join(dir, 'exception-summary.json');

    writeFileSync(inputPath, JSON.stringify({
      items: [
        {
          id: 'a1',
          category: 'critical-handoff',
          severity: 'critical',
          title: '重要申し送り未対応',
          description: 'A',
          targetUserId: 'u1',
          updatedAt: '2026-04-03T00:00:00Z',
          actionLabel: '確認',
          actionPath: '/handoff',
        },
        {
          id: 'a2',
          category: 'overdue-plan',
          severity: 'high',
          title: '計画期限超過',
          description: 'B',
          targetUserId: 'u1',
          updatedAt: '2026-04-03T01:00:00Z',
        },
        {
          id: 'a3',
          category: 'overdue-plan',
          severity: 'high',
          title: '計画期限超過',
          description: 'B',
          targetUserId: 'u1',
          updatedAt: '2026-04-03T02:00:00Z',
        },
        {
          id: 'a4',
          category: 'missing-record',
          severity: 'medium',
          title: '未入力',
          description: 'C',
          targetUserId: 'u2',
          updatedAt: '2026-04-04T01:00:00Z',
        },
      ],
    }), 'utf8');

    runScript(['--date', '2099-12-23', '--input', inputPath, '--output', outputPath]);

    const result = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      openExceptionCount: number;
      highSeverityCount: number;
      overdueCount: number;
      recurringExceptionCount: number;
      repeatedExceptionKeys: string[];
      topActionableItems: Array<{ id: string; severity: string }>;
      missingInput: boolean;
      stats: { bySeverity: { critical: number; high: number; medium: number; low: number } };
    };

    expect(result.openExceptionCount).toBe(4);
    expect(result.highSeverityCount).toBe(3);
    expect(result.overdueCount).toBe(2);
    expect(result.recurringExceptionCount).toBe(1);
    expect(result.repeatedExceptionKeys).toContain('overdue-plan:u1:計画期限超過');
    expect(result.topActionableItems[0]).toEqual(expect.objectContaining({ id: 'a1', severity: 'critical' }));
    expect(result.stats.bySeverity).toEqual({ critical: 1, high: 2, medium: 1, low: 0 });
    expect(result.missingInput).toBe(false);
  });

  it('入力がない場合は missingInput=true で出力する', () => {
    const dir = mkTmpDir();
    const outputPath = path.join(dir, 'exception-summary-missing.json');

    runScript(['--date', '2099-12-24', '--output', outputPath]);

    const result = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      openExceptionCount: number;
      highSeverityCount: number;
      missingInput: boolean;
      source: { exists: boolean };
    };

    expect(result.source.exists).toBe(false);
    expect(result.missingInput).toBe(true);
    expect(result.openExceptionCount).toBe(0);
    expect(result.highSeverityCount).toBe(0);
  });
});
