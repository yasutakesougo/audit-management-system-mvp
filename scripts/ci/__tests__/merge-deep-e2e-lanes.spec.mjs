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
    write(root, `${lane}/deep-cancel-audit.json`, {
      lane,
      head_sha: "head",
      setup_failure_step: "none",
      direct_cancellation: false,
    });
    write(root, `${lane}/bootstrap-diagnostics.json`, {
      error: null,
      pageErrors: [],
      requestFailures: [],
    });
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("mergeLaneArtifacts", () => {
  it("merges six exact-head lanes and verifies coverage", () => {
    const root = artifactFixture();
    const expectedInventory = path.join(root, "expected-inventory.json");
    write(root, "expected-inventory.json", {
      suites: DEEP_LANES.map((lane) => ({
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
    });
    const merged = mergeLaneArtifacts(root, {
      expectedHeadSha: "head",
      expectedInventory,
      runId: "run",
    });

    assert.equal(merged.taxonomy.failed, 1);
    assert.deepEqual(merged.taxonomy.failureKeys, ["failure-app-a11y"]);
    assert.equal(merged.coverage.ownedSpecCount, DEEP_LANES.length);
    assert.equal(merged.coverage.junitTestCount, DEEP_LANES.length);
    assert.equal(merged.coverage.expectedTestCount, DEEP_LANES.length);
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
