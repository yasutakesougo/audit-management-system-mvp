import { describe, expect, it } from 'vitest';
import { summarizeVitestHealth } from '../../scripts/ci/assert-vitest-health.mjs';

const event = (eventName: string, moduleId: string) => JSON.stringify({ event: eventName, moduleId });

describe('summarizeVitestHealth', () => {
  it('passes when every module ends without runtime errors', () => {
    const summary = summarizeVitestHealth({
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts')].join('\n'),
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({
      startedFiles: 1,
      endedFiles: 1,
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
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts'), event('module-start', 'b.spec.ts')].join('\n'),
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
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts')].join('\n'),
      vitestExitCode: 0,
    });
    expect(summary.healthy).toBe(false);
    expect(summary.unhandledErrors + summary.workerAbnormalExits).toBeGreaterThan(0);
  });

  it('fails when Vitest exits non-zero without a runtime signal', () => {
    const summary = summarizeVitestHealth({
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts')].join('\n'),
      vitestExitCode: 2,
    });
    expect(summary).toMatchObject({ vitestExitCode: 2, healthy: false });
  });

  it('reports worker termination separately from unhandled errors', () => {
    const summary = summarizeVitestHealth({
      logText: 'Error: [vitest-pool]: Worker forks emitted error.\nUnhandled Rejection',
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts')].join('\n'),
      vitestExitCode: 1,
    });
    expect(summary).toMatchObject({ workerAbnormalExits: 1, unhandledErrors: 1, healthy: false });
  });

  it('fails when the shard log is missing', () => {
    const summary = summarizeVitestHealth({
      memoryText: [event('module-start', 'a.spec.ts'), event('module-end', 'a.spec.ts')].join('\n'),
      vitestExitCode: 0,
      logFilePresent: false,
    });
    expect(summary).toMatchObject({ logFilePresent: false, healthy: false });
  });

  it('keeps a summary and fails when the memory JSONL is truncated', () => {
    const summary = summarizeVitestHealth({
      memoryText: `${event('module-start', 'a.spec.ts')}\n{"event":"module-end"`,
      vitestExitCode: 0,
    });
    expect(summary).toMatchObject({ startedFiles: 1, endedFiles: 0, invalidMemoryLines: 1, healthy: false });
  });
});
