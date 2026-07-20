import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  collectTrueFlaky,
  mergeLaneArtifacts,
  playwrightExpectedIdentities,
} from "../merge-deep-e2e-lanes.mjs";
import { DEEP_LANES } from "../resolve-deep-e2e-lane.mjs";

const roots = [];

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof content === "string" ? content : `${JSON.stringify(content)}\n`);
}

function defaultSpec() {
  return {
    suites: [
      {
        title: "tests/e2e/integration.spec.ts",
        file: "tests/e2e/integration.spec.ts",
        specs: [
          {
            file: "tests/e2e/integration.spec.ts",
            title: "integration case",
            tests: [
              {
                testId: "t0",
                title: "integration case",
                projectName: "chromium",
                results: [
                  {
                    status: "passed",
                    retry: 0,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function writePlaywrightResult(root, lane, specName, attempts = ["passed"]) {
  const entries = attempts.map((status, index) => ({ status, retry: index }));
  const report = {
    suites: [
      {
        title: "suite",
        file: `${lane}/${specName}.spec.ts`,
        specs: [
          {
            title: specName,
            file: `${lane}/${specName}.spec.ts`,
            tests: [
              {
                projectName: "chromium",
                title: specName,
                testId: `${lane}-${specName}`,
                results: entries,
              },
            ],
          },
        ],
      },
    ],
  };
  write(root, `${lane}/test-results/results.json`, report);
}

function artifactFixture({ includeIntegration = false, includeExpectedInventory = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deep-union-"));
  roots.push(root);

  for (const lane of DEEP_LANES) {
    const failure =
      lane === "app-a11y"
        ? {
            failureKey: `failure-${lane}`,
            file: `${lane}.spec.ts`,
            title: lane,
            project: "chromium",
            feature: "unclassified",
            cause: "locator-not-found",
            errorSummary: "not found",
          }
        : null;

    write(root, `${lane}/deep-e2e-taxonomy-run-${lane}.json`, {
      schemaVersion: 2,
      status: "available",
      metadata: { lane, headSha: "head" },
      failed: failure ? 1 : 0,
      failures: failure ? [failure] : [],
      failureKeys: failure ? [failure.failureKey] : [],
      featureClassifications: failure ? { unclassified: 1 } : {},
      causeClassifications: failure ? { "locator-not-found": 1 } : {},
    });
    write(root, `${lane}/deep-e2e-coverage-run-${lane}.json`, {
      schemaVersion: 1,
      lane,
      sourceHeadSha: "head",
      allSpecCount: DEEP_LANES.length,
      allSpecsDigest: "digest",
      files: [`tests/e2e/${lane}.spec.ts`],
    });
    write(root, `${lane}/junit-e2e-deep-run-${lane}.xml`, `
<testsuite tests="1">
  <testcase classname="${lane}.spec.ts" name="spec"/>
</testsuite>`);
    write(root, `${lane}/deep-cancel-audit.json`, {
      lane,
      head_sha: "head",
      setup_failure_step: "none",
      direct_cancellation: false,
      deep_tests_outcome: "success",
    });
    write(root, `${lane}/bootstrap-${lane}-artifact/bootstrap-diagnostics.json`, {
      error: null,
      pageErrors: [],
      requestFailures: [],
      console: [],
      bodyHtml: `<body>${lane}</body>`,
      rootHtml: `<div>${lane}</div>`,
      documentHtml: `<html>${lane}</html>`,
      runtimeFlags: {
        VITE_DATA_PROVIDER: "memory",
        VITE_SKIP_SHAREPOINT: "1",
        VITE_FORCE_SHAREPOINT: "0",
        VITE_E2E: "1",
      },
    });
    writePlaywrightResult(root, lane, "base", ["passed"]);
  }

  if (includeIntegration) {
    write(root, `integration-status.json`, {
      run_id: "run",
      run_attempt: 1,
      integration_tests_outcome: "success",
      job_outcome: "success",
    });
  }

  const expectedInventory = path.join(root, "expected-inventory.json");
  if (includeExpectedInventory) {
    write(
      root,
      "expected-inventory.json",
      {
        suites: DEEP_LANES.map((lane) => ({
          title: `${lane}.spec.ts`,
          file: `${lane}.spec.ts`,
          specs: [
            {
              file: `${lane}.spec.ts`,
              title: "spec",
              tests: [{ projectName: "chromium" }],
            },
          ],
        })),
      },
    );
  }

  return { root, expectedInventory };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("mergeLaneArtifacts", () => {
  it("derives trueFlaky from first-fail to retry-pass", () => {
    const { root, expectedInventory } = artifactFixture();
    writePlaywrightResult(root, "app-a11y", "base", ["failed", "passed"]);

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory,
      runId: "run",
    });

    assert.equal(merged.taxonomy.failed, 1);
    assert.deepEqual(merged.taxonomy.failureKeys, ["failure-app-a11y"]);
    assert.equal(merged.formalMetrics.trueFlaky, 1);
    assert.equal(merged.formalMetrics.integration, "UNKNOWN");
    assert.equal(merged.formalMetrics.bootstrap, "normal");
    assert.equal(merged.formalMetrics.didNotRun, 0);
  });

  it("does not count flaky when first attempt failed and retry also failed", () => {
    const { root, expectedInventory } = artifactFixture();
    writePlaywrightResult(root, "app-a11y", "base", ["failed", "failed"]);

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory,
    });

    assert.equal(merged.formalMetrics.trueFlaky, 0);
  });

  it("accepts duplicate lane test-results artifacts without over-counting", () => {
    const { root, expectedInventory } = artifactFixture();
    writePlaywrightResult(root, "app-a11y", "base", ["failed", "passed"]);
    write(root, "app-a11y/test-results/extra/results.json", defaultSpec());

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory,
    });

    assert.equal(merged.formalMetrics.trueFlaky, 1);
  });

  it("maps integration success from job result argument", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      integrationResult: "success",
    });

    assert.equal(merged.formalMetrics.integration, "PASS");
  });

  it("maps integration failure from integration status artifact", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false, includeIntegration: true });
    write(root, "integration-status.json", {
      integration_tests_outcome: "failure",
      job_outcome: "failure",
    });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.integration, "FAIL");
  });

  it("maps integration skipped", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    write(root, "integration-status.json", {
      integration_tests_outcome: "skipped",
      job_outcome: "skipped",
    });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.integration, "NOT_RUN");
  });

  it("maps integration cancelled", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    write(root, "integration-status.json", {
      integration_tests_outcome: "cancelled",
      job_outcome: "cancelled",
    });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.integration, "NOT_RUN");
  });

  it("marks integration UNKNOWN when status artifact is missing", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.integration, "UNKNOWN");
    assert.equal(merged.formalMetrics.status, "partial");
  });

  it("keeps bootstrap normal when diagnostics are healthy", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      integrationResult: "success",
    });

    assert.equal(merged.formalMetrics.bootstrap, "normal");
    assert.equal(merged.formalMetrics.status, "available");
  });

  it("marks bootstrap abnormal when page errors exist", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const bootstrap = path.join(root, "app-a11y/bootstrap-app-a11y-artifact/bootstrap-diagnostics.json");
    const payload = JSON.parse(fs.readFileSync(bootstrap, "utf8"));
    payload.pageErrors = [{ name: "Error", message: "boom" }];
    write(root, "app-a11y/bootstrap-app-a11y-artifact/bootstrap-diagnostics.json", payload);

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      integrationResult: "success",
    });

    assert.equal(merged.formalMetrics.bootstrap, "abnormal");
    assert.equal(merged.formalMetrics.status, "available");
  });

  it("marks bootstrap unknown when diagnostics are missing", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    fs.rmSync(path.join(root, "app-a11y/bootstrap-app-a11y-artifact/bootstrap-diagnostics.json"), {
      force: true,
    });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.bootstrap, "unknown");
    assert.equal(merged.formalMetrics.status, "partial");
  });

  it("returns didNotRun zero when no skipped/cancelled lanes", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.didNotRun, 0);
    assert.equal(merged.formalMetrics.didNotRunUnit, "lane");
  });

  it("counts didNotRun lanes", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const payloadPath = path.join(root, "fixture-memory/deep-cancel-audit.json");
    const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
    payload.deep_tests_outcome = "skipped";
    write(root, "fixture-memory/deep-cancel-audit.json", payload);

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.didNotRun, 1);
  });

  it("marks trueFlaky unavailable when test result artifact is missing", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    fs.rmSync(path.join(root, "app-a11y/test-results/results.json"), { force: true });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
    });

    assert.equal(merged.formalMetrics.trueFlaky, "unavailable");
  });

  it("collectTrueFlaky helper detects failure-to-pass transition", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "deep-flaky-helper-"));
    roots.push(root);
    const file = path.join(root, "lane", "test-results", "results.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({
      suites: [
        {
          title: "suite",
          file: "lane/suite.spec.ts",
          specs: [
            {
              file: "lane/suite.spec.ts",
              title: "sample",
              tests: [
                {
                  projectName: "chromium",
                  title: "sample",
                  results: [
                    { status: "failed", retry: 0 },
                    { status: "cancelled", retry: 1 },
                    { status: "passed", retry: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })}\n`);

    const grouped = new Map([
      ["app-a11y", [file]],
      ["fixture-memory", []],
      ["sp-stub", []],
      ["transport-date-check", []],
      ["implementation-hot", []],
      ["general", []],
    ]);

    const result = collectTrueFlaky(grouped);

    assert.equal(result.value, "unavailable");
  });

  it("derives JUnit-compatible identities from Playwright list JSON", () => {
    const identities = playwrightExpectedIdentities({
      suites: [
        {
          title: "flow.spec.ts",
          file: "flow.spec.ts",
          suites: [
            {
              title: "Flow",
              specs: [
                {
                  file: "flow.spec.ts",
                  title: "works",
                  tests: [{ projectName: "chromium" }],
                },
              ],
            },
          ],
        },
      ],
    });

    assert.deepEqual(identities, ["flow.spec.ts::Flow › works"]);
  });

  it("rejects duplicate failure keys across lanes", () => {
    const { root } = artifactFixture({ includeExpectedInventory: false });
    const taxonomy = path.join(root, "fixture-memory/deep-e2e-taxonomy-run-fixture-memory.json");
    const payload = JSON.parse(fs.readFileSync(taxonomy, "utf8"));
    payload.failures = [
      {
        failureKey: "failure-app-a11y",
        file: "fixture.spec.ts",
        title: "fixture",
        project: "chromium",
        feature: "unclassified",
        cause: "locator-not-found",
        errorSummary: "not found",
      },
    ];
    payload.failed = 1;
    payload.failureKeys = ["failure-app-a11y"];
    write(root, "fixture-memory/deep-e2e-taxonomy-run-fixture-memory.json", payload);

    assert.throws(
      () => mergeLaneArtifacts(root, { expectedHeadSha: "head" }),
      /Duplicate failure key across lanes/,
    );
  });
});
