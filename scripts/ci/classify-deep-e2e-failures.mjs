#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INPUT = "test-results/results.json";
const DEFAULT_JSON_OUTPUT = "reports/deep-e2e-failure-taxonomy.json";
const DEFAULT_MARKDOWN_OUTPUT = "reports/deep-e2e-failure-taxonomy.md";

const SAFE_RUNTIME_FLAGS = [
  "VITE_SKIP_LOGIN",
  "VITE_E2E_MSAL_MOCK",
  "VITE_SKIP_SHAREPOINT",
  "VITE_FORCE_SHAREPOINT",
  "VITE_DATA_PROVIDER",
  "VITE_SCHEDULES_ENABLED",
];

const CAUSE_RULES = [
  {
    category: "auth_required",
    pattern:
      /auth(?:entication|orization)? required|login required|sign[ -]?in|unauthorized|forbidden|aadsts|msal/i,
  },
  {
    category: "sharepoint_provider",
    pattern:
      /sharepoint|graph\.microsoft|sp(?:o)? client|data provider.*sharepoint/i,
  },
  {
    category: "date_timezone",
    pattern:
      /time\s?zone|timezone|utc|local date|date mismatch|day boundary|midnight/i,
  },
  {
    category: "persistence",
    pattern:
      /persist|localstorage|indexeddb|save(?:d| failure)?|reload.*(?:lost|missing)/i,
  },
  {
    category: "fixture_missing",
    pattern:
      /fixture|seed|expected data|no data|empty state|not found in (?:mock|memory)/i,
  },
  {
    category: "page_not_rendered",
    pattern:
      /#root.*(?:empty|0)|rootlength\D*0|page.*(?:blank|not rendered)|bootstrap/i,
  },
  {
    category: "selector_contract",
    pattern:
      /locator|selector|testid|data-testid|strict mode violation|resolved to \d+ elements|element\(s\) not found/i,
  },
  {
    category: "accessibility",
    pattern: /accessib|aria|axe|wcag|focus(?:ed| order| trap)?/i,
  },
  {
    category: "timeout",
    pattern: /timed out|timeout|exceeded.*(?:ms|minutes)|test timeout/i,
  },
];

const FEATURE_RULES = [
  { feature: "Auth", pattern: /(?:^|[/._-])auth(?:[/._-]|$)|login|msal/i },
  { feature: "Users", pattern: /(?:^|[/._-])users?(?:[/._-]|$)/i },
  { feature: "Transport", pattern: /transport|vehicle|route-planning/i },
  { feature: "Dashboard", pattern: /dashboard/i },
  { feature: "Schedules", pattern: /schedules?|calendar|shift/i },
  { feature: "Daily-Handoff", pattern: /daily|handoff|today/i },
  { feature: "Kiosk", pattern: /kiosk|toilet.*board/i },
  { feature: "SharePoint", pattern: /sharepoint|sp-lane/i },
];

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    json: DEFAULT_JSON_OUTPUT,
    markdown: DEFAULT_MARKDOWN_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === "--input" ||
      argument === "--json" ||
      argument === "--markdown"
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function flattenSuites(suites = []) {
  const specs = [];
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      specs.push({ ...spec, suiteTitle: suite.title ?? "" });
    }
    specs.push(...flattenSuites(suite.suites ?? []));
  }
  return specs;
}

function errorTextForTest(test) {
  return (test.results ?? [])
    .filter((result) => result.status !== "passed")
    .flatMap((result) => [
      result.error?.message,
      ...(result.errors ?? []).map((error) => error.message),
      ...(result.stderr ?? []).map((line) =>
        typeof line === "string" ? line : line.text,
      ),
    ])
    .filter(Boolean)
    .join("\n");
}

function classifyCause(text) {
  const matches = CAUSE_RULES.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.category,
  );
  return {
    primaryCategory: matches[0] ?? "unknown",
    signals: matches,
  };
}

function classifyFeature(file, title) {
  const haystack = `${file} ${title}`;
  return (
    FEATURE_RULES.find((rule) => rule.pattern.test(haystack))?.feature ??
    "Other"
  );
}

function increment(record, key, amount = 1) {
  record[key] = (record[key] ?? 0) + amount;
}

function runtimeFlags(env) {
  return Object.fromEntries(
    SAFE_RUNTIME_FLAGS.filter((name) => env[name] !== undefined).map((name) => [
      name,
      env[name],
    ]),
  );
}

function firstLine(value) {
  return String(value ?? "")
    .split("\n")[0]
    .slice(0, 500);
}

export function classifyReport(report, env = process.env) {
  if (!report || !Array.isArray(report.suites)) {
    throw new Error("Playwright JSON report must contain a suites array");
  }

  const specs = flattenSuites(report.suites);
  const failures = [];
  const testStatuses = {};
  let totalTests = 0;
  let didNotRun = 0;

  for (const spec of specs) {
    for (const test of spec.tests ?? []) {
      totalTests += 1;
      increment(testStatuses, test.status ?? "unknown");
      if (!test.results?.length && test.status !== "skipped") didNotRun += 1;
      if (test.status !== "unexpected") continue;

      const errorText = errorTextForTest(test);
      const title = [spec.suiteTitle, spec.title].filter(Boolean).join(" > ");
      const file = spec.file ?? "";
      const cause = classifyCause(errorText);
      const attempts = test.results?.length ?? 0;

      failures.push({
        key: `${file}::${spec.id ?? title}::${test.projectName ?? test.projectId ?? "unknown"}`,
        feature: classifyFeature(file, title),
        primaryCategory: cause.primaryCategory,
        signals: cause.signals,
        file,
        title,
        project: test.projectName ?? test.projectId ?? "unknown",
        attempts,
        retryCount: Math.max(
          0,
          ...(test.results ?? []).map((result) => result.retry ?? 0),
        ),
        firstError: firstLine(errorText),
      });
    }
  }

  const byFeature = {};
  const byCause = {};
  for (const failure of failures) {
    increment(byFeature, failure.feature);
    increment(byCause, failure.primaryCategory);
  }

  return {
    schemaVersion: 1,
    status: "available",
    generatedAt: new Date().toISOString(),
    metadata: {
      headSha: env.GITHUB_SHA ?? null,
      eventName: env.GITHUB_EVENT_NAME ?? null,
      runId: env.GITHUB_RUN_ID ?? null,
      runAttempt: env.GITHUB_RUN_ATTEMPT ?? null,
      lane: env.DEEP_E2E_LANE ?? null,
      runtimeFlags: runtimeFlags(env),
    },
    totals: {
      specs: specs.length,
      tests: totalTests,
      failed: failures.length,
      didNotRun,
      byStatus: testStatuses,
      featureClassifications: Object.values(byFeature).reduce(
        (sum, value) => sum + value,
        0,
      ),
      causeClassifications: Object.values(byCause).reduce(
        (sum, value) => sum + value,
        0,
      ),
    },
    playwrightStats: report.stats ?? null,
    byFeature,
    byCause,
    dominantCategories: Object.entries(byCause)
      .filter(([, count]) => count >= 20)
      .map(([category, count]) => ({ category, count })),
    failures,
  };
}

function unavailablePayload(error, input, env) {
  return {
    schemaVersion: 1,
    status: "unavailable",
    generatedAt: new Date().toISOString(),
    metadata: {
      headSha: env.GITHUB_SHA ?? null,
      eventName: env.GITHUB_EVENT_NAME ?? null,
      runId: env.GITHUB_RUN_ID ?? null,
      runAttempt: env.GITHUB_RUN_ATTEMPT ?? null,
      lane: env.DEEP_E2E_LANE ?? null,
      runtimeFlags: runtimeFlags(env),
    },
    input,
    error: firstLine(error instanceof Error ? error.message : error),
  };
}

function markdownTable(entries) {
  if (!entries.length) return "_None_";
  return [
    "| Classification | Count |",
    "| --- | ---: |",
    ...entries.map(([name, count]) => `| ${name} | ${count} |`),
  ].join("\n");
}

export function renderMarkdown(payload) {
  if (payload.status !== "available") {
    return [
      "# Deep E2E Failure Taxonomy",
      "",
      `Status: **unavailable**`,
      "",
      `Input: \`${payload.input}\``,
      "",
      `Error: ${payload.error}`,
      "",
      "This diagnostic failure does not change the Deep E2E test outcome.",
      "",
    ].join("\n");
  }

  return [
    "# Deep E2E Failure Taxonomy",
    "",
    `Head SHA: \`${payload.metadata.headSha ?? "unknown"}\``,
    `Lane: \`${payload.metadata.lane ?? "unknown"}\``,
    `Unique failed tests: **${payload.totals.failed}**`,
    `Feature classifications: **${payload.totals.featureClassifications}**`,
    `Cause classifications: **${payload.totals.causeClassifications}**`,
    "",
    "## By feature",
    "",
    markdownTable(
      Object.entries(payload.byFeature).sort((a, b) => b[1] - a[1]),
    ),
    "",
    "## By primary cause",
    "",
    markdownTable(Object.entries(payload.byCause).sort((a, b) => b[1] - a[1])),
    "",
    "## Failures",
    "",
    "| Feature | Cause | Spec | Project | Attempts | First error |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...payload.failures.map(
      (failure) =>
        `| ${failure.feature} | ${failure.primaryCategory} | ${failure.file}: ${failure.title} | ${failure.project} | ${failure.attempts} | ${failure.firstError.replaceAll("|", "\\|")} |`,
    ),
    "",
  ].join("\n");
}

function writeOutput(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  let payload;
  try {
    payload = classifyReport(
      JSON.parse(fs.readFileSync(options.input, "utf8")),
    );
  } catch (error) {
    payload = unavailablePayload(error, options.input, process.env);
  }

  const markdown = renderMarkdown(payload);
  writeOutput(options.json, `${JSON.stringify(payload, null, 2)}\n`);
  writeOutput(options.markdown, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`);
  }
  process.stdout.write(
    `${JSON.stringify({ status: payload.status, totals: payload.totals ?? null })}\n`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  runCli();
}
