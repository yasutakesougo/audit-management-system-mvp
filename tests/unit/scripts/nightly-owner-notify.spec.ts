import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-ignore
import { buildOwnerMessage, buildOwnerRoutes, collectOwnerActions, formatRunbookLink, runOwnerNotify } from '../../../scripts/ops/nightly-owner-notify.mjs';

const tempDirs: string[] = [];

function makeTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'owner-notify-'));
  tempDirs.push(dir);
  return dir;
}

function writeDecisionFile(filePath: string) {
  const payload = {
    date: '2026-04-22',
    final: {
      label: 'action_required',
      line: '🔴 Action Required（明日対応必須）',
    },
    runbook: {
      reasonCodeActions: {
        fail: [
          {
            code: 'PATROL_NEEDS_REVIEW',
            normalizedCode: 'PATROL_NEEDS_REVIEW',
            owner: 'Platform Owner',
            severity: 'action_required',
            firstAction: 'decision-YYYY-MM-DD.md の Fail Trigger を順に割当し、再実行を行う。',
            runbookLink: 'docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-patrol',
          },
        ],
        warn: [
          {
            code: 'ADMIN_STATUS_SUMMARY_MISSING',
            normalizedCode: 'ADMIN_STATUS_SUMMARY_MISSING',
            owner: 'Ops On-call',
            severity: 'watch',
            firstAction: 'integration-diagnose のログを開く。',
            runbookLink: 'docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-admin-status',
          },
        ],
      },
    },
  };
  writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('nightly-owner-notify', () => {
  it('groups actions by owner', () => {
    const grouped = collectOwnerActions({
      runbook: {
        reasonCodeActions: {
          fail: [
            {
              code: 'A',
              owner: 'Release Owner',
              severity: 'action_required',
              firstAction: 'A-1',
              runbookLink: '#a',
            },
          ],
          warn: [
            {
              code: 'B',
              owner: 'Ops On-call',
              severity: 'watch',
              firstAction: 'B-1',
              runbookLink: '#b',
            },
          ],
        },
      },
    }, { includeWarn: true });

    expect(Object.keys(grouped).sort()).toEqual(['Ops On-call', 'Release Owner']);
    expect(grouped['Release Owner']?.[0]?.code).toBe('A');
    expect(grouped['Ops On-call']?.[0]?.code).toBe('B');
  });

  it('resolves routes with owner webhook map and fallback', () => {
    const grouped = {
      'Release Owner': [{ code: 'A' }],
      'Platform Owner': [{ code: 'B' }],
      'Ops On-call': [{ code: 'C' }],
    } as unknown as Parameters<typeof buildOwnerRoutes>[0];

    const { deliveries, unresolvedOwners } = buildOwnerRoutes(grouped, {
      'Release Owner': 'https://hooks.example.com/release',
    }, 'https://hooks.example.com/default');

    expect(deliveries).toHaveLength(3);
    expect(unresolvedOwners).toHaveLength(0);
    expect(deliveries.find((x: any) => x.owner === 'Release Owner')?.webhook).toBe('https://hooks.example.com/release');
    expect(deliveries.find((x: any) => x.owner === 'Platform Owner')?.webhook).toBe('https://hooks.example.com/default');
  });

  it('supports dry-run without webhook calls', async () => {
    const dir = makeTmpDir();
    const decisionPath = path.join(dir, 'decision-2026-04-22.json');
    writeDecisionFile(decisionPath);

    const result = await runOwnerNotify({
      decisionPath,
      includeWarn: true,
      dryRun: true,
      strict: true,
      ownerWebhooks: {
        'Platform Owner': 'https://hooks.example.com/platform',
        'Ops On-call': 'https://hooks.example.com/ops',
      },
      ownerMentions: {
        'Platform Owner': '@platform-owner',
      },
      fallbackWebhook: '',
    });

    expect(result.sent).toBe(0);
    expect(result.deliveries).toBe(2);
    expect(result.unresolvedOwners).toEqual([]);
    expect(result.failedOwners).toEqual([]);
    expect(result.skipped).toBe(false);
  });

  it('formats notification body with bucket/severity/firstAction/runbook', () => {
    const message = buildOwnerMessage({
      owner: 'Platform Owner',
      mention: '@platform-owner',
      decision: {
        date: '2026-04-22',
        final: { label: 'action_required', line: '🔴 Action Required（明日対応必須）' },
      },
      actions: [
        {
          bucket: 'fail',
          code: 'PATROL_NEEDS_REVIEW',
          owner: 'Platform Owner',
          severity: 'action_required',
          firstAction: 'decision-YYYY-MM-DD.md の Fail Trigger を順に割当し、再実行を行う。',
          runbookLink: 'docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-patrol',
        },
      ],
      repoOptions: {
        serverUrl: 'https://github.com',
        repository: 'example/repo',
        refName: 'main',
      },
    });

    expect(message).toContain('### Action 1/1');
    expect(message).toContain('- Bucket: 🔴 fail');
    expect(message).toContain('- Severity: 🔴 action_required');
    expect(message).toContain('- First Action: decision-YYYY-MM-DD.md の Fail Trigger を順に割当し、再実行を行う。');
    expect(message).toContain('- Runbook: https://github.com/example/repo/blob/main/docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-patrol');
  });

  it('expands relative runbook link into github blob url', () => {
    const runbookUrl = formatRunbookLink('docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-patrol', {
      serverUrl: 'https://github.com',
      repository: 'example/repo',
      refName: 'release',
    });
    expect(runbookUrl).toBe('https://github.com/example/repo/blob/release/docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-patrol');
  });
});
