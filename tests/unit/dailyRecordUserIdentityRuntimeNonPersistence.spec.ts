import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-ignore -- the production runtime is intentionally plain ESM and is verified behaviorally here.
import {
  RuntimeGuardError,
  assertGetOnlyMethod,
  assertSafeFieldProjection,
  createGetOnlyTransport,
  createSafeAggregate,
  createSafeReporter,
  runSnapshotPhase,
} from '../../scripts/ops/daily-record-user-identity-reconciliation/runtime-non-persistence-core.mjs';
// @ts-ignore -- the production runner is intentionally plain ESM and is verified behaviorally here.
import {
  main,
  productionReadEnabled,
} from '../../scripts/ops/daily-record-user-identity-reconciliation/runtime-non-persistence-runner.mjs';

const CANARY_USER_ID = 'SYNTH-USER-CANARY-991';
const CANARY_ROW_KEY = '2099-12-31-SYNTH-USER-CANARY-991-procedure-17';
const CANARY_OBSERVATION = 'SYNTH-OBSERVATION-MUST-NOT-LEAK';

describe('DAILY-RECORD-USER-IDENTITY-RECONCILIATION-V1 runtime non-persistence', () => {
  it('blocks production reads by default before fetch is called', async () => {
    const fetchImpl = vi.fn();
    const output: string[] = [];

    expect(productionReadEnabled({})).toBe(false);

    const code = await main({
      env: {},
      fetchImpl,
      writeLine: (line: string) => output.push(line),
    });

    expect(code).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(output.join('')).toContain('"runtimeErrorCode":"LIVE_READ_DISABLED"');
  });

  it('blocks every non-GET method', () => {
    expect(() => assertGetOnlyMethod('GET')).not.toThrow();
    for (const method of ['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE']) {
      expect(() => assertGetOnlyMethod(method)).toThrowError(RuntimeGuardError);
    }
  });

  it('blocks sensitive field projections', () => {
    expect(assertSafeFieldProjection(['Id', 'Title', 'UserID'])).toEqual(['Id', 'Title', 'UserID']);
    for (const field of ['Observation', 'Memo', 'FullName', 'DisplayName', 'Email', 'Address']) {
      expect(() => assertSafeFieldProjection(['Id', field])).toThrowError(RuntimeGuardError);
    }
  });

  it('uses GET only and never surfaces raw error bodies', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('GET');
      return {
        ok: false,
        status: 500,
        async json() {
          return { secret: CANARY_OBSERVATION };
        },
      };
    });

    const transport = createGetOnlyTransport({
      fetchImpl,
      siteUrl: 'https://example.sharepoint.com/sites/welfare',
      accessToken: 'synthetic-token',
    });

    let errorText = '';
    try {
      await transport.getJson("/_api/web/lists/getbytitle('DailyRecordRows')?$select=Id");
    } catch (error) {
      errorText = String(error);
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(errorText).toContain('SHAREPOINT_READ_FAILED');
    expect(errorText).not.toContain(CANARY_OBSERVATION);
  });

  it('reports only the fixed aggregate schema', () => {
    const output: string[] = [];
    const reporter = createSafeReporter({
      writeLine: (line: string) => output.push(line),
    });

    reporter.report(createSafeAggregate({
      runtimeStatus: 'READY',
      runCoverage: 'INCOMPLETE',
      dailySnapshotStable: true,
      masterSnapshotStable: true,
      masterCanonicalIntegrity: 'PASS',
      reconciliation: 'HOLD',
      counts: {
        dailyStable: 4,
        masterStable: 3,
      },
    }));

    const text = output.join('');
    expect(text).toContain('"dailyStable":4');
    expect(text).not.toContain(CANARY_USER_ID);
    expect(text).not.toContain(CANARY_ROW_KEY);
    expect(text).not.toContain(CANARY_OBSERVATION);
  });

  it('keeps synthetic row identities in memory and returns counts only', async () => {
    const queue = [
      { Id: '{11111111-1111-1111-1111-111111111111}', ItemCount: 2 },
      { Id: '{22222222-2222-2222-2222-222222222222}', ItemCount: 2 },
      { value: [{ Id: 2 }] },
      { value: [{ Id: 2 }] },
      {
        value: [
          { Id: 1, Title: CANARY_ROW_KEY, UserField: CANARY_USER_ID, Created: 'x', Modified: 'm1' },
          { Id: 2, Title: 'synthetic-row-2', UserField: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
        ],
      },
      {
        value: [
          { Id: 1, Title: CANARY_ROW_KEY, UserField: CANARY_USER_ID, Created: 'x', Modified: 'm1' },
          { Id: 2, Title: 'synthetic-row-2', UserField: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
        ],
      },
      {
        value: [
          { Id: 1, UserID: CANARY_USER_ID, Created: 'x', Modified: 'm1' },
          { Id: 2, UserID: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
        ],
      },
      {
        value: [
          { Id: 1, UserID: CANARY_USER_ID, Created: 'x', Modified: 'm1' },
          { Id: 2, UserID: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
        ],
      },
    ];

    const transport = {
      getJson: vi.fn(async () => {
        const next = queue.shift();
        if (!next) throw new Error('unexpected read');
        return next;
      }),
    };

    const aggregate = await runSnapshotPhase({
      transport,
      config: {
        dailyListTitle: 'DailyRecordRows',
        masterListTitle: 'Users_Master',
        expectedDailyListGuid: '11111111-1111-1111-1111-111111111111',
        expectedMasterListGuid: '22222222-2222-2222-2222-222222222222',
        dailyFields: ['Id', 'Title', 'UserField', 'Created', 'Modified'],
        masterFields: ['Id', 'UserID', 'Created', 'Modified'],
        masterUserIdField: 'UserID',
      },
    });

    const serialized = JSON.stringify(aggregate);
    expect(aggregate.runtimeStatus).toBe('READY');
    expect(aggregate.dailySnapshotStable).toBe(true);
    expect(aggregate.masterSnapshotStable).toBe(true);
    expect(aggregate.counts.dailyStable).toBe(2);
    expect(aggregate.counts.masterStable).toBe(2);
    expect(serialized).not.toContain(CANARY_USER_ID);
    expect(serialized).not.toContain(CANARY_ROW_KEY);
    expect(serialized).not.toContain(CANARY_OBSERVATION);
  });

  it('runtime source imports no persistence API and has no direct console logger', () => {
    const corePath = fileURLToPath(new URL(
      '../../scripts/ops/daily-record-user-identity-reconciliation/runtime-non-persistence-core.mjs',
      import.meta.url,
    ));
    const runnerPath = fileURLToPath(new URL(
      '../../scripts/ops/daily-record-user-identity-reconciliation/runtime-non-persistence-runner.mjs',
      import.meta.url,
    ));

    const source = `${readFileSync(corePath, 'utf8')}\n${readFileSync(runnerPath, 'utf8')}`;
    for (const forbidden of [
      'node:fs',
      'writeFile',
      'appendFile',
      'createWriteStream',
      '.token.local',
      'console.log',
      'console.error',
      'console.warn',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
