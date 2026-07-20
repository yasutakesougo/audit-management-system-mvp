#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

export const HANDOFF_STATUSES = Object.freeze(["PASS", "FAIL", "HOLD"]);
export const HANDOFF_REASONS = Object.freeze({
  COMPARISON_MISSING: "COMPARISON_MISSING",
  COMPARISON_INVALID: "COMPARISON_INVALID",
  COMPARISON_SCHEMA_INVALID: "COMPARISON_SCHEMA_INVALID",
  SOURCE_CONSUMER_INVALID: "SOURCE_CONSUMER_INVALID",
  STATUS_INVALID: "STATUS_INVALID",
  REASON_CODES_INVALID: "REASON_CODES_INVALID",
  COMPARISON_MISSING_OBJECT: "COMPARISON_MISSING_OBJECT",
  EVIDENCE_MISSING: "EVIDENCE_MISSING",
  MISSING_SOURCES_INVALID: "MISSING_SOURCES_INVALID",
  FAILURE_KEYS_INVALID: "FAILURE_KEYS_INVALID",
  COUNT_MISMATCH: "COUNT_MISMATCH",
  SHA_INVALID: "SHA_INVALID",
  PASS_INCONSISTENT: "PASS_INCONSISTENT",
  FAIL_REASON_MISSING: "FAIL_REASON_MISSING",
});

const STATUS_SET = new Set(HANDOFF_STATUSES);
const FAILURE_REASONS = new Set([
  "STATUS_FAILED",
  "TRUE_FLAKY_FAILED",
  "DID_NOT_RUN",
  "INTEGRATION_FAILED",
  "BOOTSTRAP_FAILED",
  "TARGET_FAILURE_KEYS_PRESENT",
  "NEW_FAILURE_KEYS",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    try {
      return { value: JSON.parse(text), kind: "ok" };
    } catch {
      return { value: null, kind: "invalid" };
    }
  } catch (error) {
    return { value: null, kind: error?.code === "ENOENT" ? "missing" : "invalid" };
  }
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function validCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function validStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeFailureComparison(input, reasons) {
  if (!isRecord(input.comparison)) {
    addReason(reasons, HANDOFF_REASONS.COMPARISON_MISSING_OBJECT);
    return {
      targetManifestKeyCount: 0,
      currentFailureKeyCount: 0,
      targetFailureKeyCount: 0,
      targetFailureKeys: [],
      newFailureKeyCount: 0,
      newFailureKeys: [],
    };
  }

  const comparison = input.comparison;
  const arraysValid = validStringArray(comparison.targetFailureKeys) && validStringArray(comparison.newFailureKeys);
  if (!arraysValid) addReason(reasons, HANDOFF_REASONS.FAILURE_KEYS_INVALID);

  const normalized = {
    targetManifestKeyCount: validCount(comparison.targetManifestKeyCount) ? comparison.targetManifestKeyCount : 0,
    currentFailureKeyCount: validCount(comparison.currentFailureKeyCount) ? comparison.currentFailureKeyCount : 0,
    targetFailureKeyCount: validCount(comparison.targetFailureKeyCount) ? comparison.targetFailureKeyCount : 0,
    targetFailureKeys: arraysValid ? comparison.targetFailureKeys : [],
    newFailureKeyCount: validCount(comparison.newFailureKeyCount) ? comparison.newFailureKeyCount : 0,
    newFailureKeys: arraysValid ? comparison.newFailureKeys : [],
  };

  if (
    !validCount(comparison.targetManifestKeyCount) ||
    !validCount(comparison.currentFailureKeyCount) ||
    !validCount(comparison.targetFailureKeyCount) ||
    !validCount(comparison.newFailureKeyCount) ||
    normalized.targetFailureKeyCount !== normalized.targetFailureKeys.length ||
    normalized.newFailureKeyCount !== normalized.newFailureKeys.length ||
    normalized.currentFailureKeyCount !== normalized.targetFailureKeyCount + normalized.newFailureKeyCount
  ) {
    addReason(reasons, HANDOFF_REASONS.COUNT_MISMATCH);
  }
  return normalized;
}

function normalizeEvidence(input, reasons) {
  if (!isRecord(input.evidence)) {
    addReason(reasons, HANDOFF_REASONS.EVIDENCE_MISSING);
    return { sourceSha: null, checkoutSha: null, missingSources: [] };
  }
  const evidence = input.evidence;
  const missingSources = validStringArray(evidence.missingSources) ? evidence.missingSources : [];
  if (!validStringArray(evidence.missingSources)) addReason(reasons, HANDOFF_REASONS.MISSING_SOURCES_INVALID);
  return {
    sourceSha: typeof evidence.sourceSha === "string" ? evidence.sourceSha : null,
    checkoutSha: typeof evidence.checkoutSha === "string" ? evidence.checkoutSha : null,
    missingSources,
    didNotRun: evidence.didNotRun ?? null,
    integration: evidence.integration ?? null,
  };
}

function normalizeInput(input) {
  const reasons = [];
  const comparison = normalizeFailureComparison(input, reasons);
  const evidence = normalizeEvidence(input, reasons);
  const sourceConsumer = input?.consumer;
  const status = input?.status;

  if (input?.schemaVersion !== 3) addReason(reasons, HANDOFF_REASONS.COMPARISON_SCHEMA_INVALID);
  if (sourceConsumer !== "formal-deep-v3-comparison") addReason(reasons, HANDOFF_REASONS.SOURCE_CONSUMER_INVALID);
  if (!STATUS_SET.has(status)) addReason(reasons, HANDOFF_REASONS.STATUS_INVALID);
  if (!Array.isArray(input?.reasonCodes) || !input.reasonCodes.every((code) => typeof code === "string")) {
    addReason(reasons, HANDOFF_REASONS.REASON_CODES_INVALID);
  }
  const inputReasons = Array.isArray(input?.reasonCodes) && input.reasonCodes.every((code) => typeof code === "string")
    ? input.reasonCodes
    : [];
  const shaValid = typeof evidence.sourceSha === "string" && evidence.sourceSha.length > 0 &&
    typeof evidence.checkoutSha === "string" && evidence.checkoutSha.length > 0 &&
    evidence.sourceSha === evidence.checkoutSha;
  if (!shaValid) addReason(reasons, HANDOFF_REASONS.SHA_INVALID);

  if (status === "PASS") {
    if (inputReasons.length > 0 || comparison.targetFailureKeyCount > 0 || comparison.newFailureKeyCount > 0 || !isRecord(input.comparison) || !shaValid) {
      addReason(reasons, HANDOFF_REASONS.PASS_INCONSISTENT);
    }
  }
  if (status === "FAIL") {
    const hasFailureReason = inputReasons.some((code) => FAILURE_REASONS.has(code));
    const hasFailureKeys = comparison.targetFailureKeyCount > 0 || comparison.newFailureKeyCount > 0;
    if (!hasFailureReason && !hasFailureKeys) addReason(reasons, HANDOFF_REASONS.FAIL_REASON_MISSING);
    if ((hasFailureKeys && !hasFailureReason) || !shaValid) addReason(reasons, HANDOFF_REASONS.FAIL_REASON_MISSING);
  }

  const structurallyInvalid = reasons.length > 0;
  const outputStatus = structurallyInvalid ? "HOLD" : status;
  const allReasons = [...inputReasons, ...reasons];
  return {
    schemaVersion: 1,
    consumer: "formal-deep-v3-handoff",
    sourceConsumer: "formal-deep-v3-comparison",
    runId: input?.runId ?? null,
    status: outputStatus,
    ready: outputStatus === "PASS",
    reasonCodes: [...new Set(allReasons)],
    sourceSha: evidence.sourceSha,
    checkoutSha: evidence.checkoutSha,
    targetManifestKeyCount: comparison.targetManifestKeyCount,
    currentFailureKeyCount: comparison.currentFailureKeyCount,
    targetFailureKeyCount: comparison.targetFailureKeyCount,
    targetFailureKeys: comparison.targetFailureKeys,
    newFailureKeyCount: comparison.newFailureKeyCount,
    newFailureKeys: comparison.newFailureKeys,
    missingSources: evidence.missingSources,
    evidence: {
      didNotRun: evidence.didNotRun,
      integration: evidence.integration,
    },
  };
}

export function buildFormalDeepV3Handoff(input) {
  return normalizeInput(input);
}

export function renderFormalDeepV3HandoffMarkdown(normalized) {
  const lines = [
    "# Formal Deep handoff status",
    "",
    `- status: ${normalized.status}`,
    `- ready: ${normalized.ready}`,
    `- run ID: ${normalized.runId ?? "(unknown)"}`,
    `- source SHA: ${normalized.sourceSha ?? "(unknown)"}`,
    `- checkout SHA: ${normalized.checkoutSha ?? "(unknown)"}`,
    `- reason codes: ${normalized.reasonCodes.join(", ") || "(none)"}`,
    `- target failure key count: ${normalized.targetFailureKeyCount}`,
    `- new failure key count: ${normalized.newFailureKeyCount}`,
    `- target failure keys: ${normalized.targetFailureKeys.join(", ") || "(none)"}`,
    `- new failure keys: ${normalized.newFailureKeys.join(", ") || "(none)"}`,
    `- missing sources: ${normalized.missingSources.join(", ") || "(none)"}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export function exitCodeForHandoffStatus(status) {
  return status === "PASS" ? 0 : status === "FAIL" ? 1 : 2;
}

function parseArgs(argv) {
  const options = { inputPath: null, outputPath: null, markdownPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") options.inputPath = argv[++index];
    else if (argv[index] === "--output") options.outputPath = argv[++index];
    else if (argv[index] === "--markdown-output") options.markdownPath = argv[++index];
  }
  return options;
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const read = readJson(options.inputPath);
  const input = read.kind === "ok" ? read.value : {};
  const normalized = buildFormalDeepV3Handoff(input);
  if (read.kind === "missing") addReason(normalized.reasonCodes, HANDOFF_REASONS.COMPARISON_MISSING);
  if (read.kind === "invalid") addReason(normalized.reasonCodes, HANDOFF_REASONS.COMPARISON_INVALID);
  if (read.kind !== "ok") {
    normalized.status = "HOLD";
    normalized.ready = false;
  }
  const json = `${JSON.stringify(normalized, null, 2)}\n`;
  const markdown = renderFormalDeepV3HandoffMarkdown(normalized);
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, json);
  }
  if (options.markdownPath) {
    fs.mkdirSync(path.dirname(options.markdownPath), { recursive: true });
    fs.writeFileSync(options.markdownPath, markdown);
  }
  process.stdout.write(json);
  return normalized;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = exitCodeForHandoffStatus(run().status);
}
