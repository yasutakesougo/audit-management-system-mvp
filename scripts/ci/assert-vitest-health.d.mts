export interface VitestHealthSummary {
  expectedFiles: number;
  startedFiles: number;
  endedFiles: number;
  runEndFiles: number | null;
  runEndErrors: number | null;
  shard: string | null;
  shardConsistent: boolean;
  lastStartedFile: string | null;
  missingEndedFiles: string[];
  unhandledErrors: number;
  workerAbnormalExits: number;
  vitestExitCode: number;
  invalidMemoryLines: number;
  logFilePresent: boolean;
  memoryFilePresent: boolean;
  healthy: boolean;
}

export function summarizeVitestHealth(input?: {
  logText?: string;
  memoryText?: string;
  vitestExitCode?: number | string;
  logFilePresent?: boolean;
  memoryFilePresent?: boolean;
}): VitestHealthSummary;

export function runVitestHealthAssertion(input: {
  logPath: string;
  memoryPath: string;
  summaryPath: string;
  vitestExitCode: number | string;
}): VitestHealthSummary;
