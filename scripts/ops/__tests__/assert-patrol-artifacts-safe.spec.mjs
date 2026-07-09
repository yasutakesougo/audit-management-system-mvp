// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { assertPatrolArtifactsSafe, findUnsafePatrolArtifacts } from '../assert-patrol-artifacts-safe.mjs';

const SCRIPT = path.join(process.cwd(), 'scripts', 'ops', 'assert-patrol-artifacts-safe.mjs');
const tmpDirs = [];

function makeReport(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patrol-artifact-scan-'));
  tmpDirs.push(dir);
  const filePath = path.join(dir, 'report.json');
  fs.writeFileSync(filePath, content, 'utf8');
  return { dir, filePath };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('assert-patrol-artifacts-safe', () => {
  it('accepts reports without credential-like material', () => {
    const { dir } = makeReport(JSON.stringify({ diagnostics: [{ code: 'sp_probe_fetch_error' }] }));
    expect(assertPatrolArtifactsSafe([dir], { token: 'not-present' })).toEqual({ scannedFiles: 1 });
  });

  it.each([
    'Authorization: Bearer secret-value',
    'Bearer secret-value',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature',
  ])('detects credential patterns without returning matched values', (content) => {
    const { dir } = makeReport(content);
    expect(findUnsafePatrolArtifacts([dir])).toHaveLength(1);
  });

  it('detects the current token even when it is not JWT-shaped', () => {
    const token = 'opaque-current-token';
    const { dir } = makeReport(`diagnostic=${token}`);
    expect(findUnsafePatrolArtifacts([dir], { token })).toHaveLength(1);
  });

  it('fails closed without printing detected secret material', () => {
    const secret = 'opaque-current-token';
    const { dir } = makeReport(`diagnostic=${secret}`);
    const result = spawnSync(process.execPath, [SCRIPT, dir], {
      env: { ...process.env, SP_TOKEN: secret },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('Credential-like material detected');
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });
});
