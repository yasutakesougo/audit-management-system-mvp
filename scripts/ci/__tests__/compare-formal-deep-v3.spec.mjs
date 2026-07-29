import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareFormalDeepV3, REASONS } from "../compare-formal-deep-v3.mjs";

const fixturePath = path.resolve("scripts/ci/__fixtures__/formal-deep-v3-run-29714201142.json");

function tempCase(targetKeys = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "formal-deep-v3-consumer-"));
  const targetPath = path.join(root, "target.json");
  fs.writeFileSync(targetPath, JSON.stringify({ schemaVersion: 1, failureKeys: targetKeys }));
  return { root, targetPath };
}

function readFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function writeArtifact(root, artifact, name = "artifact.json") {
  const artifactPath = path.join(root, name);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact));
  return artifactPath;
}

function validArtifact() {
  const artifact = readFixture();
  artifact.status = "pass";
  artifact.trueFlaky = { status: "pass", summary: { count: 0, testKeys: [] } };
  artifact.didNotRun = { status: "pass", summary: { count: 0, unit: "test", expected: 1, executed: 1, testKeys: [] } };
  artifact.integration = { status: "pass", summary: { jobResult: "success", junitResult: "pass" } };
  artifact.bootstrap = {
    status: "pass",
    summary: { normalLanes: ["general"], abnormalLanes: [], missingLanes: [] },
  };
  artifact.missingSources = [];
  artifact.failureKeys = [];
  return artifact;
}

function assertStatus(result, expected, reasonCode) {
  assert.equal(result.status, expected);
  if (reasonCode) assert.ok(result.reasonCodes.includes(reasonCode), result.reasonCodes.join(","));
}

test("complete v3 evidence with no failure keys is PASS", () => {
  const { root, targetPath } = tempCase();
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, validArtifact()), targetPath });
  assertStatus(result, "PASS");
  assert.deepEqual(result.comparison, {
    targetManifestKeyCount: 0,
    currentFailureKeyCount: 0,
    targetFailureKeyCount: 0,
    targetFailureKeys: [],
    newFailureKeyCount: 0,
    newFailureKeys: [],
  });
});

test("target failure keys only are FAIL", () => {
  const { root, targetPath } = tempCase(["target-key"]);
  const artifact = validArtifact();
  artifact.failureKeys = ["target-key"];
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assertStatus(result, "FAIL", REASONS.TARGET_FAILURE_KEYS_PRESENT);
  assert.deepEqual(result.comparison.targetFailureKeys, ["target-key"]);
  assert.deepEqual(result.comparison.newFailureKeys, []);
});

test("new failure keys only are FAIL", () => {
  const { root, targetPath } = tempCase(["target-key"]);
  const artifact = validArtifact();
  artifact.failureKeys = ["new-key"];
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assertStatus(result, "FAIL", REASONS.NEW_FAILURE_KEYS);
  assert.deepEqual(result.comparison.targetFailureKeys, []);
  assert.deepEqual(result.comparison.newFailureKeys, ["new-key"]);
});

test("target and new failure keys are separated and FAIL", () => {
  const { root, targetPath } = tempCase(["target-key"]);
  const artifact = validArtifact();
  artifact.failureKeys = ["target-key", "new-key"];
  const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
  assertStatus(result, "FAIL", REASONS.TARGET_FAILURE_KEYS_PRESENT);
  assert.ok(result.reasonCodes.includes(REASONS.NEW_FAILURE_KEYS));
  assert.deepEqual(result.comparison.targetFailureKeys, ["target-key"]);
  assert.deepEqual(result.comparison.newFailureKeys, ["new-key"]);
});

test("PR #2510 fixture remains HOLD with target 0 and new 33", () => {
  const { targetPath } = tempCase();
  const result = compareFormalDeepV3({ artifactPath: fixturePath, targetPath });
  assertStatus(result, "HOLD", REASONS.STATUS_UNKNOWN);
  assert.equal(result.comparison.targetManifestKeyCount, 0);
  assert.equal(result.comparison.targetFailureKeyCount, 0);
  assert.equal(result.comparison.newFailureKeyCount, 33);
  assert.ok(result.reasonCodes.includes(REASONS.INTEGRATION_JUNIT_MISSING));
  assert.ok(result.reasonCodes.includes(REASONS.DID_NOT_RUN));
  assert.equal(result.evidence.sourceSha, result.evidence.checkoutSha);
});

test("missing artifact is distinguished from invalid JSON", () => {
  const { root, targetPath } = tempCase();
  assertStatus(compareFormalDeepV3({ artifactPath: path.join(root, "missing.json"), targetPath }), "HOLD", REASONS.ARTIFACT_MISSING);
  const invalidPath = path.join(root, "invalid.json");
  fs.writeFileSync(invalidPath, "not-json");
  assertStatus(compareFormalDeepV3({ artifactPath: invalidPath, targetPath }), "HOLD", REASONS.ARTIFACT_INVALID);
});

test("invalid missingSources is normalized and never throws", () => {
  const { root, targetPath } = tempCase();
  for (const value of [undefined, "junit-e2e-integration.xml", ["valid", 1]]) {
    const artifact = validArtifact();
    if (value === undefined) delete artifact.missingSources;
    else artifact.missingSources = value;
    const result = compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath });
    assertStatus(result, "HOLD", REASONS.MISSING_SOURCES);
  }
});

test("artifact status is fail-closed", () => {
  const { root, targetPath } = tempCase();
  const missing = validArtifact();
  delete missing.status;
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, missing), targetPath }), "HOLD", REASONS.STATUS_INVALID);
  const invalid = validArtifact();
  invalid.status = "available";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, invalid), targetPath }), "HOLD", REASONS.STATUS_INVALID);
  const unknown = validArtifact();
  unknown.status = "unknown";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, unknown), targetPath }), "HOLD", REASONS.STATUS_UNKNOWN);
  const failed = validArtifact();
  failed.status = "fail";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, failed), targetPath }), "FAIL", REASONS.STATUS_FAILED);
});

test("trueFlaky unknown, malformed, and pass/count mismatch never PASS", () => {
  const { root, targetPath } = tempCase();
  for (const [mutation, expectedReason] of [
    [(artifact) => { artifact.trueFlaky.status = "unknown"; }, REASONS.STATUS_UNKNOWN],
    [(artifact) => { artifact.trueFlaky = "bad"; }, REASONS.TRUE_FLAKY_INVALID],
    [(artifact) => { artifact.trueFlaky.summary.count = 1; }, REASONS.TRUE_FLAKY_INVALID],
  ]) {
    const artifact = validArtifact();
    mutation(artifact);
    assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath }), "HOLD", expectedReason);
  }
  const failed = validArtifact();
  failed.trueFlaky.status = "fail";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, failed), targetPath }), "FAIL", REASONS.TRUE_FLAKY_FAILED);
});

test("didNotRun unknown, malformed, count mismatch, and expected mismatch never PASS", () => {
  const { root, targetPath } = tempCase();
  for (const [mutation, expectedReason] of [
    [(artifact) => { artifact.didNotRun.status = "unknown"; }, REASONS.STATUS_UNKNOWN],
    [(artifact) => { artifact.didNotRun = "bad"; }, REASONS.DID_NOT_RUN_INVALID],
    [(artifact) => { artifact.didNotRun.summary.count = 1; }, REASONS.DID_NOT_RUN_INVALID],
    [(artifact) => { artifact.didNotRun.summary.expected = 2; }, REASONS.DID_NOT_RUN_INVALID],
  ]) {
    const artifact = validArtifact();
    mutation(artifact);
    assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath }), "HOLD", expectedReason);
  }
  const failed = validArtifact();
  failed.didNotRun.status = "fail";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, failed), targetPath }), "FAIL", REASONS.DID_NOT_RUN);
});

test("integration unknown, malformed, job mismatch, junit mismatch, and missing JUnit never PASS", () => {
  const { root, targetPath } = tempCase();
  for (const [mutation, expectedReason] of [
    [(artifact) => { artifact.integration.status = "unknown"; }, REASONS.STATUS_UNKNOWN],
    [(artifact) => { artifact.integration = "bad"; }, REASONS.INTEGRATION_INVALID],
    [(artifact) => { artifact.integration.summary.jobResult = "failure"; }, REASONS.INTEGRATION_INVALID],
    [(artifact) => { artifact.integration.summary.junitResult = "unknown"; }, REASONS.INTEGRATION_INVALID],
    [(artifact) => { artifact.missingSources = ["junit-e2e-integration.xml"]; }, REASONS.MISSING_SOURCES],
  ]) {
    const artifact = validArtifact();
    mutation(artifact);
    assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath }), "HOLD", expectedReason);
  }
  const failed = validArtifact();
  failed.integration.status = "fail";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, failed), targetPath }), "FAIL", REASONS.INTEGRATION_FAILED);
});

test("bootstrap unknown, malformed, abnormal, and missing lanes never PASS", () => {
  const { root, targetPath } = tempCase();
  for (const [mutation, expectedReason] of [
    [(artifact) => { artifact.bootstrap.status = "unknown"; }, REASONS.STATUS_UNKNOWN],
    [(artifact) => { artifact.bootstrap = "bad"; }, REASONS.BOOTSTRAP_INVALID],
    [(artifact) => { artifact.bootstrap.summary.abnormalLanes = ["general"]; }, REASONS.BOOTSTRAP_INVALID],
    [(artifact) => { artifact.bootstrap.summary.missingLanes = ["general"]; }, REASONS.BOOTSTRAP_INVALID],
  ]) {
    const artifact = validArtifact();
    mutation(artifact);
    assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath }), "HOLD", expectedReason);
  }
  const failed = validArtifact();
  failed.bootstrap.status = "fail";
  assertStatus(compareFormalDeepV3({ artifactPath: writeArtifact(root, failed), targetPath }), "FAIL", REASONS.BOOTSTRAP_FAILED);
});

test("invalid failureKeys use FAILURE_KEYS_INVALID and HOLD", () => {
  const { root, targetPath } = tempCase();
  for (const value of ["bad", ["ok", 1]]) {
    const artifact = validArtifact();
    artifact.failureKeys = value;
    assertStatus(
      compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath }),
      "HOLD",
      REASONS.FAILURE_KEYS_INVALID,
    );
  }
});

test("source/check-out SHA mismatch is HOLD", () => {
  const { root, targetPath } = tempCase();
  const artifact = validArtifact();
  artifact.checkoutSha = "different-sha";
  assertStatus(
    compareFormalDeepV3({ artifactPath: writeArtifact(root, artifact), targetPath }),
    "HOLD",
    REASONS.SOURCE_CHECKOUT_SHA_MISMATCH,
  );
});

test("schema v2 is rejected and target manifest remains separate", () => {
  const { root, targetPath } = tempCase();
  const v2 = { schemaVersion: 2, status: "available", failureKeys: [] };
  assertStatus(
    compareFormalDeepV3({ artifactPath: writeArtifact(root, v2), targetPath }),
    "HOLD",
    REASONS.SCHEMA_VERSION_INVALID,
  );
});
