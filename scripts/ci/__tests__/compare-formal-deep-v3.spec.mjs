import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareFormalDeepV3 } from "../compare-formal-deep-v3.mjs";

const fixturePath = path.resolve("scripts/ci/__fixtures__/formal-deep-v3-run-29714201142.json");

function tempCase() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "formal-deep-v3-consumer-"));
  const targetPath = path.join(root, "target.json");
  fs.writeFileSync(targetPath, JSON.stringify({ schemaVersion: 1, failureKeys: [] }));
  return { root, targetPath };
}

function readFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function writeArtifact(root, artifact) {
  const artifactPath = path.join(root, "artifact.json");
  fs.writeFileSync(artifactPath, JSON.stringify(artifact));
  return artifactPath;
}

function validArtifact() {
  const artifact = readFixture();
  artifact.status = "pass";
  artifact.didNotRun = { status: "pass", summary: { count: 0, unit: "test", expected: 1, executed: 1, testKeys: [] } };
  artifact.integration = { status: "pass", summary: { jobResult: "success", junitResult: "pass" } };
  artifact.missingSources = [];
  artifact.failureKeys = [];
  return artifact;
}

test("accepts a complete schema v3 artifact with no new failure keys", () => {
  const { root, targetPath } = tempCase();
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, validArtifact()), targetPath });
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.comparison.newFailureKeys, []);
});

test("keeps the PR #2510 unknown fixture non-PASS with explicit reasons", () => {
  const { targetPath } = tempCase();
  const result = compareFormalDeepV3({ artifactPath: fixturePath, targetPath });
  assert.equal(result.status, "HOLD");
  assert.ok(result.reasonCodes.includes("STATUS_UNKNOWN"));
  assert.ok(result.reasonCodes.includes("INTEGRATION_JUNIT_MISSING"));
  assert.ok(result.reasonCodes.includes("DID_NOT_RUN"));
  assert.equal(result.comparison.newFailureKeys.length, 33);
});

test("holds when the artifact is missing", () => {
  const { root, targetPath } = tempCase();
  const result = compareFormalDeepV3({ artifactPath: path.join(root, "missing.json"), targetPath });
  assert.equal(result.status, "HOLD");
  assert.deepEqual(result.reasonCodes, ["ARTIFACT_MISSING"]);
});

test("holds when Integration JUnit evidence is missing", () => {
  const { root, targetPath } = tempCase();
  const artifact = validArtifact();
  artifact.integration = { status: "unknown", summary: { jobResult: "success", junitResult: "unknown" } };
  artifact.missingSources = ["junit-e2e-integration.xml"];
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assert.equal(result.status, "HOLD");
  assert.ok(result.reasonCodes.includes("INTEGRATION_JUNIT_MISSING"));
});

test("fails when didNotRun is explicitly failed", () => {
  const { root, targetPath } = tempCase();
  const artifact = validArtifact();
  artifact.didNotRun = { status: "fail", summary: { count: 63, unit: "test", expected: 331, executed: 268, testKeys: [] } };
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assert.equal(result.status, "FAIL");
  assert.ok(result.reasonCodes.includes("DID_NOT_RUN"));
});

test("holds on bootstrap unknown and fails on bootstrap failure", () => {
  const { root, targetPath } = tempCase();
  const unknown = validArtifact();
  unknown.bootstrap = { status: "unknown", summary: {} };
  const unknownResult = compareFormalDeepV3({ artifactPath: writeArtifact(root, unknown), targetPath });
  assert.equal(unknownResult.status, "HOLD");

  const failed = validArtifact();
  failed.bootstrap = { status: "fail", summary: {} };
  const failedResult = compareFormalDeepV3({ artifactPath: writeArtifact(root, failed), targetPath });
  assert.equal(failedResult.status, "FAIL");
});

test("holds on source/check-out SHA mismatch", () => {
  const { root, targetPath } = tempCase();
  const artifact = validArtifact();
  artifact.checkoutSha = "different-sha";
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assert.equal(result.status, "HOLD");
  assert.ok(result.reasonCodes.includes("SOURCE_CHECKOUT_SHA_MISMATCH"));
});

test("rejects schema v2 and keeps v2 artifacts separate", () => {
  const { root, targetPath } = tempCase();
  const v2 = { schemaVersion: 2, status: "available", failureKeys: [] };
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, v2), targetPath });
  assert.equal(result.status, "HOLD");
  assert.deepEqual(result.reasonCodes, ["SCHEMA_VERSION_INVALID"]);
});

test("reports target failure keys separately from new failure keys", () => {
  const { root, targetPath } = tempCase();
  fs.writeFileSync(targetPath, JSON.stringify({ schemaVersion: 1, failureKeys: ["existing"] }));
  const artifact = validArtifact();
  artifact.failureKeys = ["existing", "new-key"];
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assert.equal(result.status, "FAIL");
  assert.deepEqual(result.comparison.newFailureKeys, ["new-key"]);
});
