#!/usr/bin/env node

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}

function printUsage() {
  console.error(
    "Usage: node scripts/ci/check-act-warnings.mjs <log-file> [--json] [--json-output <path>]",
  );
}

function parseArgs(argv) {
  let logFilePath = null;
  let json = false;
  let jsonOutputPath = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--json-output") {
      jsonOutputPath = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (!arg.startsWith("-") && logFilePath === null) {
      logFilePath = arg;
      continue;
    }
  }

  return {
    json,
    jsonOutputPath,
    logFilePath,
  };
}

export function buildResult(logText) {
  const warningPattern = /not wrapped in act/i;
  const stderrHeaderPattern = /stderr\s+\|\s+(.+?)\s+>/i;

  let currentFile = "";
  let totalWarnings = 0;
  const counts = new Map();

  for (const rawLine of logText.split(/\r?\n/)) {
    const line = stripAnsi(rawLine);
    const headerMatch = line.match(stderrHeaderPattern);
    if (headerMatch) {
      currentFile = headerMatch[1];
    }

    if (warningPattern.test(line)) {
      totalWarnings += 1;
      const file = currentFile || "<unknown>";
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }

  const entries = Array.from(counts.entries())
    .map(([file, count]) => ({ count, file }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.file.localeCompare(b.file);
    });

  const max = entries[0] ?? { count: 0, file: null };
  const countsByFile = Object.fromEntries(entries.map((entry) => [entry.file, entry.count]));

  return {
    affectedFiles: entries.length,
    countsByFile,
    maxWarningsFile: max.file,
    maxWarningsPerFile: max.count,
    totalWarnings,
  };
}

function printSummary(result) {
  console.log(`[act-warning-guard] totalWarnings=${result.totalWarnings}`);
  console.log(`[act-warning-guard] affectedFiles=${result.affectedFiles}`);
  console.log(`[act-warning-guard] maxWarningsPerFile=${result.maxWarningsPerFile}`);
  console.log(`[act-warning-guard] maxWarningsFile=${result.maxWarningsFile ?? "none"}`);

  if (result.totalWarnings > 0) {
    console.log("[act-warning-guard] warnings by file:");
    for (const [file, count] of Object.entries(result.countsByFile)) {
      console.log(`  - ${file}: ${count}`);
    }
    console.error("[act-warning-guard] act(...) warnings detected; failing CI.");
  } else {
    console.log("[act-warning-guard] no act(...) warnings detected.");
  }
}

function main() {
  const { json, jsonOutputPath, logFilePath } = parseArgs(process.argv.slice(2));

  if (!logFilePath) {
    printUsage();
    process.exit(2);
  }

  if (!fs.existsSync(logFilePath)) {
    console.error(`[act-warning-guard] log file not found: ${logFilePath}`);
    process.exit(2);
  }

  const logText = fs.readFileSync(logFilePath, "utf8");
  const result = buildResult(logText);

  printSummary(result);

  if (jsonOutputPath) {
    fs.writeFileSync(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`[act-warning-guard] wrote json report: ${jsonOutputPath}`);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.totalWarnings > 0 ? 1 : 0);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
