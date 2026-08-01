import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  mergeLaneArtifacts,
  playwrightExpectedIdentities,
} from "../merge-deep-e2e-lanes.mjs";
import { DEEP_LANES } from "../resolve-deep-e2e-lane.mjs";

const roots = [];

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    typeof content === "string" ? content : `${JSON.stringify(content)}\n`,
  );
}

function expectedInventoryPayload(lanes = DEEP_LANES) {
  return {
    suites: lanes.map((lane) => ({
      title: lane,
      file: lane,
      specs: [
        {
          file: lane,
          title: "test",
          tests: [{ projectName: "chromium" }],
        },
      ],
    })),
  };
}

function resultsPayload(lane, test = {}) {
  return {
    suites: [
      {
        title: lane,
        file: lane,
        specs: [
          {
            file: lane,
            title: "test",
            tests: [
              {
                projectName: "chromium",
                status: "expected",
                results: [{ retry: 0, status: "passed" }],
                ...test,
              },
            ],
          },
        ],
      },
    ],
  };
}

function artifactFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deep-union-"));
  roots.push(root);
  for (const [index, lane] of DEEP_LANES.entries()) {
    const failure =
      index === 0
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
    write(
      root,
      `${lane}/junit-e2e-deep-run-${lane}.xml`,
      `<testsuite tests="1"><testcase classname="${lane}" name="test"/></testsuite>`,
    );
    write(
      root,
      `results-json-deep-run-${lane}/results.json`,
      resultsPayload(lane),
    );
    write(root, `${lane}/deep-cancel-audit.json`, {
      lane,
      head_sha: "head",
      setup_failure_step: "none",
      direct_cancellation: false,
      deep_tests_outcome: failure ? "failure" : "success",
      checkout_sha: "head",
    });
    write(root, `${lane}/bootstrap-${lane}-artifact/bootstrap-diagnostics.json`, {
      error: null,
      pageErrors: [],
      requestFailures:
        lane === "sp-stub"
          ? [
              {
                url: "https://example.sharepoint.com/sites/demo/_api/web",
                errorText: "net::ERR_NAME_NOT_RESOLVED",
              },
            ]
          : [],
    });
  }
  return root;
}

function integrationFixture(root, { outcome = "success", junitBody = "" } = {}) {
  const integrationRoot = path.join(root, "integration");
  write(root, "expected-integration.json", expectedInventoryPayload(["integration"]));
  write(root, "integration/integration-execution-audit.json", {
    source_head_sha: "head",
    checkout_sha: "head",
    test_outcome: outcome,
  });
  write(
    root,
    "integration/junit-e2e-integration.xml",
    `<testsuite tests="1"><testcase classname="integration" name="test">${junitBody}</testcase></testsuite>`,
  );
  return {
    integrationRoot,
    integrationExpectedInventory: path.join(root, "expected-integration.json"),
    integrationJobResult: outcome,
    eventName: "workflow_dispatch",
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("mergeLaneArtifacts", () => {
  it("merges six exact-head lanes and verifies coverage", () => {
    const root = artifactFixture();
    const expectedInventory = path.join(root, "expected-inventory.json");
    write(root, "expected-inventory.json", expectedInventoryPayload());
    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory,
      integrationJobResult: "skipped",
      eventName: "pull_request",
      runId: "run",
    });

    assert.equal(merged.taxonomy.failed, 1);
    assert.equal(merged.taxonomy.schemaVersion, 2);
    assert.deepEqual(merged.taxonomy.failureKeys, ["failure-app-a11y"]);
    assert.equal(merged.taxonomyV3.schemaVersion, 3);
    assert.equal(merged.taxonomyV3.status, "pass");
    assert.equal(merged.taxonomyV3.sourceSha, "head");
    assert.equal(merged.taxonomyV3.checkoutSha, "head");
    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.status, "pass");
    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.status, "pass");
    assert.equal(merged.taxonomyV3.formalEvidence.integration.status, "not_run");
    assert.equal(merged.taxonomyV3.formalEvidence.bootstrap.status, "pass");
    assert.deepEqual(merged.legacyValidationErrors, []);
    assert.deepEqual(merged.taxonomy, {
      schemaVersion: 2,
      status: "available",
      generatedAt: merged.taxonomy.generatedAt,
      metadata: {
        headSha: "head",
        runId: "run",
        lanes: DEEP_LANES,
      },
      failed: 1,
      failures: [
        {
          failureKey: "failure-app-a11y",
          file: "app-a11y.spec.ts",
          title: "app-a11y",
          project: "chromium",
          feature: "unclassified",
          cause: "locator-not-found",
          errorSummary: "not found",
        },
      ],
      featureClassifications: { unclassified: 1 },
      causeClassifications: { "locator-not-found": 1 },
      failureKeys: ["failure-app-a11y"],
    });
    assert.equal(merged.coverage.ownedSpecCount, DEEP_LANES.length);
    assert.equal(merged.coverage.junitTestCount, DEEP_LANES.length);
    assert.equal(merged.coverage.expectedTestCount, DEEP_LANES.length);
    assert.equal(merged.coverage.expectedBootstrapRequestFailureCount, 1);
  });

  it("classifies a fail-to-pass retry as true flaky", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    write(
      root,
      "results-json-deep-run-general/results.json",
      resultsPayload("general", {
        status: "flaky",
        results: [
          { retry: 0, status: "failed" },
          { retry: 1, status: "passed" },
        ],
      }),
    );

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      integrationJobResult: "skipped",
      eventName: "pull_request",
    });

    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.status, "fail");
    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.summary.count, 1);
    assert.deepEqual(merged.taxonomyV3.formalEvidence.trueFlaky.summary.testKeys, [
      "general::test",
    ]);
    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.summary.retryAttempts, 1);
  });

  it("does not classify a consistently failing retried test as true flaky", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    write(
      root,
      "results-json-deep-run-general/results.json",
      resultsPayload("general", {
        status: "unexpected",
        results: [
          { retry: 0, status: "failed" },
          { retry: 1, status: "failed" },
        ],
      }),
    );

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      integrationJobResult: "skipped",
      eventName: "pull_request",
    });

    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.status, "pass");
    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.summary.count, 0);
    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.summary.retryAttempts, 1);
  });

  it("reports unknown true-flaky evidence when a lane result is missing", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    fs.rmSync(path.join(root, "results-json-deep-run-general"), {
      recursive: true,
      force: true,
    });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      integrationJobResult: "skipped",
      eventName: "pull_request",
    });

    assert.equal(merged.taxonomyV3.formalEvidence.trueFlaky.status, "unknown");
  });

  it("reports skipped JUnit identities as did not run", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    write(
      root,
      "general/junit-e2e-deep-run-general.xml",
      '<testsuite tests="1"><testcase classname="general" name="test"><skipped/></testcase></testsuite>',
    );

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      integrationJobResult: "skipped",
      eventName: "pull_request",
    });

    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.status, "fail");
    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.summary.skippedTests, 1);
    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.summary.didNotRunTests, 1);
    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.summary.unit, "test");
    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.summary.count, 1);
    assert.deepEqual(merged.taxonomyV3.formalEvidence.didNotRun.summary.testKeys, [
      "general::test",
    ]);
  });

  it("reports unknown did-not-run evidence when a lane JUnit artifact is missing", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    fs.rmSync(path.join(root, "general/junit-e2e-deep-run-general.xml"));

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      integrationJobResult: "skipped",
      eventName: "pull_request",
    });

    assert.equal(merged.taxonomyV3.formalEvidence.didNotRun.status, "unknown");
    assert.match(merged.legacyValidationErrors[0], /Expected 6 JUnit artifacts/);
  });

  it("classifies exact-head Integration evidence", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    const integration = integrationFixture(root);

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      ...integration,
    });

    assert.equal(merged.taxonomyV3.formalEvidence.integration.status, "pass");
    assert.equal(
      merged.taxonomyV3.formalEvidence.integration.summary.sourceHeadSha,
      "head",
    );
    assert.equal(
      merged.taxonomyV3.formalEvidence.integration.summary.checkoutSha,
      "head",
    );
  });

  it("reports Integration failures and exact-head mismatches distinctly", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    const integration = integrationFixture(root, {
      outcome: "failure",
      junitBody: "<failure/>",
    });
    const failed = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      ...integration,
    });
    assert.equal(failed.taxonomyV3.formalEvidence.integration.status, "fail");

    write(root, "integration/integration-execution-audit.json", {
      source_head_sha: "head",
      checkout_sha: "other-head",
      test_outcome: "success",
    });
    const mismatch = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      ...integration,
      integrationJobResult: "success",
    });
    assert.equal(mismatch.taxonomyV3.formalEvidence.integration.status, "unknown");
  });

  it("reports explicit bootstrap diagnostics failures", () => {
    const root = artifactFixture();
    write(root, "expected-inventory.json", expectedInventoryPayload());
    write(root, "general/bootstrap-general-artifact/bootstrap-diagnostics.json", {
      error: { message: "page did not load" },
      pageErrors: [],
      requestFailures: [],
    });

    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory: path.join(root, "expected-inventory.json"),
      integrationJobResult: "skipped",
      eventName: "pull_request",
    });

    assert.equal(merged.taxonomyV3.formalEvidence.bootstrap.status, "fail");
    assert.deepEqual(merged.taxonomyV3.formalEvidence.bootstrap.summary.failedLanes, [
      "general",
    ]);
    assert.match(merged.legacyValidationErrors[0], /Bootstrap evidence is fail/);
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
    const root = artifactFixture();
    const taxonomy = path.join(
      root,
      "fixture-memory",
      "deep-e2e-taxonomy-run-fixture-memory.json",
    );
    const payload = JSON.parse(fs.readFileSync(taxonomy, "utf8"));
    payload.failed = 1;
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
    payload.failureKeys = ["failure-app-a11y"];
    fs.writeFileSync(taxonomy, `${JSON.stringify(payload)}\n`);

    assert.throws(
      () => mergeLaneArtifacts(root, { expectedHeadSha: "head" }),
      /Duplicate failure key/,
    );
  });
});
