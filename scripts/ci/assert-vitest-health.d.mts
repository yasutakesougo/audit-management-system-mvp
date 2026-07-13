export interface VitestHealthSummary {
  startedFiles: number;
  endedFiles: number;
  lastStartedFile: string | null;
  missingEndedFiles: string[];
  unhandledErrors: number;
  workerAbnormalExits: number;
  vitestExitCode: number;
  invalidMemoryLines: number;
  logFilePresent: boolean;
  healthy: boolean;
}

export function summarizeVitestHealth(input?: {
  logText?: string;
  memoryText?: string;
  vitestExitCode?: number | string;
  logFilePresent?: boolean;
}): VitestHealthSummary;

export function runVitestHealthAssertion(input: {
  logPath: string;
  memoryPath: string;
  summaryPath: string;
  vitestExitCode: number | string;
}): VitestHealthSummary;
