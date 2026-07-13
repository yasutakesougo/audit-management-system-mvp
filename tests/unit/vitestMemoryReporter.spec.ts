import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import VitestMemoryReporter, { memorySnapshot } from '../../scripts/ci/vitest-memory-reporter.mjs';

const directories: string[] = [];
afterEach(() => {
  delete process.env.VITEST_MEMORY_LOG;
  directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
});

describe('VitestMemoryReporter', () => {
  it('records module start and end events as durable JSONL', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-memory-'));
    directories.push(directory);
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
});
