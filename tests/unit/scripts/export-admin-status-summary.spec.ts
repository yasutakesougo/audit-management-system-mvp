import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/ops/export-admin-status-summary.mjs');

const tempDirs: string[] = [];

function mkTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'admin-status-summary-'));
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

describe('export-admin-status-summary', () => {
  it('生レポートを要約JSONへ正規化する', () => {
    const dir = mkTmpDir();
    const inputPath = path.join(dir, 'admin-raw.json');
    const outputPath = path.join(dir, 'admin-summary.json');

    writeFileSync(inputPath, JSON.stringify({
      report: {
        generatedAt: '2026-04-04T00:00:00Z',
        overall: 'fail',
        counts: { pass: 8, warn: 2, fail: 1 },
        results: [
          {
            key: 'lists.users',
            label: 'Users_Master リスト存在確認',
            status: 'fail',
            summary: '必須リスト欠落',
            nextActions: [{ label: 'Provision再実行' }],
          },
          {
            key: 'permissions.delete',
            label: 'Delete 権限',
            status: 'warn',
            summary: 'Delete が WARN',
            nextActions: [{ label: '運用方針確認' }],
          },
        ],
      },
    }), 'utf8');

    runScript(['--date', '2099-12-21', '--input', inputPath, '--output', outputPath]);

    const result = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      overall: string;
      failCount: number;
      warnCount: number;
      criticalListNames: string[];
      nextActions: string[];
      missingInput: boolean;
    };

    expect(result.overall).toBe('fail');
    expect(result.failCount).toBe(1);
    expect(result.warnCount).toBe(2);
    expect(result.criticalListNames).toContain('Users_Master');
    expect(result.nextActions).toEqual(expect.arrayContaining(['Provision再実行', '運用方針確認']));
    expect(result.missingInput).toBe(false);
  });

  it('入力がない場合は missingInput=true で出力する', () => {
    const dir = mkTmpDir();
    const outputPath = path.join(dir, 'admin-summary-missing.json');

    runScript(['--date', '2099-12-22', '--output', outputPath]);

    const result = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      overall: string;
      failCount: number;
      warnCount: number;
      missingInput: boolean;
      source: { exists: boolean };
    };

    expect(result.source.exists).toBe(false);
    expect(result.missingInput).toBe(true);
    expect(result.overall).toBe('unknown');
    expect(result.failCount).toBe(0);
    expect(result.warnCount).toBe(0);
  });
});
