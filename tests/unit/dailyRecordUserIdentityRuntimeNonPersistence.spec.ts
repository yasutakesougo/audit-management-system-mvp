import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore -- production runtime is intentionally plain ESM and verified behaviorally here.
import {
  RuntimeGuardError,
  assertDiagnosticSafe,
  assertExactFieldAllowlist,
  assertGetOnlyMethod,
  assertSafeFieldProjection,
  createGetOnlyTransport,
  createSafeAggregate,
  createSafeReporter,
  runSnapshotPhase,
} from '../../scripts/ops/daily-record-user-identity-reconciliation/runtime-non-persistence-core.mjs';
// @ts-ignore -- production runner is intentionally plain ESM and verified behaviorally here.
import {
  buildRuntimeConfig,
  main,
  productionReadEnabled,
} from '../../scripts/ops/daily-record-user-identity-reconciliation/runtime-non-persistence-runner.mjs';

const CANARY_USER_ID = 'SYNTH-USER-CANARY-991';
const CANARY_ROW_KEY = '2099-12-31-SYNTH-USER-CANARY-991-procedure-17';
const CANARY_OBSERVATION = 'SYNTH-OBSERVATION-MUST-NOT-LEAK';
const CANARY_TOKEN = 'SYNTH-TOKEN-MUST-NOT-LEAK';
const DAILY_GUID = '11111111-1111-1111-1111-111111111111';
const MASTER_GUID = '22222222-2222-2222-2222-222222222222';

function stableEnv(overrides: Record<string, string> = {}) {
  return {
    DRUIR_ENABLE_PRODUCTION_READ: 'GO',
    DRUIR_SITE_URL: 'https://example.sharepoint.com/sites/welfare',
    DRUIR_DAILY_LIST_TITLE: 'SyntheticDailyRows',
    DRUIR_MASTER_LIST_TITLE: 'SyntheticUsersMaster',
    DRUIR_SP_ACCESS_TOKEN: CANARY_TOKEN,
    DRUIR_EXPECTED_DAILY_LIST_GUID: DAILY_GUID,
    DRUIR_EXPECTED_MASTER_LIST_GUID: MASTER_GUID,
    DRUIR_DAILY_USER_FIELD: 'UserField',
    DRUIR_MASTER_USERID_FIELD: 'UserID',
    ...overrides,
  };
}

function payloadForUrl(rawUrl: string) {
  const url = decodeURIComponent(rawUrl);
  const isDaily = url.includes("getbytitle('SyntheticDailyRows')");
  const isMaster = url.includes("getbytitle('SyntheticUsersMaster')");

  if (url.includes('$select=Id,ItemCount')) {
    if (isDaily) return { Id: `{${DAILY_GUID}}`, ItemCount: 2 };
    if (isMaster) return { Id: `{${MASTER_GUID}}`, ItemCount: 2 };
  }
  if (url.includes('$orderby=Id desc')) return { value: [{ Id: 2 }] };
  if (url.includes('/items?')) {
    if (isDaily) {
      return {
        value: [
          { Id: 1, Title: CANARY_ROW_KEY, UserField: CANARY_USER_ID, Created: 'x', Modified: 'm1' },
          { Id: 2, Title: 'synthetic-row-2', UserField: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
        ],
      };
    }
    if (isMaster) {
      return {
        value: [
          { Id: 1, UserID: CANARY_USER_ID, Created: 'x', Modified: 'm1' },
          { Id: 2, UserID: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
        ],
      };
    }
  }
  throw new Error('unexpected synthetic URL');
}

function createStableFetch() {
  return vi.fn(async (url: string, init: RequestInit) => {
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
    return {
      ok: true,
      status: 200,
      async json() {
        return payloadForUrl(url);
      },
    };
  });
}

describe('DAILY-RECORD-USER-IDENTITY-RECONCILIATION-V1 runtime non-persistence', () => {
  it('blocks production reads by default before fetch is called', async () => {
    const fetchImpl = vi.fn();
    const output: string[] = [];

    expect(productionReadEnabled({})).toBe(false);

    const code = await main({
      env: {},
      fetchImpl,
      writeLine: (line: string) => output.push(line),
      execArgv: [],
      nodeOptions: '',
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

  it('enforces a real field allowlist and blocks sensitive semantic slots', () => {
    expect(assertSafeFieldProjection(['Id', 'Title', 'UserID'])).toEqual(['Id', 'Title', 'UserID']);
    expect(() => assertExactFieldAllowlist(
      ['Id', 'Title', 'UnexpectedBusinessField'],
      ['Id', 'Title'],
    )).toThrowError(RuntimeGuardError);

    expect(() => buildRuntimeConfig(stableEnv({
      DRUIR_DAILY_USER_FIELD: 'Observation',
    }))).toThrowError(RuntimeGuardError);
  });

  it('blocks diagnostic/debug/profile modes before production fetch', async () => {
    for (const arg of ['--inspect', '--inspect-brk=0', '--cpu-prof', '--heap-prof', '--report-on-fatalerror']) {
      expect(() => assertDiagnosticSafe({ execArgv: [arg], nodeOptions: '', env: {} }))
        .toThrowError(RuntimeGuardError);
    }

    const fetchImpl = vi.fn();
    const output: string[] = [];
    const code = await main({
      env: stableEnv(),
      fetchImpl,
      writeLine: (line: string) => output.push(line),
      execArgv: ['--inspect'],
      nodeOptions: '',
    });
    expect(code).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(output.join('')).toContain('DIAGNOSTIC_MODE_BLOCKED');
  });

  it('uses GET/manual redirect and never surfaces raw error bodies or tokens', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('GET');
      expect(init.redirect).toBe('manual');
      expect(String((init.headers as Record<string, string>).Authorization)).toContain(CANARY_TOKEN);
      return {
        ok: false,
        status: 500,
        async json() {
          return { secret: CANARY_OBSERVATION };
        },
      };
    });

    const output: string[] = [];
    const code = await main({
      env: stableEnv(),
      fetchImpl,
      writeLine: (line: string) => output.push(line),
      execArgv: [],
      nodeOptions: '',
    });

    const text = output.join('');
    expect(code).toBe(2);
    expect(text).toContain('SHAREPOINT_READ_FAILED');
    expect(text).not.toContain(CANARY_OBSERVATION);
    expect(text).not.toContain(CANARY_TOKEN);
  });

  it('blocks HTTP redirects instead of following them', async () => {
    const transport = createGetOnlyTransport({
      fetchImpl: vi.fn(async () => ({
        ok: false,
        status: 302,
        async json() { return {}; },
      })),
      siteUrl: 'https://example.sharepoint.com/sites/welfare',
      accessToken: CANARY_TOKEN,
    });

    await expect(transport.getJson("/_api/web/lists/getbytitle('SyntheticDailyRows')?$select=Id"))
      .rejects.toMatchObject({ code: 'REDIRECT_BLOCKED' });
  });

  it('rejects continuation URLs outside the exact list-item scope', () => {
    const transport = createGetOnlyTransport({
      fetchImpl: vi.fn(),
      siteUrl: 'https://example.sharepoint.com/sites/welfare',
      accessToken: CANARY_TOKEN,
    });
    const initial = "/_api/web/lists/getbytitle('SyntheticDailyRows')/items?$select=Id";

    expect(() => transport.validateContinuation(
      initial,
      "https://evil.example/_api/web/lists/getbytitle('SyntheticDailyRows')/items?$skiptoken=x",
    )).toThrowError(RuntimeGuardError);
    expect(() => transport.validateContinuation(
      initial,
      "https://example.sharepoint.com/sites/welfare/_api/web/lists/getbytitle('SyntheticUsersMaster')/items?$skiptoken=x",
    )).toThrowError(RuntimeGuardError);
  });

  it('reports only the fixed aggregate schema', () => {
    const output: string[] = [];
    const reporter = createSafeReporter({ writeLine: (line: string) => output.push(line) });

    reporter.report(createSafeAggregate({
      runtimeStatus: 'READY',
      runCoverage: 'INCOMPLETE',
      dailySnapshotStable: true,
      masterSnapshotStable: true,
      masterCanonicalIntegrity: 'PASS',
      reconciliation: 'HOLD',
      counts: { dailyStable: 4, masterStable: 3 },
    }));

    const text = output.join('');
    expect(text).toContain('"dailyStable":4');
    expect(text).not.toContain(CANARY_USER_ID);
    expect(text).not.toContain(CANARY_ROW_KEY);
    expect(text).not.toContain(CANARY_OBSERVATION);
  });

  it('runs Daily A -> Master A -> Daily B -> Master B and final stability checks in memory', async () => {
    const requestOrder: string[] = [];
    const fetchImpl = createStableFetch();
    fetchImpl.mockImplementation(async (url: string, init: RequestInit) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('/items?') && !decoded.includes('$orderby=Id desc')) {
        requestOrder.push(decoded.includes('SyntheticDailyRows') ? 'DAILY' : 'MASTER');
      }
      expect(init.method).toBe('GET');
      expect(init.redirect).toBe('manual');
      return { ok: true, status: 200, async json() { return payloadForUrl(url); } };
    });

    const output: string[] = [];
    const code = await main({
      env: stableEnv(),
      fetchImpl,
      writeLine: (line: string) => output.push(line),
      execArgv: [],
      nodeOptions: '',
    });

    expect(code).toBe(0);
    expect(requestOrder).toEqual(['DAILY', 'MASTER', 'DAILY', 'MASTER', 'DAILY', 'MASTER']);
    const serialized = output.join('');
    expect(serialized).toContain('"runtimeStatus":"READY"');
    expect(serialized).not.toContain(CANARY_USER_ID);
    expect(serialized).not.toContain(CANARY_ROW_KEY);
    expect(serialized).not.toContain(CANARY_TOKEN);
  });

  it('fails closed when the final bounded population changes', async () => {
    let dailyItemsRead = 0;
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.method).toBe('GET');
      const decoded = decodeURIComponent(url);
      let payload = payloadForUrl(url);
      if (decoded.includes('SyntheticDailyRows') && decoded.includes('/items?') && !decoded.includes('$orderby=Id desc')) {
        dailyItemsRead += 1;
        if (dailyItemsRead === 3) {
          payload = {
            value: [
              { Id: 1, Title: CANARY_ROW_KEY, UserField: CANARY_USER_ID, Created: 'x', Modified: 'CHANGED' },
              { Id: 2, Title: 'synthetic-row-2', UserField: 'SYNTH-USER-2', Created: 'x', Modified: 'm2' },
            ],
          };
        }
      }
      return { ok: true, status: 200, async json() { return payload; } };
    });

    const output: string[] = [];
    const code = await main({
      env: stableEnv(),
      fetchImpl,
      writeLine: (line: string) => output.push(line),
      execArgv: [],
      nodeOptions: '',
    });
    expect(code).toBe(2);
    expect(output.join('')).toContain('SNAPSHOT_UNSTABLE');
  });

  it('creates no runtime files during a synthetic live-path execution', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'druir-runtime-'));
    const previousCwd = process.cwd();
    const before = readdirSync(temp);
    try {
      process.chdir(temp);
      const output: string[] = [];
      const code = await main({
        env: stableEnv(),
        fetchImpl: createStableFetch(),
        writeLine: (line: string) => output.push(line),
        execArgv: [],
        nodeOptions: '',
      });
      expect(code).toBe(0);
      expect(readdirSync(temp)).toEqual(before);
      expect(output.join('')).not.toContain(CANARY_TOKEN);
      expect(output.join('')).not.toContain(CANARY_USER_ID);
    } finally {
      process.chdir(previousCwd);
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('runtime source imports no persistence API and has no direct console logger', () => {
    const corePath = join(
      process.cwd(),
      'scripts', 'ops', 'daily-record-user-identity-reconciliation', 'runtime-non-persistence-core.mjs',
    );
    const runnerPath = join(
      process.cwd(),
      'scripts', 'ops', 'daily-record-user-identity-reconciliation', 'runtime-non-persistence-runner.mjs',
    );

    const source = `${readFileSync(corePath, 'utf8')}\n${readFileSync(runnerPath, 'utf8')}`;
    for (const forbidden of [
      'node:fs',
      'node:fs/promises',
      'writeFile',
      'appendFile',
      'createWriteStream',
      'mkdtemp',
      '.token.local',
      'console.log',
      'console.error',
      'console.warn',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
