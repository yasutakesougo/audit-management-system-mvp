#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

export const DEFAULT_INPUT = "test-results/results.json";
export const DEFAULT_OUTPUT = "reports/deep-e2e-taxonomy.json";
const UNCLASSIFIED = "unclassified";
const ERROR_SUMMARY_LIMIT = 500;

const FEATURE_RULES = [
  ["exception-center", /(?:^|[/_.-])exception[-_.]?center(?:[/_.-]|$)/i],
  [
    "accessibility",
    /(?:^|[/_.-])(?:accessibility|a11y|touch[-_.]?targets?)(?:[/_.-]|$)/i,
  ],
  ["auth", /(?:^|[/_.-])auth(?:[/_.-]|$)/i],
  ["users", /(?:^|[/_.-])users?(?:[/_.-]|$)/i],
  ["transport", /(?:^|[/_.-])transport(?:[/_.-]|$)/i],
  ["isp", /(?:^|[/_.-])isp(?:[/_.-]|$)/i],
  ["dashboard", /(?:^|[/_.-])dashboard(?:[/_.-]|$)/i],
  ["staff", /(?:^|[/_.-])staff(?:[/_.-]|$)/i],
  ["nurse", /(?:^|[/_.-])nurse(?:[/_.-]|$)/i],
  ["agenda", /(?:^|[/_.-])agenda(?:[/_.-]|$)/i],
  ["schedules", /(?:^|[/_.-])schedules?(?:[/_.-]|$)/i],
  ["reliability", /(?:^|[/_.-])reliability(?:[/_.-]|$)/i],
];

const CAUSE_RULES = [
  [
    "missing-storage-state",
    /(?:storage.?state.*(?:missing|not found|enoent)|(?:missing|not found|enoent).*storage.?state|pw_storage_state)/i,
  ],
  [
    "auth-mode-mismatch",
    /(?:auth(?:entication)?.?mode.?mismatch|skip.?login|expected.*(?:sign.?in|signed.?out).*(?:not found|hidden)|(?:sign.?in|signed.?out).*expected)/i,
  ],
  [
    "touch-target-size",
    /(?:touch.?target|minimum (?:height|width)|(?:height|width).*(?:less than|received).*(?:44|48|64)|bounding.?box.*(?:height|width))/i,
  ],
  [
    "unexpected-redirect",
    /(?:unexpected(?:ly)? redirect|redirected to|expected (?:page )?url|tohaveurl)/i,
  ],
  [
    "request-failure",
    /(?:request failed|failed to fetch|net::err_|http (?:4|5)\d\d|response status (?:4|5)\d\d)/i,
  ],
  ["console-error", /(?:console[.: ]error|unexpected console error)/i],
  ["page-error", /(?:pageerror|page error|uncaught (?:error|exception))/i],
  [
    "fixture-missing",
    /(?:(?:missing|unavailable) fixture|fixture.*(?:missing|not found)|precondition.*failed)/i,
  ],
  [
    "locator-not-found",
    /(?:element\(s\) not found|locator.*(?:not found|waiting|visible)|waiting for (?:getby|locator)|getby\w+.*not found)/i,
  ],
  ["timeout", /(?:timed out|timeout of \d+ms|test timeout)/i],
  [
    "assertion-mismatch",
    /(?:expect(?:ed)?|received|tobe|toequal|tohave(?:text|count|value|attribute))/i,
  ],
];

function flattenSuites(suites = [], ancestors = []) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).map((spec) => ({
      ...spec,
      suiteTitle: [...ancestors, suite.title].filter(Boolean).join(" > "),
    })),
    ...flattenSuites(
      suite.suites ?? [],
      [...ancestors, suite.title].filter(Boolean),
    ),
  ]);
}

function isFailedTest(test) {
  return test.status === "unexpected" || test.status === "failed";
}

export function failureKey(spec, test) {
  const file = spec.file ?? "unknown-file";
  const title =
    [spec.suiteTitle, spec.title].filter(Boolean).join(" > ") || "unknown-test";
  const identity = spec.id ?? title;
  const project = test.projectName ?? test.projectId ?? "unknown-project";
  return `${file}::${identity}::${project}`;
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

function countsFor(failures, field) {
  const counts = {};
  for (const failure of failures) increment(counts, failure[field]);
  return counts;
}

function sameCounts(left, right) {
  const leftEntries = Object.entries(left).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rightEntries = Object.entries(right).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function errorText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return [value.message, value.value, value.stack]
    .filter((entry) => typeof entry === "string")
    .join("\n");
}

function collectErrorText(test) {
  const results = Array.isArray(test.results) ? test.results : [];
  return [
    errorText(test.error),
    ...(Array.isArray(test.errors) ? test.errors.map(errorText) : []),
    ...results.flatMap((result) => [
      errorText(result?.error),
      ...(Array.isArray(result?.errors) ? result.errors.map(errorText) : []),
      ...(Array.isArray(result?.stderr) ? result.stderr.map(errorText) : []),
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeError(test) {
  const summary = collectErrorText(test)
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (summary || `Playwright status: ${test.status ?? "unknown"}`).slice(
    0,
    ERROR_SUMMARY_LIMIT,
  );
}

export function classifyFeature(file = "") {
  return (
    FEATURE_RULES.find(([, pattern]) => pattern.test(file))?.[0] ?? UNCLASSIFIED
  );
}

export function classifyCause({
  file = "",
  title = "",
  errorSummary = "",
} = {}) {
  const observable = [file, title, errorSummary].filter(Boolean).join("\n");
  return (
    CAUSE_RULES.find(([, pattern]) => pattern.test(observable))?.[0] ??
    UNCLASSIFIED
  );
}

function classifyFailure(spec, test) {
  const file = spec.file ?? "unknown-file";
  const title =
    [spec.suiteTitle, spec.title].filter(Boolean).join(" > ") || "unknown-test";
  const project = test.projectName ?? test.projectId ?? "unknown-project";
  const errorSummary = summarizeError(test);
  return {
    failureKey: failureKey(spec, test),
    file,
    title,
    project,
    feature: classifyFeature(file),
    cause: classifyCause({ file, title, errorSummary }),
    errorSummary,
  };
}

export function validateAvailable(payload) {
  if (payload.schemaVersion !== 2) {
    throw new Error("Taxonomy schemaVersion must be 2");
  }
  if (!Number.isInteger(payload.failed) || payload.failed < 0) {
    throw new Error("Taxonomy failed count must be a non-negative integer");
  }
  if (
    !Array.isArray(payload.failures) ||
    payload.failures.length !== payload.failed
  ) {
    throw new Error(
      "Taxonomy failures must contain one classification per failed test",
    );
  }
  const classifiedKeys = payload.failures.map((failure) => failure?.failureKey);
  if (
    payload.failures.some(
      (failure) =>
        !failure ||
        [
          "failureKey",
          "file",
          "title",
          "project",
          "feature",
          "cause",
          "errorSummary",
        ].some(
          (field) =>
            typeof failure[field] !== "string" || failure[field].length === 0,
        ),
    )
  ) {
    throw new Error(
      "Taxonomy failures must contain complete string classifications",
    );
  }
  if (new Set(classifiedKeys).size !== classifiedKeys.length) {
    throw new Error("Taxonomy failure classifications must be unique");
  }
  if (
    !Array.isArray(payload.failureKeys) ||
    payload.failureKeys.length !== payload.failed
  ) {
    throw new Error(
      "Taxonomy failureKeys must contain one unique key per failed test",
    );
  }
  if (new Set(payload.failureKeys).size !== payload.failureKeys.length) {
    throw new Error("Taxonomy failureKeys must be unique");
  }
  if (payload.failureKeys.some((key, index) => key !== classifiedKeys[index])) {
    throw new Error("Taxonomy failureKeys must be derived from failures");
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
    const sourceField =
      field === "featureClassifications" ? "feature" : "cause";
    const derived = countsFor(payload.failures, sourceField);
    if (!sameCounts(value, derived)) {
      throw new Error(`Taxonomy ${field} must be derived from failures`);
    }
  }
  return payload;
}

export function classifyReport(report, metadata = {}) {
  if (!report || !Array.isArray(report.suites)) {
    throw new Error("Playwright JSON report must contain a suites array");
  }

  const failuresByKey = new Map();
  for (const spec of flattenSuites(report.suites)) {
    for (const test of spec.tests ?? []) {
      if (!isFailedTest(test)) continue;
      const failure = classifyFailure(spec, test);
      const existing = failuresByKey.get(failure.failureKey);
      if (!existing || existing.errorSummary.startsWith("Playwright status:")) {
        failuresByKey.set(failure.failureKey, failure);
      }
    }
  }

  const failures = [...failuresByKey.values()];
  const featureClassifications = countsFor(failures, "feature");
  const causeClassifications = countsFor(failures, "cause");
  const failureKeys = failures.map((failure) => failure.failureKey);
  const failed = failures.length;
  return validateAvailable({
    schemaVersion: 2,
    status: "available",
    generatedAt: new Date().toISOString(),
    metadata,
    failed,
    failures,
    featureClassifications,
    causeClassifications,
    failureKeys,
  });
}

export function unavailablePayload(input, error, metadata = {}) {
  return {
    schemaVersion: 2,
    status: "unavailable",
    generatedAt: new Date().toISOString(),
    metadata,
    input,
    failed: null,
    failures: [],
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
