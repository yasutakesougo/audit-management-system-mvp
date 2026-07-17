export interface MemorySnapshot {
  rssBytes: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
}
export function memorySnapshot(): MemorySnapshot;
export default class VitestMemoryReporter {
  outputPath: string;
  shard: string | null;
  startedAt: Map<string, number>;
  write(
    event: string,
    testModule?: { moduleId?: string; id?: string },
    details?: Record<string, unknown>,
  ): void;
  onTestRunStart(specifications: unknown[]): void;
  onTestModuleStart(testModule: { moduleId: string }): void;
  onTestModuleEnd(testModule: { moduleId: string }): void;
  onTestRunEnd(testModules: unknown[], errors: unknown[]): void;
}
