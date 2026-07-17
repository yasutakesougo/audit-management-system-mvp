import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import VitestMemoryReporter, { memorySnapshot } from '../../scripts/ci/vitest-memory-reporter.mjs';

const createdDirectories: string[] = [];

afterEach(() => {
  delete process.env.VITEST_MEMORY_LOG;
  delete process.env.VITEST_SHARD;
  for (const directory of createdDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('VitestMemoryReporter', () => {
  it('records module start and end events as durable JSONL', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-memory-'));
    createdDirectories.push(directory);
    const outputPath = path.join(directory, 'memory.jsonl');
    process.env.VITEST_MEMORY_LOG = outputPath;
    const reporter = new VitestMemoryReporter();
    reporter.onTestModuleStart({ moduleId: 'tests/unit/example.spec.ts' });
    reporter.onTestModuleEnd({ moduleId: 'tests/unit/example.spec.ts' });
    const events = fs.readFileSync(outputPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(events.map((event) => event.event)).toEqual(['module-start', 'module-end']);
    expect(events[1]).toMatchObject({ moduleId: 'tests/unit/example.spec.ts', pid: process.pid });
    expect(events[1].elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('reports numeric process memory counters', () => {
    expect(memorySnapshot()).toEqual(expect.objectContaining({ rssBytes: expect.any(Number), heapUsedBytes: expect.any(Number) }));
  });

  it('records shard metadata and structured run-end counts', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-memory-reporter-'));
    createdDirectories.push(directory);
    const outputPath = path.join(directory, 'memory.jsonl');
    process.env.VITEST_MEMORY_LOG = outputPath;
    process.env.VITEST_SHARD = '2/3';

    const reporter = new VitestMemoryReporter();
    reporter.onTestRunStart([{}, {}, {}]);
    reporter.onTestRunEnd([{}, {}], [new Error('worker')]);

    const events = fs.readFileSync(outputPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(events[0]).toMatchObject({ event: 'run-start', expectedModules: 3, shard: '2/3' });
    expect(events[1]).toMatchObject({
      event: 'run-end',
      completedModules: 2,
      errorCount: 1,
      shard: '2/3',
    });
  });
});
