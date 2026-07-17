#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

export const DEFAULT_INPUT = "test-results/results.json";
export const DEFAULT_OUTPUT = "reports/deep-e2e-taxonomy.json";
const UNCLASSIFIED = "unclassified";

function flattenSuites(suites = []) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).map((spec) => ({ ...spec, suiteTitle: suite.title ?? "" })),
    ...flattenSuites(suite.suites ?? []),
  ]);
}

function isFailedTest(test) {
  return test.status === "unexpected" || test.status === "failed";
}

function failureKey(spec, test) {
  const file = spec.file ?? "unknown-file";
  const title = [spec.suiteTitle, spec.title].filter(Boolean).join(" > ") || "unknown-test";
  const identity = spec.id ?? title;
  const project = test.projectName ?? test.projectId ?? "unknown-project";
  return `${file}::${identity}::${project}`;
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

export function validateAvailable(payload) {
  if (!Number.isInteger(payload.failed) || payload.failed < 0) {
    throw new Error("Taxonomy failed count must be a non-negative integer");
  }
  if (!Array.isArray(payload.failureKeys) || payload.failureKeys.length !== payload.failed) {
    throw new Error("Taxonomy failureKeys must contain one unique key per failed test");
  }
  if (new Set(payload.failureKeys).size !== payload.failureKeys.length) {
    throw new Error("Taxonomy failureKeys must be unique");
  }
  for (const field of ["featureClassifications", "causeClassifications"]) {
    const value = payload[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Taxonomy ${field} must be an object`);
    }
    const entries = Object.entries(value);
    if (entries.some(([, count]) => !Number.isInteger(count) || count < 0)) {
      throw new Error(`Taxonomy ${field} counts must be non-negative integers`);
    }
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total !== payload.failed) {
      throw new Error(`Taxonomy ${field} total must equal failed`);
    }
  }
  return payload;
}

export function classifyReport(report, metadata = {}) {
  if (!report || !Array.isArray(report.suites)) {
    throw new Error("Playwright JSON report must contain a suites array");
  }

  const keys = [];
  for (const spec of flattenSuites(report.suites)) {
    for (const test of spec.tests ?? []) {
      if (isFailedTest(test)) keys.push(failureKey(spec, test));
    }
  }

  const failureKeys = [...new Set(keys)];
  const failed = failureKeys.length;
  return validateAvailable({
    schemaVersion: 1,
    status: "available",
    generatedAt: new Date().toISOString(),
    metadata,
    failed,
    featureClassifications: failed ? { [UNCLASSIFIED]: failed } : {},
    causeClassifications: failed ? { [UNCLASSIFIED]: failed } : {},
    failureKeys,
  });
}

export function unavailablePayload(input, error, metadata = {}) {
  return {
    schemaVersion: 1,
    status: "unavailable",
    generatedAt: new Date().toISOString(),
    metadata,
    input,
    failed: null,
    featureClassifications: {},
    causeClassifications: {},
    failureKeys: [],
    error: error instanceof Error ? error.message : String(error),
  };
}

export function readAndClassify(input = DEFAULT_INPUT, metadata = {}) {
  try {
    const report = JSON.parse(fs.readFileSync(input, "utf8"));
    return classifyReport(report, metadata);
  } catch (error) {
    return unavailablePayload(input, error, metadata);
  }
}

export function writeTaxonomy(payload, output = DEFAULT_OUTPUT) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
}

function parseArgs(argv) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = readAndClassify(options.input, {
    headSha: process.env.GITHUB_SHA ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  });
  writeTaxonomy(payload, options.output);
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  if (payload.status !== "available") process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
