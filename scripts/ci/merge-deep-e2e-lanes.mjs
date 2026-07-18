#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { DEEP_LANES } from "./resolve-deep-e2e-lane.mjs";

function walk(directory) {
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

export function junitTestIdentities(xml) {
  const identities = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*)>/g)) {
    const attributes = match[1];
    const name = attributes.match(/\bname="([^"]*)"/)?.[1] ?? "";
    const classname = attributes.match(/\bclassname="([^"]*)"/)?.[1] ?? "";
    identities.push(`${decodeXml(classname)}::${decodeXml(name)}`);
  }
  return identities;
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

function countsFor(failures, field) {
  return failures.reduce((counts, failure) => {
    counts[failure[field]] = (counts[failure[field]] ?? 0) + 1;
    return counts;
  }, {});
}

export function mergeLaneArtifacts(
  root,
  { expectedHeadSha, expectedInventory, runId } = {},
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
  if (junitFiles.length !== DEEP_LANES.length) {
    throw new Error(`Expected ${DEEP_LANES.length} JUnit artifacts, found ${junitFiles.length}`);
  }
  const junitIdentities = junitFiles.flatMap((file) =>
    junitTestIdentities(fs.readFileSync(file, "utf8")),
  );
  const duplicateTests = junitIdentities.filter(
    (identity, index) => junitIdentities.indexOf(identity) !== index,
  );
  if (duplicateTests.length > 0) {
    throw new Error(`Duplicate JUnit test identity across lanes: ${duplicateTests[0]}`);
  }
  let expectedTestCount = null;
  if (expectedInventory) {
    const expectedIdentities = playwrightExpectedIdentities(readJson(expectedInventory));
    const expectedSet = new Set(expectedIdentities);
    const actualSet = new Set(junitIdentities);
    const missing = [...expectedSet].filter((identity) => !actualSet.has(identity));
    const unexpected = [...actualSet].filter((identity) => !expectedSet.has(identity));
    if (
      expectedSet.size !== expectedIdentities.length ||
      missing.length > 0 ||
      unexpected.length > 0 ||
      junitIdentities.length !== expectedIdentities.length
    ) {
      throw new Error(
        `JUnit identity coverage mismatch: expected=${expectedIdentities.length} actual=${junitIdentities.length} missing=${missing[0] ?? "none"} unexpected=${unexpected[0] ?? "none"}`,
      );
    }
    expectedTestCount = expectedIdentities.length;
  }

  const cancelAudits = filesMatching(root, /^deep-cancel-audit\.json$/).map(readJson);
  assertLaneSet(cancelAudits.map((audit) => audit.lane), "Cancellation audits");
  for (const audit of cancelAudits) {
    if (audit.head_sha !== expectedHeadSha) {
      throw new Error(`Cancellation audit head mismatch: lane=${audit.lane}`);
    }
    if (audit.setup_failure_step !== "none" || audit.direct_cancellation !== false) {
      throw new Error(`Lane did not bootstrap normally: ${audit.lane}`);
    }
  }

  const bootstrapFiles = filesMatching(root, /^bootstrap-diagnostics\.json$/);
  if (bootstrapFiles.length !== DEEP_LANES.length) {
    throw new Error(
      `Expected ${DEEP_LANES.length} bootstrap diagnostics, found ${bootstrapFiles.length}`,
    );
  }
  let expectedBootstrapRequestFailureCount = 0;
  for (const file of bootstrapFiles) {
    const bootstrap = readJson(file);
    const lane = DEEP_LANES.find((candidate) =>
      file.split(path.sep).some((part) => part.includes(`-${candidate}-`)),
    );
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
      throw new Error(`Bootstrap diagnostics contain errors: ${file}`);
    }
  }

  const failures = taxonomies.flatMap((taxonomy) => taxonomy.failures);
  const failureKeys = failures.map((failure) => failure.failureKey);
  if (new Set(failureKeys).size !== failureKeys.length) {
    const duplicate = failureKeys.find(
      (key, index) => failureKeys.indexOf(key) !== index,
    );
    throw new Error(`Duplicate failure key across lanes: ${duplicate}`);
  }

  return {
    taxonomy: {
      schemaVersion: 2,
      status: "available",
      generatedAt: new Date().toISOString(),
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
      expectedTestCount,
      expectedBootstrapRequestFailureCount,
      duplicateSpecCount: 0,
      duplicateTestIdentityCount: 0,
    },
  };
}

function parseArgs(argv) {
  const options = {
    root: null,
    output: "reports/deep-e2e-taxonomy-union.json",
    coverageOutput: "reports/deep-e2e-coverage-union.json",
    expectedHeadSha: process.env.SOURCE_HEAD_SHA ?? null,
    expectedInventory: null,
    runId: process.env.GITHUB_RUN_ID ?? null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      [
        "--root",
        "--output",
        "--coverage-output",
        "--expected-head-sha",
        "--expected-inventory",
        "--run-id",
      ].includes(
        argument,
      )
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

function main() {
  const options = parseArgs(process.argv.slice(2));
  const merged = mergeLaneArtifacts(path.resolve(options.root), options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(merged.taxonomy, null, 2)}\n`);
  fs.mkdirSync(path.dirname(options.coverageOutput), { recursive: true });
  fs.writeFileSync(
    options.coverageOutput,
    `${JSON.stringify(merged.coverage, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(merged.coverage)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
