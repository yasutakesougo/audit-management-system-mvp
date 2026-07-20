import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildFormalDeepV3Handoff,
  exitCodeForHandoffStatus,
  renderFormalDeepV3HandoffMarkdown,
} from "../build-formal-deep-v3-handoff.mjs";
import { compareFormalDeepV3 } from "../compare-formal-deep-v3.mjs";

const root = path.resolve(import.meta.dirname, "..");
const fixturePath = (name) => path.join(root, "__fixtures__", name);
const scriptPath = path.join(root, "build-formal-deep-v3-handoff.mjs");

function readFixture(name) {
  return JSON.parse(fs.readFileSync(fixturePath(name), "utf8"));
}

function withTempDir(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "formal-deep-handoff-"));
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function runCli(inputPath, directory) {
  const outputPath = path.join(directory, "result.json");
  const markdownPath = path.join(directory, "result.md");
  const result = spawnSync(process.execPath, [
    scriptPath,
    "--input", inputPath,
    "--output", outputPath,
    "--markdown-output", markdownPath,
  ], { encoding: "utf8" });
  return {
    ...result,
    output: JSON.parse(fs.readFileSync(outputPath, "utf8")),
    markdown: fs.readFileSync(markdownPath, "utf8"),
  };
}

test("PASS comparison becomes ready with exit code 0", () => {
  const result = buildFormalDeepV3Handoff(readFixture("formal-deep-v3-comparison-pass.json"));
  assert.equal(result.status, "PASS");
  assert.equal(result.ready, true);
  assert.equal(exitCodeForHandoffStatus(result.status), 0);
  assert.equal(result.sourceConsumer, "formal-deep-v3-comparison");
});

test("FAIL comparison preserves target and new keys with exit code 1", () => {
  const result = buildFormalDeepV3Handoff(readFixture("formal-deep-v3-comparison-fail.json"));
  assert.equal(result.status, "FAIL");
  assert.equal(result.ready, false);
  assert.equal(exitCodeForHandoffStatus(result.status), 1);
  assert.deepEqual(result.targetFailureKeys, ["target-key"]);
  assert.deepEqual(result.newFailureKeys, ["new-key"]);
});

test("PR 2510 comparison fixture remains HOLD with its evidence", () => {
  const result = buildFormalDeepV3Handoff(readFixture("formal-deep-v3-comparison-hold-29714201142.json"));
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(exitCodeForHandoffStatus(result.status), 2);
  assert.equal(result.targetFailureKeyCount, 0);
  assert.equal(result.newFailureKeyCount, 33);
  assert.equal(result.sourceSha, result.checkoutSha);
  assert.deepEqual(result.missingSources, ["junit-e2e-integration.xml"]);
  assert.equal(result.evidence.didNotRun.summary.count, 63);
});

test("missing comparison file and broken JSON become HOLD without throwing", () => {
  withTempDir((directory) => {
    const missing = runCli(path.join(directory, "missing.json"), directory);
    assert.equal(missing.status, 2);
    assert.equal(missing.output.status, "HOLD");
    assert.equal(missing.output.ready, false);
    assert.ok(missing.output.reasonCodes.includes("COMPARISON_MISSING"));

    const brokenPath = path.join(directory, "broken.json");
    fs.writeFileSync(brokenPath, "{broken");
    const broken = runCli(brokenPath, directory);
    assert.equal(broken.output.status, "HOLD");
    assert.equal(broken.output.ready, false);
    assert.ok(broken.output.reasonCodes.includes("COMPARISON_INVALID"));
  });
});

test("valid JSON roots that are not objects become HOLD with exit code 2", () => {
  withTempDir((directory) => {
    for (const [name, value] of [["null", null], ["array", []], ["string", "text"], ["number", 7], ["boolean", true]]) {
      const inputPath = path.join(directory, `${name}.json`);
      fs.writeFileSync(inputPath, JSON.stringify(value));
      const result = runCli(inputPath, directory);
      assert.equal(result.status, 2);
      assert.equal(result.output.status, "HOLD");
      assert.equal(result.output.ready, false);
      assert.ok(result.output.reasonCodes.includes("COMPARISON_ROOT_INVALID"));
    }
  });
});

test("invalid source consumer, SHA mismatch, and PASS inconsistencies are HOLD", () => {
  const base = readFixture("formal-deep-v3-comparison-pass.json");
  const badConsumer = buildFormalDeepV3Handoff({ ...base, consumer: "other" });
  assert.equal(badConsumer.status, "HOLD");
  assert.ok(badConsumer.reasonCodes.includes("SOURCE_CONSUMER_INVALID"));

  const badSha = buildFormalDeepV3Handoff({
    ...base,
    evidence: { ...base.evidence, checkoutSha: "different" },
  });
  assert.equal(badSha.status, "HOLD");
  assert.ok(badSha.reasonCodes.includes("SHA_INVALID"));

  const passReason = buildFormalDeepV3Handoff({ ...base, reasonCodes: ["NEW_FAILURE_KEYS"] });
  assert.equal(passReason.status, "HOLD");
  assert.equal(passReason.ready, false);

  const passKey = buildFormalDeepV3Handoff({
    ...base,
    comparison: { ...base.comparison, currentFailureKeyCount: 1, newFailureKeyCount: 1, newFailureKeys: ["new-key"] },
  });
  assert.equal(passKey.status, "HOLD");
});

test("count mismatch and missing FAIL reason are HOLD", () => {
  const base = readFixture("formal-deep-v3-comparison-fail.json");
  const mismatch = buildFormalDeepV3Handoff({
    ...base,
    comparison: { ...base.comparison, newFailureKeyCount: 2 },
  });
  assert.equal(mismatch.status, "HOLD");
  assert.ok(mismatch.reasonCodes.includes("COUNT_MISMATCH"));

  const noReason = buildFormalDeepV3Handoff({
    ...base,
    status: "FAIL",
    reasonCodes: [],
    comparison: {
      ...base.comparison,
      targetManifestKeyCount: 0,
      currentFailureKeyCount: 0,
      targetFailureKeyCount: 0,
      targetFailureKeys: [],
      newFailureKeyCount: 0,
      newFailureKeys: [],
    },
  });
  assert.equal(noReason.status, "HOLD");
  assert.ok(noReason.reasonCodes.includes("FAIL_REASON_MISSING"));
});

test("invalid schema, status, and reason code structures are HOLD", () => {
  const base = readFixture("formal-deep-v3-comparison-pass.json");
  for (const input of [
    { ...base, schemaVersion: 2 },
    { ...base, status: "UNKNOWN" },
    { ...base, reasonCodes: "NEW_FAILURE_KEYS" },
  ]) {
    const result = buildFormalDeepV3Handoff(input);
    assert.equal(result.status, "HOLD");
    assert.equal(result.ready, false);
  }
});

test("missing comparison and evidence objects are HOLD", () => {
  const base = readFixture("formal-deep-v3-comparison-pass.json");
  const missingComparison = buildFormalDeepV3Handoff({ ...base, comparison: undefined });
  assert.equal(missingComparison.status, "HOLD");
  assert.ok(missingComparison.reasonCodes.includes("COMPARISON_MISSING_OBJECT"));

  const missingEvidence = buildFormalDeepV3Handoff({ ...base, evidence: undefined });
  assert.equal(missingEvidence.status, "HOLD");
  assert.ok(missingEvidence.reasonCodes.includes("EVIDENCE_MISSING"));
});

test("invalid failure key arrays are HOLD with a dedicated reason", () => {
  const base = readFixture("formal-deep-v3-comparison-pass.json");
  const result = buildFormalDeepV3Handoff({
    ...base,
    comparison: { ...base.comparison, targetFailureKeys: ["valid", 3] },
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.reasonCodes.includes("FAILURE_KEYS_INVALID"));
});

test("failure-key partition duplicates and manifest overflow are HOLD", () => {
  const base = readFixture("formal-deep-v3-comparison-fail.json");
  const cases = [
    {
      ...base.comparison,
      targetFailureKeyCount: 2,
      targetFailureKeys: ["target-key", "target-key"],
      currentFailureKeyCount: 2,
      newFailureKeyCount: 0,
      newFailureKeys: [],
    },
    {
      ...base.comparison,
      targetManifestKeyCount: 1,
      targetFailureKeyCount: 2,
      targetFailureKeys: ["target-a", "target-b"],
      currentFailureKeyCount: 2,
      newFailureKeyCount: 0,
      newFailureKeys: [],
    },
    {
      ...base.comparison,
      targetFailureKeyCount: 1,
      targetFailureKeys: ["same-key"],
      currentFailureKeyCount: 2,
      newFailureKeyCount: 1,
      newFailureKeys: ["same-key"],
    },
    {
      ...base.comparison,
      targetManifestKeyCount: 0,
      targetFailureKeyCount: 1,
      targetFailureKeys: ["target-key"],
      currentFailureKeyCount: 1,
      newFailureKeyCount: 0,
      newFailureKeys: [],
    },
  ];
  for (const comparison of cases) {
    const result = buildFormalDeepV3Handoff({ ...base, comparison });
    assert.equal(result.status, "HOLD");
    assert.ok(result.reasonCodes.includes("FAILURE_KEY_PARTITION_INVALID"));
  }
});

test("HOLD comparison preserves reasons and evidence", () => {
  const input = readFixture("formal-deep-v3-comparison-hold-29714201142.json");
  const result = buildFormalDeepV3Handoff(input);
  for (const reason of input.reasonCodes) assert.ok(result.reasonCodes.includes(reason));
  assert.deepEqual(result.evidence.integration, input.evidence.integration);
  assert.deepEqual(result.evidence.didNotRun, input.evidence.didNotRun);
  assert.deepEqual(result.evidence.status, input.evidence.status);
  assert.deepEqual(result.evidence.trueFlaky, input.evidence.trueFlaky);
  assert.deepEqual(result.evidence.bootstrap, input.evidence.bootstrap);
  assert.deepEqual(result.evidence.failureKeys, input.evidence.failureKeys);
});

test("PR 2510 handoff keys exactly match the real comparison consumer output", () => {
  const rawPath = path.join(root, "__fixtures__", "formal-deep-v3-run-29714201142.json");
  withTempDir((directory) => {
    const targetPath = path.join(directory, "target.json");
    fs.writeFileSync(targetPath, JSON.stringify({ schemaVersion: 1, failureKeys: [] }));
    const comparison = compareFormalDeepV3({ artifactPath: rawPath, targetPath });
    const fixture = readFixture("formal-deep-v3-comparison-hold-29714201142.json");
    assert.deepEqual(fixture.comparison, comparison.comparison);
    assert.deepEqual(fixture.evidence, comparison.evidence);
    const handoff = buildFormalDeepV3Handoff(comparison);
    assert.equal(handoff.status, "HOLD");
    assert.equal(handoff.targetFailureKeyCount, 0);
    assert.equal(handoff.newFailureKeyCount, 33);
    assert.deepEqual(handoff.newFailureKeys, comparison.comparison.newFailureKeys);
    assert.equal(handoff.sourceSha, handoff.checkoutSha);
    assert.equal(handoff.evidence.didNotRun.summary.count, 63);
  });
});

test("FAIL with a target key remains FAIL when the failure reason is present", () => {
  const input = readFixture("formal-deep-v3-comparison-fail.json");
  const result = buildFormalDeepV3Handoff({
    ...input,
    reasonCodes: ["TARGET_FAILURE_KEYS_PRESENT"],
    comparison: {
      ...input.comparison,
      currentFailureKeyCount: 1,
      targetFailureKeyCount: 1,
      targetFailureKeys: ["target-key"],
      newFailureKeyCount: 0,
      newFailureKeys: [],
    },
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.ready, false);
  assert.equal(exitCodeForHandoffStatus(result.status), 1);
});

test("FAIL with a new key remains FAIL when the failure reason is present", () => {
  const input = readFixture("formal-deep-v3-comparison-fail.json");
  const result = buildFormalDeepV3Handoff({
    ...input,
    reasonCodes: ["NEW_FAILURE_KEYS"],
    comparison: {
      ...input.comparison,
      targetManifestKeyCount: 0,
      currentFailureKeyCount: 1,
      targetFailureKeyCount: 0,
      targetFailureKeys: [],
      newFailureKeyCount: 1,
      newFailureKeys: ["new-key"],
    },
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.ready, false);
  assert.equal(exitCodeForHandoffStatus(result.status), 1);
});

test("missingSources type errors become HOLD without affecting normalized output", () => {
  const base = readFixture("formal-deep-v3-comparison-pass.json");
  for (const value of [undefined, "junit-e2e-integration.xml", ["valid", 3]]) {
    const evidence = { ...base.evidence };
    if (value === undefined) delete evidence.missingSources;
    else evidence.missingSources = value;
    const result = buildFormalDeepV3Handoff({ ...base, evidence });
    assert.equal(result.status, "HOLD");
    assert.equal(result.ready, false);
    assert.ok(result.reasonCodes.includes("MISSING_SOURCES_INVALID"));
    assert.deepEqual(result.missingSources, []);
  }
});

test("CLI writes deterministic JSON and Markdown and maps PASS to exit code 0", () => {
  withTempDir((directory) => {
    const inputPath = fixturePath("formal-deep-v3-comparison-pass.json");
    const first = runCli(inputPath, directory);
    const firstJson = fs.readFileSync(path.join(directory, "result.json"), "utf8");
    const firstMarkdown = first.markdown;
    assert.equal(first.status, 0);
    assert.equal(first.output.status, "PASS");
    assert.equal(first.output.ready, true);
    const second = runCli(inputPath, directory);
    assert.equal(second.status, 0);
    assert.equal(fs.readFileSync(path.join(directory, "result.json"), "utf8"), firstJson);
    assert.equal(second.markdown, firstMarkdown);
  });
});

test("JSON and Markdown are deterministic and derived from one normalized result", () => {
  const input = readFixture("formal-deep-v3-comparison-hold-29714201142.json");
  const first = buildFormalDeepV3Handoff(input);
  const second = buildFormalDeepV3Handoff(input);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(renderFormalDeepV3HandoffMarkdown(first), renderFormalDeepV3HandoffMarkdown(second));
  assert.match(renderFormalDeepV3HandoffMarkdown(first), /Formal Deep handoff status/);
  assert.match(renderFormalDeepV3HandoffMarkdown(first), /transport-course-users-update/);
});
