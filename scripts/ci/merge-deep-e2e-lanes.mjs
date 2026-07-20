#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { DEEP_LANES } from "./resolve-deep-e2e-lane.mjs";

const INTEGRATION_EVENTS = new Set(["schedule", "workflow_dispatch"]);

function walk(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

function filesMatching(root, pattern) {
  return walk(root).filter((file) => pattern.test(path.basename(file))).sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function tryReadJson(file) {
  try {
    return { value: readJson(file), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
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

export function junitTestCases(xml) {
  const cases = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attributes = match[1];
    const body = match[2] ?? "";
    const name = attributes.match(/\bname="([^"]*)"/)?.[1] ?? "";
    const classname = attributes.match(/\bclassname="([^"]*)"/)?.[1] ?? "";
    const status = /<skipped\b/.test(body)
      ? "skipped"
      : /<(?:failure|error)\b/.test(body)
        ? "failed"
        : "passed";
    cases.push({
      identity: `${decodeXml(classname)}::${decodeXml(name)}`,
      status,
    });
  }
  return cases;
}

export function junitTestIdentities(xml) {
  return junitTestCases(xml).map(({ identity }) => identity);
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

function playwrightTests(report) {
  const tests = [];
  function visit(suites = []) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) tests.push({ spec, test });
      }
      visit(suite.suites ?? []);
    }
  }
  visit(report?.suites ?? []);
  return tests;
}

function countsFor(failures, field) {
  return failures.reduce((counts, failure) => {
    counts[failure[field]] = (counts[failure[field]] ?? 0) + 1;
    return counts;
  }, {});
}

function laneFromArtifactPath(file) {
  return DEEP_LANES.find((lane) =>
    file
      .split(path.sep)
      .some(
        (part) =>
          part === lane ||
          part.endsWith(`-${lane}`) ||
          part.includes(`-${lane}-`),
      ),
  );
}

function artifactSource(name, file) {
  return { kind: "artifact", name, path: file };
}

function generatedInventorySource(name, file) {
  return { kind: "generated_inventory", name, path: file };
}

function unknownTrueFlaky(source = []) {
  return {
    status: "unknown",
    source,
    missingSources: [],
    summary: { count: 0, testKeys: [], evaluatedTests: 0, retryAttempts: 0 },
  };
}

function buildTrueFlakyEvidence(root, cancelAudits, runId) {
  const files = filesMatching(root, /^results\.json$/).filter((file) =>
    file.split(path.sep).some((part) => part.startsWith("results-json-deep-")),
  );
  const source = files.map((file) =>
    artifactSource(`results-json-deep-${runId ?? "run"}-${laneFromArtifactPath(file) ?? "unknown"}`, file),
  );
  const presentLanes = new Set(files.map(laneFromArtifactPath).filter(Boolean));
  const missingSources = DEEP_LANES
    .filter((lane) => !presentLanes.has(lane))
    .map((lane) => `results-json-deep-${runId ?? "run"}-${lane}`);
  if (
    cancelAudits.length === DEEP_LANES.length &&
    cancelAudits.every((audit) => audit.deep_tests_outcome === "skipped")
  ) {
    return {
      status: "not_run",
      source,
      missingSources,
      summary: { count: 0, testKeys: [], evaluatedTests: 0, retryAttempts: 0 },
    };
  }

  const lanes = files.map(laneFromArtifactPath);
  if (
    files.length !== DEEP_LANES.length ||
    lanes.some((lane) => !lane) ||
    new Set(lanes).size !== DEEP_LANES.length
  ) {
    return { ...unknownTrueFlaky(source), missingSources };
  }

  let evaluatedTests = 0;
  let flakyTests = 0;
  const testKeys = [];
  let retryAttempts = 0;
  for (const file of files) {
    const { value: report, error } = tryReadJson(file);
    if (error || !Array.isArray(report?.suites)) {
      return { ...unknownTrueFlaky(source), missingSources };
    }
    for (const { spec, test } of playwrightTests(report)) {
      evaluatedTests += 1;
      const results = Array.isArray(test.results) ? test.results : [];
      retryAttempts += results.filter((result) => Number(result?.retry) > 0).length;
      if (test.status !== "flaky") continue;
      const finalResult = results.at(-1);
      const hadPriorFailure = results
        .slice(0, -1)
        .some((result) => ["failed", "timedOut", "interrupted"].includes(result?.status));
      if (!hadPriorFailure || finalResult?.status !== "passed") {
        return { ...unknownTrueFlaky(source), missingSources };
      }
      flakyTests += 1;
      testKeys.push(`${spec.file}::${spec.title}`);
    }
  }

  return {
    status: flakyTests === 0 ? "pass" : "fail",
    source,
    missingSources,
    summary: {
      count: flakyTests,
      testKeys,
      evaluatedTests,
      retryAttempts,
    },
  };
}

function unknownDidNotRun(source = []) {
  return {
    status: "unknown",
    source,
    missingSources: [],
    summary: {
      count: 0,
      unit: "test",
      expected: 0,
      executed: 0,
      testKeys: [],
      expectedTests: 0,
      reportedTests: 0,
      completedTests: 0,
      skippedTests: 0,
      missingTests: 0,
      unexpectedTests: 0,
      didNotRunTests: 0,
    },
  };
}

function buildDidNotRunEvidence({ expectedInventory, junitFiles, cancelAudits, runId }) {
  const source = [
    ...(expectedInventory
      ? [generatedInventorySource("expected-deep-inventory", expectedInventory)]
      : []),
    ...junitFiles.map((file) =>
      artifactSource(`junit-e2e-deep-${runId ?? "run"}-${laneFromArtifactPath(file) ?? "unknown"}`, file),
    ),
  ];
  const missingSources = [];
  if (
    cancelAudits.length === DEEP_LANES.length &&
    cancelAudits.every((audit) => audit.deep_tests_outcome === "skipped")
  ) {
    return {
      ...unknownDidNotRun(source),
      status: "not_run",
      missingSources,
    };
  }
  if (!expectedInventory || junitFiles.length !== DEEP_LANES.length) {
    if (!expectedInventory) missingSources.push("expected-deep-inventory.json");
    if (junitFiles.length !== DEEP_LANES.length) {
      missingSources.push(`junit-e2e-deep:${DEEP_LANES.length - junitFiles.length} lane artifact(s)`);
    }
    return { ...unknownDidNotRun(source), missingSources };
  }

  const expected = tryReadJson(expectedInventory);
  if (expected.error || !Array.isArray(expected.value?.suites)) {
    return { ...unknownDidNotRun(source), missingSources: ["expected-deep-inventory.json"] };
  }
  const expectedIdentities = playwrightExpectedIdentities(expected.value);
  const cases = junitFiles.flatMap((file) =>
    junitTestCases(fs.readFileSync(file, "utf8")),
  );
  const identities = cases.map(({ identity }) => identity);
  if (
    new Set(expectedIdentities).size !== expectedIdentities.length ||
    new Set(identities).size !== identities.length
  ) {
    return { ...unknownDidNotRun(source), missingSources };
  }

  const expectedSet = new Set(expectedIdentities);
  const actualSet = new Set(identities);
  const missingTests = expectedIdentities.filter((identity) => !actualSet.has(identity)).length;
  const unexpectedTests = identities.filter((identity) => !expectedSet.has(identity)).length;
  const skippedTests = cases.filter(({ status }) => status === "skipped").length;
  const completedTests = cases.length - skippedTests;
  const didNotRunTests = missingTests + skippedTests;
  return {
    status: didNotRunTests === 0 && unexpectedTests === 0 ? "pass" : "fail",
    source,
    missingSources,
    summary: {
      count: didNotRunTests,
      unit: "test",
      expected: expectedIdentities.length,
      executed: completedTests,
      testKeys: [
        ...expectedIdentities.filter((identity) => !actualSet.has(identity)),
        ...cases.filter(({ status }) => status === "skipped").map(({ identity }) => identity),
      ],
      expectedTests: expectedIdentities.length,
      reportedTests: cases.length,
      completedTests,
      skippedTests,
      missingTests,
      unexpectedTests,
      didNotRunTests,
    },
  };
}

function buildBootstrapEvidence(root, expectedHeadSha, runId) {
  const auditFiles = filesMatching(root, /^deep-cancel-audit\.json$/);
  const diagnosticsFiles = filesMatching(root, /^bootstrap-diagnostics\.json$/);
  const source = [
    ...auditFiles.map((file) =>
      artifactSource(`cancel-audit-deep-${runId ?? "run"}-${laneFromArtifactPath(file) ?? "unknown"}`, file),
    ),
    ...diagnosticsFiles.map((file) =>
      artifactSource(`e2e-bootstrap-diagnostics-${runId ?? "run"}-${laneFromArtifactPath(file) ?? "unknown"}`, file),
    ),
  ];
  const audits = auditFiles.map((file) => ({ file, lane: laneFromArtifactPath(file), ...tryReadJson(file) }));
  const diagnostics = diagnosticsFiles.map((file) => ({
    file,
    lane: laneFromArtifactPath(file),
    ...tryReadJson(file),
  }));
  const failedLanes = new Set();
  const unknownLanes = new Set();
  const missingSources = [];
  let expectedBootstrapRequestFailureCount = 0;

  for (const lane of DEEP_LANES) {
    const laneAudits = audits.filter((entry) => entry.lane === lane);
    const laneDiagnostics = diagnostics.filter((entry) => entry.lane === lane);
    if (laneAudits.length !== 1 || laneDiagnostics.length !== 1) {
      unknownLanes.add(lane);
      if (laneAudits.length !== 1) missingSources.push(`cancel-audit-deep-${runId ?? "run"}-${lane}`);
      if (laneDiagnostics.length !== 1) missingSources.push(`e2e-bootstrap-diagnostics-${runId ?? "run"}-${lane}`);
      continue;
    }
    const audit = laneAudits[0].value;
    const bootstrap = laneDiagnostics[0].value;
    if (!audit || !bootstrap || audit.head_sha !== expectedHeadSha) {
      unknownLanes.add(lane);
      continue;
    }
    if (audit.setup_failure_step !== "none" || audit.direct_cancellation !== false) {
      failedLanes.add(lane);
      continue;
    }
    const requestFailures = bootstrap.requestFailures ?? [];
    const expectedSpStubFailures =
      lane === "sp-stub" &&
      requestFailures.every(
        (failure) =>
          failure?.url?.startsWith("https://example.sharepoint.com/") &&
          failure?.errorText === "net::ERR_NAME_NOT_RESOLVED",
      );
    if (expectedSpStubFailures) {
      expectedBootstrapRequestFailureCount += requestFailures.length;
    }
    if (
      bootstrap.error ||
      (bootstrap.pageErrors?.length ?? 0) > 0 ||
      (requestFailures.length > 0 && !expectedSpStubFailures)
    ) {
      failedLanes.add(lane);
    }
  }

  const validAudits = audits.map(({ value }) => value).filter(Boolean);
  const allSkipped =
    validAudits.length === DEEP_LANES.length &&
    validAudits.every((audit) => audit.deep_tests_outcome === "skipped");
  const status = allSkipped
    ? "not_run"
    : unknownLanes.size > 0
      ? "unknown"
      : failedLanes.size > 0
        ? "fail"
        : "pass";
  return {
    evidence: {
      status,
      source,
      summary: {
        expectedLanes: DEEP_LANES.length,
        verifiedLanes: DEEP_LANES.length - failedLanes.size - unknownLanes.size,
        normalLanes: DEEP_LANES.filter(
          (lane) => !failedLanes.has(lane) && !unknownLanes.has(lane),
        ).sort(),
        abnormalLanes: [...failedLanes].sort(),
        missingLanes: [...unknownLanes].sort(),
        failedLanes: [...failedLanes].sort(),
        unknownLanes: [...unknownLanes].sort(),
      },
      missingSources,
    },
    cancelAudits: validAudits,
    expectedBootstrapRequestFailureCount,
  };
}

function unknownIntegration(source, sourceHeadSha = null, checkoutSha = null) {
  return {
    status: "unknown",
    source,
    missingSources: [],
    summary: {
      jobResult: null,
      junitResult: "unknown",
      expectedSpecs: 3,
      expectedTests: null,
      reportedTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      sourceHeadSha,
      checkoutSha,
    },
  };
}

function buildIntegrationEvidence({
  integrationRoot,
  integrationExpectedInventory,
  integrationArtifactName,
  integrationJobResult,
  eventName,
  expectedHeadSha,
  runId,
}) {
  const eligible = INTEGRATION_EVENTS.has(eventName);
  const auditFile = filesMatching(integrationRoot, /^integration-execution-audit\.json$/)[0];
  const junitFile = filesMatching(integrationRoot, /^junit-e2e-integration\.xml$/)[0];
  const source = [
    { kind: "workflow_context", name: `integration-job-result:${integrationJobResult ?? "unknown"}` },
    ...(integrationExpectedInventory
      ? [generatedInventorySource("expected-integration-inventory", integrationExpectedInventory)]
      : []),
    ...(auditFile
      ? [artifactSource(integrationArtifactName ?? `integration-results-${runId ?? "run"}`, auditFile)]
      : []),
    ...(junitFile
      ? [artifactSource(integrationArtifactName ?? `integration-results-${runId ?? "run"}`, junitFile)]
      : []),
  ];
  const missingSources = [];

  if (!eligible && integrationJobResult === "skipped") {
    return {
      ...unknownIntegration(source),
      status: "not_run",
      missingSources,
    };
  }
  if (!eligible || integrationJobResult === "skipped") return unknownIntegration(source);
  if (!auditFile || !junitFile || !integrationExpectedInventory) {
    if (!auditFile) missingSources.push(integrationArtifactName ?? "integration-results");
    if (!junitFile) missingSources.push("junit-e2e-integration.xml");
    if (!integrationExpectedInventory) missingSources.push("expected-integration-inventory.json");
    return { ...unknownIntegration(source), missingSources };
  }

  const audit = tryReadJson(auditFile);
  const inventory = tryReadJson(integrationExpectedInventory);
  if (audit.error || inventory.error || !Array.isArray(inventory.value?.suites)) {
    return { ...unknownIntegration(
      source,
      audit.value?.source_head_sha ?? null,
      audit.value?.checkout_sha ?? null,
    ), missingSources: ["integration-execution-audit.json"] };
  }
  const sourceHeadSha = audit.value?.source_head_sha ?? null;
  const checkoutSha = audit.value?.checkout_sha ?? null;
  if (sourceHeadSha !== expectedHeadSha || checkoutSha !== expectedHeadSha) {
    return { ...unknownIntegration(source, sourceHeadSha, checkoutSha), missingSources: ["source/checkout SHA mismatch"] };
  }

  const expectedIdentities = playwrightExpectedIdentities(inventory.value);
  const cases = junitTestCases(fs.readFileSync(junitFile, "utf8"));
  const identities = cases.map(({ identity }) => identity);
  if (
    new Set(expectedIdentities).size !== expectedIdentities.length ||
    new Set(identities).size !== identities.length
  ) {
    return { ...unknownIntegration(source, sourceHeadSha, checkoutSha), missingSources: ["integration JUnit identity coverage"] };
  }
  const expectedSet = new Set(expectedIdentities);
  const actualSet = new Set(identities);
  const missingTests = expectedIdentities.filter((identity) => !actualSet.has(identity)).length;
  const unexpectedTests = identities.filter((identity) => !expectedSet.has(identity)).length;
  const passedTests = cases.filter(({ status }) => status === "passed").length;
  const failedTests = cases.filter(({ status }) => status === "failed").length;
  const skippedTests = cases.filter(({ status }) => status === "skipped").length;
  const failed =
    integrationJobResult === "failure" ||
    audit.value?.test_outcome === "failure" ||
    failedTests > 0 ||
    skippedTests > 0 ||
    missingTests > 0 ||
    unexpectedTests > 0;
  return {
    status: failed ? "fail" : "pass",
    source,
    missingSources,
    summary: {
      jobResult: integrationJobResult,
      junitResult: failedTests > 0 || skippedTests > 0 ? "fail" : "pass",
      expectedSpecs: 3,
      expectedTests: expectedIdentities.length,
      reportedTests: cases.length,
      passedTests,
      failedTests,
      skippedTests,
      sourceHeadSha,
      checkoutSha,
    },
  };
}

export function mergeLaneArtifacts(
  root,
  {
    expectedHeadSha,
    expectedInventory,
    integrationRoot,
    integrationExpectedInventory,
    integrationArtifactName,
    integrationJobResult,
    eventName,
    runId,
    runAttempt,
  } = {},
) {
  if (!expectedHeadSha) throw new Error("expectedHeadSha is required");

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

  const coverageFiles = filesMatching(root, /^deep-e2e-coverage-.*\.json$/);
  const coverage = coverageFiles.map(readJson);
  assertLaneSet(coverage.map((manifest) => manifest.lane), "Coverage manifests");
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
  const junitIdentities = junitFiles.flatMap((file) =>
    junitTestIdentities(fs.readFileSync(file, "utf8")),
  );
  const duplicateTests = junitIdentities.filter(
    (identity, index) => junitIdentities.indexOf(identity) !== index,
  );
  if (duplicateTests.length > 0) {
    throw new Error(`Duplicate JUnit test identity across lanes: ${duplicateTests[0]}`);
  }
  const legacyValidationErrors = [];
  if (junitFiles.length !== DEEP_LANES.length) {
    legacyValidationErrors.push(
      `Expected ${DEEP_LANES.length} JUnit artifacts, found ${junitFiles.length}`,
    );
  }

  const bootstrap = buildBootstrapEvidence(root, expectedHeadSha, runId);
  const didNotRun = buildDidNotRunEvidence({
    expectedInventory,
    junitFiles,
    cancelAudits: bootstrap.cancelAudits,
    runId,
  });
  const trueFlaky = buildTrueFlakyEvidence(root, bootstrap.cancelAudits, runId);
  const integration = buildIntegrationEvidence({
    integrationRoot,
    integrationExpectedInventory,
    integrationArtifactName,
    integrationJobResult,
    eventName,
    expectedHeadSha,
    runId,
  });
  const sourceSha = expectedHeadSha;
  const checkoutShas = [
    ...bootstrap.cancelAudits.map((audit) => audit?.checkout_sha).filter(Boolean),
    integration.summary.checkoutSha,
  ].filter(Boolean);
  const uniqueCheckoutShas = [...new Set(checkoutShas)];
  const checkoutSha = uniqueCheckoutShas.length === 1 ? uniqueCheckoutShas[0] : null;
  const sourceMismatch = checkoutSha !== expectedHeadSha;
  if (
    didNotRun.status === "unknown" ||
    didNotRun.summary.missingTests > 0 ||
    didNotRun.summary.unexpectedTests > 0
  ) {
    legacyValidationErrors.push(
      `JUnit identity coverage mismatch: expected=${didNotRun.summary.expectedTests} actual=${didNotRun.summary.reportedTests} missing=${didNotRun.summary.missingTests} unexpected=${didNotRun.summary.unexpectedTests}`,
    );
  }
  if (["fail", "unknown"].includes(bootstrap.evidence.status)) {
    legacyValidationErrors.push(
      `Bootstrap evidence is ${bootstrap.evidence.status}: failed=${bootstrap.evidence.summary.failedLanes.join(",") || "none"} unknown=${bootstrap.evidence.summary.unknownLanes.join(",") || "none"}`,
    );
  }

  const failures = taxonomies.flatMap((taxonomy) => taxonomy.failures);
  const failureKeys = failures.map((failure) => failure.failureKey);
  if (new Set(failureKeys).size !== failureKeys.length) {
    const duplicate = failureKeys.find(
      (key, index) => failureKeys.indexOf(key) !== index,
    );
    throw new Error(`Duplicate failure key across lanes: ${duplicate}`);
  }

  const generatedAt = new Date().toISOString();
  const taxonomy = {
    schemaVersion: 2,
    status: "available",
    generatedAt,
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
  };
  return {
    taxonomy,
    taxonomyV3: {
      ...taxonomy,
      schemaVersion: 3,
      status: sourceMismatch || [trueFlaky, didNotRun, integration, bootstrap.evidence]
        .some((evidence) => evidence.status === "unknown")
        ? "unknown"
        : [trueFlaky, didNotRun, integration, bootstrap.evidence]
          .some((evidence) => evidence.status === "fail")
          ? "fail"
          : "pass",
      runId: runId ?? null,
      runAttempt: runAttempt ?? process.env.GITHUB_RUN_ATTEMPT ?? null,
      sourceSha,
      checkoutSha,
      sources: [
        ...trueFlaky.source,
        ...didNotRun.source,
        ...integration.source,
        ...bootstrap.evidence.source,
      ],
      missingSources: [
        ...trueFlaky.missingSources,
        ...didNotRun.missingSources,
        ...integration.missingSources,
        ...bootstrap.evidence.missingSources,
        ...(sourceMismatch ? ["sourceSha/checkoutSha"] : []),
      ],
      trueFlaky,
      didNotRun,
      integration,
      bootstrap: bootstrap.evidence,
      formalEvidence: {
        trueFlaky,
        didNotRun,
        integration,
        bootstrap: bootstrap.evidence,
      },
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
      expectedTestCount: didNotRun.summary.expectedTests || null,
      expectedBootstrapRequestFailureCount:
        bootstrap.expectedBootstrapRequestFailureCount,
      duplicateSpecCount: 0,
      duplicateTestIdentityCount: 0,
    },
    legacyValidationErrors,
  };
}

function parseArgs(argv) {
  const options = {
    root: null,
    output: "reports/deep-e2e-taxonomy-union.json",
    v3Output: "reports/deep-e2e-taxonomy-union-v3.json",
    coverageOutput: "reports/deep-e2e-coverage-union.json",
    expectedHeadSha: process.env.SOURCE_HEAD_SHA ?? null,
    expectedInventory: null,
    integrationRoot: null,
    integrationExpectedInventory: null,
    integrationArtifactName: null,
    integrationJobResult: process.env.INTEGRATION_JOB_RESULT ?? null,
    eventName: process.env.GITHUB_EVENT_NAME ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      [
        "--root",
        "--output",
        "--v3-output",
        "--coverage-output",
        "--expected-head-sha",
        "--expected-inventory",
        "--integration-root",
        "--integration-expected-inventory",
        "--integration-artifact-name",
        "--integration-job-result",
        "--event-name",
        "--run-id",
        "--run-attempt",
      ].includes(argument)
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

function writeJson(output, payload) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const merged = mergeLaneArtifacts(path.resolve(options.root), options);
  writeJson(options.output, merged.taxonomy);
  writeJson(options.v3Output, merged.taxonomyV3);
  writeJson(options.coverageOutput, merged.coverage);
  process.stdout.write(`${JSON.stringify(merged.coverage)}\n`);
  if (merged.legacyValidationErrors.length > 0) {
    for (const error of merged.legacyValidationErrors) {
      process.stderr.write(`${error}\n`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
