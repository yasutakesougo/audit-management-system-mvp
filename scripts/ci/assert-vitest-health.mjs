import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UNHANDLED_ERROR_PATTERN = /unhandled (?:error|rejection)/i;
const WORKER_ABNORMAL_EXIT_PATTERN = /worker exited unexpectedly|worker forks emitted error|timeout terminating forks worker/i;

const parseExitCode = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
};

export function summarizeVitestHealth({ logText = '', memoryText = '', vitestExitCode = 1, logFilePresent = true } = {}) {
  const events = [];
  let invalidMemoryLines = 0;

  for (const line of memoryText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      invalidMemoryLines += 1;
    }
  }

  const started = events.filter((event) => event?.event === 'module-start');
  const ended = events.filter((event) => event?.event === 'module-end');
  const endedCounts = new Map();
  for (const event of ended) endedCounts.set(event.moduleId, (endedCounts.get(event.moduleId) ?? 0) + 1);
  const missingEndedFiles = [];
  for (const event of started) {
    const remaining = endedCounts.get(event.moduleId) ?? 0;
    if (remaining > 0) endedCounts.set(event.moduleId, remaining - 1);
    else if (event.moduleId && !missingEndedFiles.includes(event.moduleId)) missingEndedFiles.push(event.moduleId);
  }
  const logLines = logText.split(/\r?\n/);
  const summary = {
    startedFiles: started.length,
    endedFiles: ended.length,
    lastStartedFile: started.at(-1)?.moduleId ?? null,
    missingEndedFiles,
    unhandledErrors: logLines.filter((line) => UNHANDLED_ERROR_PATTERN.test(line)).length,
    workerAbnormalExits: logLines.filter((line) => WORKER_ABNORMAL_EXIT_PATTERN.test(line)).length,
    vitestExitCode: parseExitCode(vitestExitCode),
    invalidMemoryLines,
    logFilePresent,
  };

  return {
    ...summary,
    healthy:
      summary.startedFiles === summary.endedFiles &&
      summary.unhandledErrors === 0 &&
      summary.workerAbnormalExits === 0 &&
      summary.vitestExitCode === 0 &&
      summary.invalidMemoryLines === 0 &&
      summary.logFilePresent,
  };
}

const parseArgs = (args) => {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near: ${key ?? '<missing>'}`);
    }
    options[key.slice(2)] = value;
  }
  for (const required of ['log', 'memory', 'vitest-exit-code', 'summary']) {
    if (!options[required]) throw new Error(`Missing required argument: --${required}`);
  }
  return options;
};

const readTextSafe = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

export function runVitestHealthAssertion({ logPath, memoryPath, summaryPath, vitestExitCode }) {
  const summary = summarizeVitestHealth({
    logText: readTextSafe(logPath),
    memoryText: readTextSafe(memoryPath),
    vitestExitCode,
    logFilePresent: fs.existsSync(logPath),
  });
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = runVitestHealthAssertion({
    logPath: options.log,
    memoryPath: options.memory,
    summaryPath: options.summary,
    vitestExitCode: options['vitest-exit-code'],
  });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.healthy) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error('[assert-vitest-health] failed unexpectedly');
    console.error(error);
    process.exitCode = 1;
  }
}
