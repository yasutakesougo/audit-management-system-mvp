#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

export const COMPARISON_STATUSES = Object.freeze(["PASS", "FAIL", "HOLD"]);
export const EVIDENCE_STATUSES = Object.freeze(["pass", "fail", "unknown"]);

export const REASONS = Object.freeze({
  ARTIFACT_MISSING: "ARTIFACT_MISSING",
  ARTIFACT_INVALID: "ARTIFACT_INVALID",
  SCHEMA_VERSION_INVALID: "SCHEMA_VERSION_INVALID",
  STATUS_INVALID: "STATUS_INVALID",
  STATUS_FAILED: "STATUS_FAILED",
  STATUS_UNKNOWN: "STATUS_UNKNOWN",
  TRUE_FLAKY_INVALID: "TRUE_FLAKY_INVALID",
  TRUE_FLAKY_FAILED: "TRUE_FLAKY_FAILED",
  DID_NOT_RUN: "DID_NOT_RUN",
  DID_NOT_RUN_INVALID: "DID_NOT_RUN_INVALID",
  INTEGRATION_JUNIT_MISSING: "INTEGRATION_JUNIT_MISSING",
  INTEGRATION_INVALID: "INTEGRATION_INVALID",
  INTEGRATION_FAILED: "INTEGRATION_FAILED",
  BOOTSTRAP_INVALID: "BOOTSTRAP_INVALID",
  BOOTSTRAP_FAILED: "BOOTSTRAP_FAILED",
  SOURCE_CHECKOUT_SHA_MISMATCH: "SOURCE_CHECKOUT_SHA_MISMATCH",
  MISSING_SOURCES: "MISSING_SOURCES",
  FAILURE_KEYS_INVALID: "FAILURE_KEYS_INVALID",
  TARGET_MANIFEST_INVALID: "TARGET_MANIFEST_INVALID",
  TARGET_FAILURE_KEYS_PRESENT: "TARGET_FAILURE_KEYS_PRESENT",
  NEW_FAILURE_KEYS: "NEW_FAILURE_KEYS",
});

const STATUS_SET = new Set(EVIDENCE_STATUSES);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    try {
      return { value: JSON.parse(text), error: null, kind: "ok" };
    } catch (error) {
      return { value: null, error, kind: "invalid" };
    }
  } catch (error) {
    return { value: null, error, kind: error?.code === "ENOENT" ? "missing" : "invalid" };
  }
}

function addReason(reasons, code) {
  if (!reasons.includes(code)) reasons.push(code);
}

function result(status, reasonCodes, details = {}) {
  return { status, reasonCodes: [...new Set(reasonCodes)], ...details };
}

function validateTarget(target) {
  return (
    isRecord(target) &&
    target.schemaVersion === 1 &&
    Array.isArray(target.failureKeys) &&
    target.failureKeys.every((key) => typeof key === "string")
  );
}

function validateStatus(value, invalidReason, reasons) {
  if (!STATUS_SET.has(value)) {
    addReason(reasons, invalidReason);
    return "invalid";
  }
  return value;
}

function validateEvidenceShape(value, invalidReason, reasons) {
  if (!isRecord(value)) {
    addReason(reasons, invalidReason);
    return "invalid";
  }
  const status = validateStatus(value.status, invalidReason, reasons);
  if (status === "unknown") addReason(reasons, REASONS.STATUS_UNKNOWN);
  return status;
}

function buildResult(artifactPath, targetPath, artifact, target, evaluation) {
  return {
    consumer: "formal-deep-v3-comparison",
    artifact: artifactPath,
    target: targetPath,
    schemaVersion: artifact?.schemaVersion ?? null,
    runId: artifact?.runId ?? null,
    status: evaluation.status,
    reasonCodes: evaluation.reasonCodes,
    evidence: {
      status: artifact?.status ?? null,
      trueFlaky: artifact?.trueFlaky ?? null,
      didNotRun: artifact?.didNotRun ?? null,
      integration: artifact?.integration ?? null,
      bootstrap: artifact?.bootstrap ?? null,
      sourceSha: artifact?.sourceSha ?? null,
      checkoutSha: artifact?.checkoutSha ?? null,
      missingSources: artifact?.missingSources ?? null,
      failureKeys: artifact?.failureKeys ?? null,
    },
    comparison: evaluation.comparison ?? null,
    targetManifest: target
      ? { schemaVersion: target.schemaVersion, failureKeys: target.failureKeys }
      : null,
  };
}

function earlyResult(artifactPath, targetPath, artifact, target, status, reasonCode) {
  return buildResult(artifactPath, targetPath, artifact, target, result(status, [reasonCode]));
}

export function compareFormalDeepV3({ artifactPath, targetPath }) {
  const artifactRead = readJson(artifactPath);
  if (artifactRead.kind === "missing") {
    return earlyResult(artifactPath, targetPath, null, null, "HOLD", REASONS.ARTIFACT_MISSING);
  }
  if (artifactRead.kind === "invalid") {
    return earlyResult(artifactPath, targetPath, null, null, "HOLD", REASONS.ARTIFACT_INVALID);
  }

  const targetRead = readJson(targetPath);
  if (targetRead.kind !== "ok" || !validateTarget(targetRead.value)) {
    return earlyResult(
      artifactPath,
      targetPath,
      artifactRead.value,
      null,
      "HOLD",
      REASONS.TARGET_MANIFEST_INVALID,
    );
  }

  const artifact = artifactRead.value;
  const target = targetRead.value;
  if (!isRecord(artifact) || artifact.schemaVersion !== 3) {
    return earlyResult(
      artifactPath,
      targetPath,
      artifact,
      target,
      "HOLD",
      REASONS.SCHEMA_VERSION_INVALID,
    );
  }

  const reasons = [];
  const artifactStatus = validateStatus(artifact.status, REASONS.STATUS_INVALID, reasons);
  if (artifactStatus === "unknown") addReason(reasons, REASONS.STATUS_UNKNOWN);

  const missingSourcesValid =
    Array.isArray(artifact.missingSources) &&
    artifact.missingSources.every((item) => typeof item === "string");
  const missingSources = missingSourcesValid ? artifact.missingSources : [];
  if (!missingSourcesValid) {
    addReason(reasons, REASONS.MISSING_SOURCES);
  } else if (missingSources.length > 0) {
    addReason(reasons, REASONS.MISSING_SOURCES);
  }

  const trueFlakyStatus = validateEvidenceShape(artifact.trueFlaky, REASONS.TRUE_FLAKY_INVALID, reasons);
  const didNotRunStatus = validateEvidenceShape(artifact.didNotRun, REASONS.DID_NOT_RUN_INVALID, reasons);
  const integrationStatus = validateEvidenceShape(artifact.integration, REASONS.INTEGRATION_INVALID, reasons);
  const bootstrapStatus = validateEvidenceShape(artifact.bootstrap, REASONS.BOOTSTRAP_INVALID, reasons);

  if (artifactStatus === "fail") addReason(reasons, REASONS.STATUS_FAILED);
  if (trueFlakyStatus === "fail") addReason(reasons, REASONS.TRUE_FLAKY_FAILED);

  if (trueFlakyStatus === "pass") {
    const summary = artifact.trueFlaky.summary;
    if (!isRecord(summary) || summary.count !== 0) addReason(reasons, REASONS.TRUE_FLAKY_INVALID);
  }

  if (didNotRunStatus === "pass") {
    const summary = artifact.didNotRun.summary;
    if (
      !isRecord(summary) ||
      summary.count !== 0 ||
      summary.unit !== "test" ||
      !Number.isInteger(summary.expected) ||
      !Number.isInteger(summary.executed) ||
      summary.expected !== summary.executed
    ) {
      addReason(reasons, REASONS.DID_NOT_RUN_INVALID);
    }
  } else if (didNotRunStatus === "fail") {
    addReason(reasons, REASONS.DID_NOT_RUN);
  }
  if (integrationStatus === "fail") addReason(reasons, REASONS.INTEGRATION_FAILED);

  if (integrationStatus === "pass") {
    const summary = artifact.integration.summary;
    if (!isRecord(summary) || summary.jobResult !== "success" || summary.junitResult !== "pass") {
      addReason(reasons, REASONS.INTEGRATION_INVALID);
    }
    if (missingSources.includes("junit-e2e-integration.xml")) {
      addReason(reasons, REASONS.INTEGRATION_JUNIT_MISSING);
    }
  } else if (integrationStatus === "unknown") {
    addReason(reasons, REASONS.INTEGRATION_JUNIT_MISSING);
  }

  if (bootstrapStatus === "pass") {
    const summary = artifact.bootstrap.summary;
    if (
      !isRecord(summary) ||
      !Array.isArray(summary.normalLanes) ||
      !Array.isArray(summary.abnormalLanes) ||
      !Array.isArray(summary.missingLanes) ||
      summary.abnormalLanes.length !== 0 ||
      summary.missingLanes.length !== 0
    ) {
      addReason(reasons, REASONS.BOOTSTRAP_INVALID);
    }
  } else if (bootstrapStatus === "unknown" || bootstrapStatus === "invalid") {
    addReason(reasons, REASONS.BOOTSTRAP_INVALID);
  }
  if (bootstrapStatus === "fail") addReason(reasons, REASONS.BOOTSTRAP_FAILED);

  if (
    typeof artifact.sourceSha !== "string" ||
    typeof artifact.checkoutSha !== "string" ||
    artifact.sourceSha.length === 0 ||
    artifact.checkoutSha.length === 0 ||
    artifact.sourceSha !== artifact.checkoutSha
  ) {
    addReason(reasons, REASONS.SOURCE_CHECKOUT_SHA_MISMATCH);
  }

  const failureKeysValid = Array.isArray(artifact.failureKeys) && artifact.failureKeys.every((key) => typeof key === "string");
  if (!failureKeysValid) addReason(reasons, REASONS.FAILURE_KEYS_INVALID);
  const currentFailureKeys = failureKeysValid ? artifact.failureKeys : [];
  const targetKeySet = new Set(target.failureKeys);
  const targetFailureKeys = currentFailureKeys.filter((key) => targetKeySet.has(key));
  const newFailureKeys = currentFailureKeys.filter((key) => !targetKeySet.has(key));
  if (targetFailureKeys.length > 0) addReason(reasons, REASONS.TARGET_FAILURE_KEYS_PRESENT);
  if (newFailureKeys.length > 0) addReason(reasons, REASONS.NEW_FAILURE_KEYS);

  const holdReasons = new Set([
    REASONS.ARTIFACT_INVALID,
    REASONS.STATUS_INVALID,
    REASONS.STATUS_UNKNOWN,
    REASONS.TRUE_FLAKY_INVALID,
    REASONS.DID_NOT_RUN_INVALID,
    REASONS.INTEGRATION_INVALID,
    REASONS.BOOTSTRAP_INVALID,
    REASONS.INTEGRATION_JUNIT_MISSING,
    REASONS.SOURCE_CHECKOUT_SHA_MISMATCH,
    REASONS.MISSING_SOURCES,
    REASONS.FAILURE_KEYS_INVALID,
  ]);
  const hasHoldCondition = reasons.some((code) => holdReasons.has(code)) ||
    [artifactStatus, trueFlakyStatus, didNotRunStatus, integrationStatus, bootstrapStatus].includes("invalid");
  const hasExplicitFailure = [artifactStatus, trueFlakyStatus, didNotRunStatus, integrationStatus, bootstrapStatus].includes("fail") ||
    targetFailureKeys.length > 0 || newFailureKeys.length > 0;
  const status = hasHoldCondition ? "HOLD" : hasExplicitFailure ? "FAIL" : "PASS";

  return buildResult(
    artifactPath,
    targetPath,
    artifact,
    target,
    result(status, reasons, {
      comparison: {
        targetManifestKeyCount: target.failureKeys.length,
        currentFailureKeyCount: currentFailureKeys.length,
        targetFailureKeyCount: targetFailureKeys.length,
        targetFailureKeys,
        newFailureKeyCount: newFailureKeys.length,
        newFailureKeys,
      },
    }),
  );
}

function parseArgs(argv) {
  const options = { artifactPath: null, targetPath: null, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--artifact") options.artifactPath = argv[++index];
    else if (argv[index] === "--target") options.targetPath = argv[++index];
    else if (argv[index] === "--output") options.outputPath = argv[++index];
  }
  return options;
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const output = compareFormalDeepV3(options);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, serialized);
  }
  process.stdout.write(serialized);
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = run();
  process.exitCode = output.status === "PASS" ? 0 : output.status === "FAIL" ? 1 : 2;
}
