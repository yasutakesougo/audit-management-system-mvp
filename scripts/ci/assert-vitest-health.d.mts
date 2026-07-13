export interface VitestHealthSummary {
  startedFiles: number;
  endedFiles: number;
  lastStartedFile: string | null;
  unhandledErrors: number;
  workerAbnormalExits: number;
  vitestExitCode: number;
  invalidMemoryLines: number;
  healthy: boolean;
}

export function summarizeVitestHealth(input?: {
  logText?: string;
  memoryText?: string;
  vitestExitCode?: number | string;
}): VitestHealthSummary;

export function runVitestHealthAssertion(input: {
  logPath: string;
  memoryPath: string;
  summaryPath: string;
  vitestExitCode: number | string;
}): VitestHealthSummary;
