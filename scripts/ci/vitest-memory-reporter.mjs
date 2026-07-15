import fs from 'node:fs';
import path from 'node:path';

export function memorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

export default class VitestMemoryReporter {
  constructor() {
    this.outputPath = process.env.VITEST_MEMORY_LOG || 'reports/nightly-memory/vitest-memory.jsonl';
    this.startedAt = new Map();
  }

  write(event, testModule, details = {}) {
    fs.mkdirSync(path.dirname(this.outputPath), { recursive: true });
    const moduleId = testModule?.moduleId || testModule?.id || 'unknown';
    const startedAt = this.startedAt.get(moduleId);
    fs.appendFileSync(this.outputPath, `${JSON.stringify({
      timestamp: new Date().toISOString(), event, moduleId,
      elapsedMs: startedAt === undefined ? undefined : Date.now() - startedAt,
      pid: process.pid, ...details, ...memorySnapshot(),
    })}\n`);
  }

  onTestRunStart(specifications) {
    this.write(
      'run-start',
      { moduleId: `${specifications.length} specifications` },
      { expectedModules: specifications.length },
    );
  }
  onTestModuleStart(testModule) { this.startedAt.set(testModule.moduleId, Date.now()); this.write('module-start', testModule); }
  onTestModuleEnd(testModule) { this.write('module-end', testModule); this.startedAt.delete(testModule.moduleId); }
  onTestRunEnd(testModules, errors) { this.write('run-end', { moduleId: `${testModules.length} modules; ${errors.length} errors` }); }
}
