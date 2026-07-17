import { describe, expect, it } from 'vitest';
import { summarizeVitestHealth } from '../../scripts/ci/assert-vitest-health.mjs';

const event = (eventName: string, moduleId: string) => JSON.stringify({ event: eventName, moduleId });
const runStart = (expectedModules: number, shard: string | null = null) => JSON.stringify({
  event: 'run-start',
  moduleId: `${expectedModules} specifications`,
  expectedModules,
  shard,
});
const runEnd = (completedModules: number, errorCount = 0, shard: string | null = null) => JSON.stringify({
  event: 'run-end',
  moduleId: `${completedModules} modules; ${errorCount} errors`,
  completedModules,
  errorCount,
  shard,
});

const completeMemory = (...moduleIds: string[]) => [
  runStart(moduleIds.length),
  ...moduleIds.flatMap((moduleId) => [event('module-start', moduleId), event('module-end', moduleId)]),
  runEnd(moduleIds.length),
].join('\n');

describe('summarizeVitestHealth', () => {
  it('passes when every module ends without runtime errors', () => {
    const summary = summarizeVitestHealth({
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({
      expectedFiles: 1,
      startedFiles: 1,
      endedFiles: 1,
      runEndFiles: 1,
      runEndErrors: 0,
      shard: null,
      lastStartedFile: 'a.spec.ts',
      missingEndedFiles: [],
      unhandledErrors: 0,
      workerAbnormalExits: 0,
      vitestExitCode: 0,
      healthy: true,
    });
  });

  it('fails when a module end is missing and records the last started file', () => {
    const summary = summarizeVitestHealth({
      memoryText: [runStart(2), event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts'), event('module-start', 'b.spec.ts'), runEnd(1)].join('\n'),
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({ startedFiles: 2, endedFiles: 1, lastStartedFile: 'b.spec.ts', missingEndedFiles: ['b.spec.ts'], healthy: false });
  });

  it.each([
    'Worker exited unexpectedly',
    'Error: [vitest-pool]: Worker forks emitted error.',
    'Unhandled Error',
    'unhandled error',
  ])('fails for runtime signal: %s', (signal) => {
    const summary = summarizeVitestHealth({
      logText: signal,
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 0,
    });
    expect(summary.healthy).toBe(false);
    expect(summary.unhandledErrors + summary.workerAbnormalExits).toBeGreaterThan(0);
  });

  it('fails when Vitest exits non-zero without a runtime signal', () => {
    const summary = summarizeVitestHealth({
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 2,
    });
    expect(summary).toMatchObject({ vitestExitCode: 2, healthy: false });
  });

  it.each([
    ['1/3', 384],
    ['2/3', 384],
    ['3/3', 383],
  ])('passes completed shard %s without comparing against the unsharded total', (shard, count) => {
    const moduleIds = Array.from({ length: count }, (_, index) => `${shard}-${index}.spec.ts`);
    const memoryText = [
      runStart(1151, shard),
      ...moduleIds.flatMap((moduleId) => [event('module-start', moduleId), event('module-end', moduleId)]),
      runEnd(count, 0, shard),
    ].join('\n');
    const summary = summarizeVitestHealth({ memoryText, vitestExitCode: 0 });
    expect(summary).toMatchObject({
      expectedFiles: 1151,
      startedFiles: count,
      endedFiles: count,
      runEndFiles: count,
      runEndErrors: 0,
      shard,
      shardConsistent: true,
      healthy: true,
    });
  });

  it('fails when run-end is missing or reports errors', () => {
    const withoutRunEnd = summarizeVitestHealth({
      memoryText: [runStart(1), event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts')].join('\n'),
      vitestExitCode: 0,
    });
    const withErrors = summarizeVitestHealth({
      memoryText: [runStart(1), event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts'), runEnd(1, 1)].join('\n'),
      vitestExitCode: 0,
    });
    expect(withoutRunEnd).toMatchObject({ runEndFiles: null, runEndErrors: null, healthy: false });
    expect(withErrors).toMatchObject({ runEndFiles: 1, runEndErrors: 1, healthy: false });
  });

  it('reports worker termination separately from unhandled errors', () => {
    const summary = summarizeVitestHealth({
      logText: 'Error: [vitest-pool]: Worker forks emitted error.\nUnhandled Rejection',
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 1,
    });
    expect(summary).toMatchObject({ workerAbnormalExits: 1, unhandledErrors: 1, healthy: false });
  });

  it('fails when the shard log is missing', () => {
    const summary = summarizeVitestHealth({
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 0,
      logFilePresent: false,
    });
    expect(summary).toMatchObject({ logFilePresent: false, healthy: false });
  });

  it('keeps a summary and fails when the memory JSONL is truncated', () => {
    const summary = summarizeVitestHealth({
      memoryText: `${runStart(1)}\n${event('module-start', 'a.spec.ts')}\n{"event":"module-end"\n${runEnd(0)}`,
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({ startedFiles: 1, endedFiles: 0, invalidMemoryLines: 1, healthy: false });
  });

  it('ignores runtime words only in strict Vitest and Jest result lines', () => {
    const summary = summarizeVitestHealth({
      logText: [
        '\u001b[32m✓\u001b[39m tests/unit/vitestHealthAssertion.spec.ts\u001b[2m > \u001b[22msummarizeVitestHealth\u001b[2m > \u001b[22mfails for runtime signal: Worker exited unexpectedly',
        '× tests/unit/vitestHealthAssertion.spec.ts > detects Unhandled Error',
        'PASS tests/unit/vitestHealthAssertion.spec.ts Unhandled Rejection',
        'FAIL tests/unit/vitestHealthAssertion.test.ts Worker forks emitted error',
      ].join('\n'),
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({ unhandledErrors: 0, workerAbnormalExits: 0, healthy: true });
  });

  it('still detects runtime signals outside strict result lines', () => {
    const summary = summarizeVitestHealth({
      logText: [
        'diagnostic: Worker exited unexpectedly',
        'stack: Worker forks emitted error',
        '',
        '⎯⎯⎯⎯⎯⎯ Unhandled Error ⎯⎯⎯⎯⎯⎯',
        'stack mentions Unhandled Error again',
      ].join('\n'),
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({ unhandledErrors: 1, workerAbnormalExits: 1, healthy: false });
  });

  it('fails when structured expected module count is absent or incomplete', () => {
    const withoutExpected = summarizeVitestHealth({
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts'), runEnd(1)].join('\n'),
      vitestExitCode: 0,
    });
    const incomplete = summarizeVitestHealth({
      memoryText: [runStart(2), event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts'), runEnd(1)].join('\n'),
      vitestExitCode: 0,
    });
    expect(withoutExpected).toMatchObject({ expectedFiles: 0, healthy: false });
    expect(incomplete).toMatchObject({ expectedFiles: 2, startedFiles: 1, endedFiles: 1, healthy: false });
  });

  it('fails when the memory artifact is missing', () => {
    const summary = summarizeVitestHealth({
      memoryText: completeMemory('a.spec.ts'),
      vitestExitCode: 0,
      memoryFilePresent: false,
    });
    expect(summary).toMatchObject({ memoryFilePresent: false, healthy: false });
  });
});
