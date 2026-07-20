#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

export const COMPARISON_STATUSES = Object.freeze(["PASS", "FAIL", "HOLD"]);

const REASONS = Object.freeze({
  ARTIFACT_MISSING: "ARTIFACT_MISSING",
  SCHEMA_VERSION_INVALID: "SCHEMA_VERSION_INVALID",
  STATUS_UNKNOWN: "STATUS_UNKNOWN",
  INTEGRATION_JUNIT_MISSING: "INTEGRATION_JUNIT_MISSING",
  DID_NOT_RUN: "DID_NOT_RUN",
  BOOTSTRAP_INVALID: "BOOTSTRAP_INVALID",
  SOURCE_CHECKOUT_SHA_MISMATCH: "SOURCE_CHECKOUT_SHA_MISMATCH",
  MISSING_SOURCES: "MISSING_SOURCES",
  NEW_FAILURE_KEYS: "NEW_FAILURE_KEYS",
  TARGET_MANIFEST_INVALID: "TARGET_MANIFEST_INVALID",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, "utf8")), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function reason(status, reasonCodes, details = {}) {
  return { status, reasonCodes: [...new Set(reasonCodes)], ...details };
}

function validateTarget(target) {
  if (!isRecord(target) || target.schemaVersion !== 1 || !Array.isArray(target.failureKeys)) {
    return false;
  }
  return target.failureKeys.every((key) => typeof key === "string");
}

function evidenceStatus(value, name, reasonCodes) {
  if (!isRecord(value) || typeof value.status !== "string") {
    reasonCodes.push(`${name.toUpperCase()}_INVALID`);
    return "invalid";
  }
  return value.status;
}

function buildResult(artifactPath, targetPath, artifact, target, result) {
  return {
    consumer: "formal-deep-v3-comparison",
    artifact: artifactPath,
    target: targetPath,
    schemaVersion: artifact?.schemaVersion ?? null,
    runId: artifact?.runId ?? null,
    status: result.status,
    reasonCodes: result.reasonCodes,
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
    comparison: result.comparison ?? null,
    targetManifest: target
      ? { schemaVersion: target.schemaVersion, failureKeys: target.failureKeys }
      : null,
  };
}

export function compareFormalDeepV3({ artifactPath, targetPath }) {
  const artifactRead = readJson(artifactPath);
  if (artifactRead.error) {
    return buildResult(
      artifactPath,
      targetPath,
      null,
      null,
      reason("HOLD", [REASONS.ARTIFACT_MISSING]),
    );
  }

  const targetRead = readJson(targetPath);
  if (targetRead.error || !validateTarget(targetRead.value)) {
    return buildResult(
      artifactPath,
      targetPath,
      artifactRead.value,
      null,
      reason("HOLD", [REASONS.TARGET_MANIFEST_INVALID]),
    );
  }

  const artifact = artifactRead.value;
  const target = targetRead.value;
  const reasonCodes = [];
  if (!isRecord(artifact) || artifact.schemaVersion !== 3) {
    return buildResult(
      artifactPath,
      targetPath,
      artifact,
      target,
      reason("HOLD", [REASONS.SCHEMA_VERSION_INVALID]),
    );
  }

  if (artifact.status === "unknown") reasonCodes.push(REASONS.STATUS_UNKNOWN);
  if (!Array.isArray(artifact.missingSources)) {
    reasonCodes.push(REASONS.MISSING_SOURCES);
  } else if (artifact.missingSources.length > 0) {
    reasonCodes.push(REASONS.MISSING_SOURCES);
  }

  const trueFlakyStatus = evidenceStatus(artifact.trueFlaky, "trueFlaky", reasonCodes);
  const didNotRunStatus = evidenceStatus(artifact.didNotRun, "didNotRun", reasonCodes);
  const integrationStatus = evidenceStatus(artifact.integration, "integration", reasonCodes);
  const bootstrapStatus = evidenceStatus(artifact.bootstrap, "bootstrap", reasonCodes);

  if (didNotRunStatus === "fail") reasonCodes.push(REASONS.DID_NOT_RUN);
  if (["fail", "invalid"].includes(bootstrapStatus)) reasonCodes.push(REASONS.BOOTSTRAP_INVALID);
  if (bootstrapStatus === "unknown") reasonCodes.push(REASONS.BOOTSTRAP_INVALID);
  if (integrationStatus === "unknown") reasonCodes.push(REASONS.INTEGRATION_JUNIT_MISSING);
  if (
    integrationStatus === "pass" &&
    artifact.integration?.summary?.junitResult !== "pass"
  ) {
    reasonCodes.push(REASONS.INTEGRATION_JUNIT_MISSING);
  }

  if (
    typeof artifact.sourceSha !== "string" ||
    typeof artifact.checkoutSha !== "string" ||
    artifact.sourceSha.length === 0 ||
    artifact.checkoutSha.length === 0 ||
    artifact.sourceSha !== artifact.checkoutSha
  ) {
    reasonCodes.push(REASONS.SOURCE_CHECKOUT_SHA_MISMATCH);
  }

  if (!Array.isArray(artifact.failureKeys) || !artifact.failureKeys.every((key) => typeof key === "string")) {
    reasonCodes.push(REASONS.MISSING_SOURCES);
  }
  const currentKeys = Array.isArray(artifact.failureKeys) ? artifact.failureKeys : [];
  const targetKeys = new Set(target.failureKeys);
  const newFailureKeys = currentKeys.filter((key) => !targetKeys.has(key));
  if (newFailureKeys.length > 0) reasonCodes.push(REASONS.NEW_FAILURE_KEYS);

  const hasExplicitFailure =
    artifact.status === "fail" ||
    trueFlakyStatus === "fail" ||
    didNotRunStatus === "fail" ||
    integrationStatus === "fail" ||
    bootstrapStatus === "fail" ||
    newFailureKeys.length > 0;
  const hasHoldCondition =
    reasonCodes.some((code) =>
      [
        REASONS.STATUS_UNKNOWN,
        REASONS.INTEGRATION_JUNIT_MISSING,
        REASONS.MISSING_SOURCES,
        REASONS.SOURCE_CHECKOUT_SHA_MISMATCH,
      ].includes(code),
    ) || ["unknown", "invalid"].includes(bootstrapStatus);
  const status = hasHoldCondition ? "HOLD" : hasExplicitFailure ? "FAIL" : "PASS";

  return buildResult(
    artifactPath,
    targetPath,
    artifact,
    target,
    reason(status, reasonCodes, {
      comparison: {
        currentFailureKeyCount: currentKeys.length,
        targetFailureKeyCount: target.failureKeys.length,
        newFailureKeys,
      },
    }),
  );
}

function parseArgs(argv) {
  const options = { artifactPath: null, targetPath: null, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--artifact") options.artifactPath = argv[++index];
    else if (value === "--target") options.targetPath = argv[++index];
    else if (value === "--output") options.outputPath = argv[++index];
  }
  return options;
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = compareFormalDeepV3(options);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, serialized);
  }
  process.stdout.write(serialized);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = run();
  process.exitCode = result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2;
}
