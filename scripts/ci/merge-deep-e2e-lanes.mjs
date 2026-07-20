#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { DEEP_LANES } from "./resolve-deep-e2e-lane.mjs";

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

function filesMatching(root, pattern) {
  return walk(root).filter((file) => pattern.test(path.basename(file))).sort();
}

function filesMatchingByPath(root, pattern) {
  return walk(root).filter((file) => pattern.test(file.replace(/\\/g, "/"))).sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function safeReadJson(file) {
  try {
    return { data: readJson(file), file };
  } catch (error) {
    return { error: `${file}: ${error.message}` };
  }
}

function assertLaneSet(values, label) {
  const actual = [...new Set(values)].sort();
  const expected = [...DEEP_LANES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected) || values.length !== expected.length) {
    throw new Error(
      `${label} must contain each Deep lane exactly once: actual=${actual.join(",")}`,
    );
  }
}

function decodeXml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function junitTestIdentities(xml) {
  const identities = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*)>/g)) {
    const attributes = match[1];
    const name = attributes.match(/\bname="([^"]*)"/)?.[1] ?? "";
    const classname = attributes.match(/\bclassname="([^"]*)"/)?.[1] ?? "";
    identities.push(`${decodeXml(classname)}::${decodeXml(name)}`);
  }
  return identities;
}

export function playwrightExpectedIdentities(report) {
  const identities = [];
  function visit(suites = [], ancestors = []) {
    for (const suite of suites) {
      const nextAncestors = suite.file === suite.title
        ? ancestors
        : [...ancestors, suite.title].filter(Boolean);
      for (const spec of suite.specs ?? []) {
        const name = [...nextAncestors, spec.title].filter(Boolean).join(" › ");
        for (const test of spec.tests ?? []) {
          const project = test.projectName ?? test.projectId;
          if (project === "chromium") identities.push(`${spec.file}::${name}`);
        }
      }
      visit(suite.suites ?? [], nextAncestors);
    }
  }
  visit(report.suites ?? []);
  return identities;
}

function countsFor(failures, field) {
  return failures.reduce((counts, failure) => {
    counts[failure[field]] = (counts[failure[field]] ?? 0) + 1;
    return counts;
  }, {});
}

function parseIntegrationResult(rawResult) {
  if (!rawResult) return "UNKNOWN";
  const normalized = String(rawResult).toLowerCase();
  if (normalized === "success") return "PASS";
  if (normalized === "failure") return "FAIL";
  if (normalized === "cancelled" || normalized === "skipped") return "NOT_RUN";
  return "UNKNOWN";
}

function inferLane(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const lane of DEEP_LANES) {
    const exact = new RegExp(`(?:^|/)${lane}(?:/|-)`).test(normalized);
    if (exact) return lane;
    const bootstrapMatch = new RegExp(`bootstrap-${lane}-artifact`).test(normalized);
    if (bootstrapMatch) return lane;
  }
  return null;
}

function collectByLane(files) {
  const grouped = new Map(DEEP_LANES.map((lane) => [lane, []]));
  const ungrouped = [];

  for (const file of files) {
    const lane = inferLane(file);
    if (!lane) {
      ungrouped.push(file);
      continue;
    }
    grouped.get(lane).push(file);
  }

  return { grouped, ungrouped };
}

function assertUniqueLaneArtifacts(grouped, label) {
  const duplicates = [...grouped.entries()].filter(([, files]) => files.length > 1);
  if (duplicates.length > 0) {
    const detail = duplicates
      .map(([lane, files]) => `${lane}:${files.join(",")}`)
      .join(";");
    throw new Error(`${label} contains multiple artifacts per lane: ${detail}`);
  }
}

function collectFlakyFromPlaywrightResults(resultJson) {
  const flakyKeys = new Set();

  function visitSuite(suite, ancestors) {
    const nextAncestors = suite.file === suite.title
      ? ancestors
      : [...ancestors, suite.title].filter(Boolean);

    for (const spec of suite.specs ?? []) {
      const testName = [...nextAncestors, spec.title].filter(Boolean).join(" › ");
      const specIdentityFile = spec.file ?? suite.file ?? "unknown";
      const identity = `${specIdentityFile}::${testName}`;

      for (const test of spec.tests ?? []) {
        const project = test.projectName ?? test.projectId;
        if (project && project !== "chromium") continue;

        const results = [...(test.results ?? [])].sort(
          (a, b) => (a.retry ?? 0) - (b.retry ?? 0),
        );
        for (let index = 0; index < results.length - 1; index += 1) {
          const prev = results[index];
          const next = results[index + 1];
          if (prev.status === "failed" && (next.status === "passed" || next.status === "expected")) {
            flakyKeys.add(identity);
            break;
          }
          if (prev.status === "failed" && (next.status === "cancelled" || next.status === "timedOut")) {
            break;
          }
        }
      }
    }

    for (const nested of suite.suites ?? []) {
      visitSuite(nested, nextAncestors);
    }
  }

  for (const suite of resultJson.suites ?? []) {
    visitSuite(suite, []);
  }

  return flakyKeys.size;
}

export function collectTrueFlaky(testResultFilesByLane, { missingSources = null } = {}) {
  const result = { value: 0, status: "available" };
  let missingLaneCount = 0;
  let parseableLaneCount = 0;

  for (const lane of DEEP_LANES) {
    const files = testResultFilesByLane.get(lane) ?? [];
    if (files.length === 0) {
      missingLaneCount += 1;
      if (missingSources) missingSources.push(`test-results:${lane}`);
      result.status = "unavailable";
      continue;
    }
    const canonical = files.find((file) =>
      /\/test-results\/results\.json$/i.test(file.replace(/\\/g, "/")),
    );
    const file = canonical ?? files[0];
    const parsed = safeReadJson(file);
    if (parsed.error) {
      missingLaneCount += 1;
      if (missingSources) missingSources.push(`test-results:${lane}`);
      result.status = "unavailable";
      continue;
    }

    parseableLaneCount += 1;
    if (result.status === "available") {
      // aggregate flaky keys, set to number once parseable
      const flakyCount = collectFlakyFromPlaywrightResults(parsed.data);
      result.value += flakyCount;
    }
  }

  if (parseableLaneCount === 0) {
    result.value = "unavailable";
  }

  if (result.status === "unavailable") {
    result.value = "unavailable";
  }

  return result;
}

function collectDidNotRun(cancelAudits, { missingSources = null } = {}) {
  const result = { value: 0, unit: "lane", status: "available" };
  const byLane = new Map();
  const duplicateLanes = new Set();

  for (const audit of cancelAudits) {
    if (!audit?.lane) continue;
    if (byLane.has(audit.lane)) {
      duplicateLanes.add(audit.lane);
      continue;
    }
    byLane.set(audit.lane, audit);
  }

  if (duplicateLanes.size > 0) {
    throw new Error(`Duplicate cancellation audit by lane: ${[...duplicateLanes].join(",")}`);
  }

  for (const lane of DEEP_LANES) {
    const audit = byLane.get(lane);
    if (!audit) {
      result.status = "unavailable";
      result.value = "unavailable";
      if (missingSources) missingSources.push(`deep-cancel-audit:${lane}`);
      return result;
    }
    if (audit.deep_tests_outcome === "skipped" || audit.deep_tests_outcome === "cancelled") {
      result.value += 1;
    }
  }

  return result;
}

function collectIntegrationStatus(root, integrationResultArg, integrationFiles = [], { missingSources = null } = {}) {
  if (integrationResultArg) {
    return parseIntegrationResult(integrationResultArg);
  }

  const files = integrationFiles.length > 0 ? integrationFiles : filesMatchingByPath(root, /\/integration-status\.json$/);
  if (files.length === 0) {
    if (missingSources) missingSources.push("integration-status:missing");
    return "UNKNOWN";
  }

  const parsed = safeReadJson(files[0]);
  if (parsed.error) {
    if (missingSources) missingSources.push("integration-status:unparseable");
    return "UNKNOWN";
  }

  return parseIntegrationResult(
    parsed.data.integration_tests_outcome || parsed.data.job_outcome,
  );
}

function evaluateBootstrap(laneDiagnosticsByLane, { missingSources = null } = {}) {
  let hasUnknown = false;
  let hasAbnormal = false;
  const laneStatuses = {};

  for (const lane of DEEP_LANES) {
    const files = laneDiagnosticsByLane.get(lane) ?? [];
    if (files.length === 0) {
      hasUnknown = true;
      if (missingSources) missingSources.push(`bootstrap-diagnostics:${lane}`);
      laneStatuses[lane] = "missing";
      continue;
    }

    const result = safeReadJson(files[0]);
    if (result.error) {
      hasUnknown = true;
      if (missingSources) missingSources.push(`bootstrap-diagnostics:${lane}`);
      laneStatuses[lane] = "unparseable";
      continue;
    }

    const diagnostics = result.data;
    const requestFailures = diagnostics.requestFailures ?? [];
    const expectedSpStubFailures =
      lane === "sp-stub" &&
      requestFailures.length > 0 &&
      requestFailures.every(
        (failure) =>
          failure?.url?.startsWith("https://example.sharepoint.com/") &&
          failure?.errorText === "net::ERR_NAME_NOT_RESOLVED",
      );

    const requiredRuntimeKeys = [
      "VITE_DATA_PROVIDER",
      "VITE_SKIP_SHAREPOINT",
      "VITE_FORCE_SHAREPOINT",
      "VITE_E2E",
    ];
    const runtimeFlags = diagnostics.runtimeFlags ?? {};
    const missingRuntimeKeys = requiredRuntimeKeys.filter(
      (key) => runtimeFlags[key] === undefined || runtimeFlags[key] === null,
    );

    const hasPageError = (diagnostics.pageErrors ?? []).length > 0;
    const hasConsoleError = (diagnostics.console ?? []).some((entry) => entry.type === "error");
    const hasRequestIssue = requestFailures.length > 0 && !expectedSpStubFailures;

    if (diagnostics.error) {
      hasAbnormal = true;
      laneStatuses[lane] = "abnormal";
      continue;
    }
    if ((diagnostics.bodyHtml ?? "").length === 0 || missingRuntimeKeys.length > 0) {
      hasUnknown = true;
      laneStatuses[lane] = "unknown";
      continue;
    }
    if (hasPageError || hasConsoleError || hasRequestIssue) {
      hasAbnormal = true;
      laneStatuses[lane] = "abnormal";
      continue;
    }
    laneStatuses[lane] = "normal";
  }

  if (hasUnknown) return { value: "unknown", details: laneStatuses };
  if (hasAbnormal) return { value: "abnormal", details: laneStatuses };
  return { value: "normal", details: laneStatuses };
}

export function mergeLaneArtifacts(
  root,
  {
    expectedHeadSha,
    expectedInventory,
    runId,
    integrationResult,
    runAttempt,
  } = {},
) {
  if (!expectedHeadSha) throw new Error("expectedHeadSha is required");

  const formalSources = [];
  const formalMissingSources = [];

  const taxonomyFiles = filesMatching(root, /^deep-e2e-taxonomy-.*\.json$/);
  const taxonomies = taxonomyFiles.map(readJson);
  assertLaneSet(taxonomies.map((taxonomy) => taxonomy.metadata?.lane), "Taxonomy artifacts");
  for (const taxonomy of taxonomies) {
    if (taxonomy.schemaVersion !== 2 || taxonomy.status !== "available") {
      throw new Error(`Lane taxonomy is unavailable: ${taxonomy.metadata?.lane ?? "unknown"}`);
    }
    if (taxonomy.metadata?.headSha !== expectedHeadSha) {
      throw new Error(
        `Lane taxonomy head mismatch: lane=${taxonomy.metadata?.lane} expected=${expectedHeadSha} actual=${taxonomy.metadata?.headSha}`,
      );
    }
  }
  formalSources.push(...taxonomyFiles.map((file) => `taxonomy:${file}`));

  const coverageFiles = filesMatching(root, /^deep-e2e-coverage-.*\.json$/);
  const coverage = coverageFiles.map(readJson);
  assertLaneSet(coverage.map((manifest) => manifest.lane), "Coverage manifests");
  formalSources.push(...coverageFiles.map((file) => `coverage:${file}`));
  const coverageDigests = new Set(coverage.map((manifest) => manifest.allSpecsDigest));
  const coverageCounts = new Set(coverage.map((manifest) => manifest.allSpecCount));
  if (coverageDigests.size !== 1 || coverageCounts.size !== 1) {
    throw new Error("Coverage manifests do not describe the same spec inventory");
  }
  for (const manifest of coverage) {
    if (manifest.sourceHeadSha !== expectedHeadSha) {
      throw new Error(`Coverage head mismatch: lane=${manifest.lane}`);
    }
  }
  const ownedSpecs = coverage.flatMap((manifest) =>
    manifest.files.map((file) => ({ file, lane: manifest.lane })),
  );
  const duplicateSpecs = ownedSpecs.filter(
    ({ file }, index) => ownedSpecs.findIndex((entry) => entry.file === file) !== index,
  );
  if (duplicateSpecs.length > 0) {
    throw new Error(`Duplicate lane spec ownership: ${duplicateSpecs[0].file}`);
  }
  const expectedSpecCount = coverage[0]?.allSpecCount ?? 0;
  if (ownedSpecs.length !== expectedSpecCount) {
    throw new Error(
      `Deep spec coverage incomplete: owned=${ownedSpecs.length} expected=${expectedSpecCount}`,
    );
  }

  const junitFiles = filesMatching(root, /^junit-e2e-deep-.*\.xml$/);
  if (junitFiles.length !== DEEP_LANES.length) {
    throw new Error(`Expected ${DEEP_LANES.length} JUnit artifacts, found ${junitFiles.length}`);
  }
  formalSources.push(...junitFiles.map((file) => `junit:${file}`));
  const junitIdentities = junitFiles.flatMap((file) =>
    junitTestIdentities(fs.readFileSync(file, "utf8")),
  );
  const duplicateTests = junitIdentities.filter(
    (identity, index) => junitIdentities.indexOf(identity) !== index,
  );
  if (duplicateTests.length > 0) {
    throw new Error(`Duplicate JUnit test identity across lanes: ${duplicateTests[0]}`);
  }
  let expectedTestCount = null;
  if (expectedInventory) {
    const expectedIdentities = playwrightExpectedIdentities(readJson(expectedInventory));
    const expectedSet = new Set(expectedIdentities);
    const actualSet = new Set(junitIdentities);
    const missing = [...expectedSet].filter((identity) => !actualSet.has(identity));
    const unexpected = [...actualSet].filter((identity) => !expectedSet.has(identity));
    if (
      expectedSet.size !== expectedIdentities.length ||
      missing.length > 0 ||
      unexpected.length > 0 ||
      junitIdentities.length !== expectedIdentities.length
    ) {
      throw new Error(
        `JUnit identity coverage mismatch: expected=${expectedIdentities.length} actual=${junitIdentities.length} missing=${missing[0] ?? "none"} unexpected=${unexpected[0] ?? "none"}`,
      );
    }
    expectedTestCount = expectedIdentities.length;
  }

  const cancelAudits = filesMatching(root, /^deep-cancel-audit\.json$/).map(safeReadJson);
  const cancellationByLane = new Map(DEEP_LANES.map((lane) => [lane, []]));
  for (const payload of cancelAudits) {
    if (payload.error) {
      throw new Error(`Cancellation audit is not parseable: ${payload.error}`);
    }
    const lane = payload.data.lane;
    if (!DEEP_LANES.includes(lane)) {
      throw new Error(`Unknown cancel audit lane: ${lane}`);
    }
    cancellationByLane.get(lane).push(payload.data);
  }
  assertUniqueLaneArtifacts(cancellationByLane, "Cancellation audits");
  formalSources.push(...cancelAudits.filter((entry) => !entry.error).map((entry) => `cancel-audit:${entry.file}`));
  const cancellationPayloads = [];
  for (const lane of DEEP_LANES) {
    const audits = cancellationByLane.get(lane);
    if (audits.length === 0) {
      formalMissingSources.push(`deep-cancel-audit:${lane}`);
      continue;
    }
    const audit = audits[0];
    cancellationPayloads.push(audit);
    if (audit.head_sha !== expectedHeadSha) {
      throw new Error(`Cancellation audit head mismatch: lane=${audit.lane}`);
    }
    if (audit.setup_failure_step !== "none" || audit.direct_cancellation !== false) {
      throw new Error(`Lane did not bootstrap normally: ${audit.lane}`);
    }
  }

  const bootstrapFiles = filesMatching(root, /^bootstrap-diagnostics\.json$/);
  const { grouped: bootstrapByLane, ungrouped: bootstrapUngrouped } = collectByLane(bootstrapFiles);
  if (bootstrapUngrouped.length > 0) {
    throw new Error(`Unable to attribute bootstrap diagnostics to lane: ${bootstrapUngrouped[0]}`);
  }
  assertUniqueLaneArtifacts(bootstrapByLane, "Bootstrap diagnostics");
  formalSources.push(...bootstrapFiles.map((file) => `bootstrap:${file}`));

  let expectedBootstrapRequestFailureCount = 0;
  for (const lane of DEEP_LANES) {
    const files = bootstrapByLane.get(lane);
    if (!files || files.length === 0) continue;
    const parsed = safeReadJson(files[0]);
    if (parsed.error) continue;
    const requestFailures = parsed.data.requestFailures ?? [];
    const expectedSpStubFailures =
      lane === "sp-stub" &&
      requestFailures.length > 0 &&
      requestFailures.every(
        (failure) =>
          failure?.url?.startsWith("https://example.sharepoint.com/") &&
          failure?.errorText === "net::ERR_NAME_NOT_RESOLVED",
      );
    if (expectedSpStubFailures) expectedBootstrapRequestFailureCount += requestFailures.length;
  }
  const bootstrapResult = evaluateBootstrap(bootstrapByLane, { missingSources: formalMissingSources });

  const failures = taxonomies.flatMap((taxonomy) => taxonomy.failures);
  const failureKeys = failures.map((failure) => failure.failureKey);
  if (new Set(failureKeys).size !== failureKeys.length) {
    const duplicate = failureKeys.find(
      (key, index) => failureKeys.indexOf(key) !== index,
    );
    throw new Error(`Duplicate failure key across lanes: ${duplicate}`);
  }

  const resultsFiles = filesMatchingByPath(root, /\/test-results\/(?!.*-retry-).+\/results\.json$|\/test-results\/results\.json$/);
  const { grouped: resultByLane } = collectByLane(resultsFiles);
  const testResults = collectTrueFlaky(resultByLane, { missingSources: formalMissingSources });

  const integrationFiles = filesMatchingByPath(root, /\/integration-status\.json$/);
  formalSources.push(...integrationFiles.map((file) => `integration-status:${file}`));
  const integration = collectIntegrationStatus(root, integrationResult, integrationFiles, {
    missingSources: formalMissingSources,
  });
  const didNotRun = collectDidNotRun(cancellationPayloads, { missingSources: formalMissingSources });

  return {
    taxonomy: {
      schemaVersion: 2,
      status: "available",
      generatedAt: new Date().toISOString(),
      metadata: {
        headSha: expectedHeadSha,
        runId: runId ?? null,
        lanes: DEEP_LANES,
      },
      failed: failures.length,
      failures,
      featureClassifications: countsFor(failures, "feature"),
      causeClassifications: countsFor(failures, "cause"),
      failureKeys,
    },
    coverage: {
      schemaVersion: 1,
      headSha: expectedHeadSha,
      runId: runId ?? null,
      lanes: DEEP_LANES,
      allSpecCount: expectedSpecCount,
      allSpecsDigest: coverage[0]?.allSpecsDigest ?? null,
      ownedSpecCount: ownedSpecs.length,
      junitTestCount: junitIdentities.length,
      expectedTestCount,
      expectedBootstrapRequestFailureCount,
      duplicateSpecCount: 0,
      duplicateTestIdentityCount: 0,
    },
    formalMetrics: {
      schemaVersion: 2,
      status: formalMissingSources.length === 0 ? "available" : "partial",
      trueFlaky: testResults.value,
      didNotRun: didNotRun.value,
      didNotRunUnit: didNotRun.unit,
      integration,
      bootstrap: bootstrapResult.value,
      metadata: {
        runId: runId ?? null,
        runAttempt: runAttempt ?? null,
        sources: formalSources,
        missingSources: formalMissingSources,
      },
    },
  };
}

function parseArgs(argv) {
  const options = {
    root: null,
    output: "reports/deep-e2e-taxonomy-union.json",
    coverageOutput: "reports/deep-e2e-coverage-union.json",
    formalMetricsOutput: null,
    expectedHeadSha: process.env.SOURCE_HEAD_SHA ?? null,
    expectedInventory: null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    integrationResult: null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      [
        "--root",
        "--output",
        "--formal-metrics-output",
        "--coverage-output",
        "--expected-head-sha",
        "--expected-inventory",
        "--run-id",
        "--integration-result",
        "--run-attempt",
      ].includes(
        argument,
      )
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      const key = argument
        .slice(2)
        .replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      options[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.root) throw new Error("--root is required");
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const merged = mergeLaneArtifacts(path.resolve(options.root), options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(merged.taxonomy, null, 2)}\n`);
  fs.mkdirSync(path.dirname(options.coverageOutput), { recursive: true });
  fs.writeFileSync(
    options.coverageOutput,
    `${JSON.stringify(merged.coverage, null, 2)}\n`,
  );
  if (options.formalMetricsOutput) {
    fs.mkdirSync(path.dirname(options.formalMetricsOutput), { recursive: true });
    fs.writeFileSync(
      options.formalMetricsOutput,
      `${JSON.stringify(merged.formalMetrics, null, 2)}\n`,
    );
  }
  process.stdout.write(`${JSON.stringify(merged.coverage)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
