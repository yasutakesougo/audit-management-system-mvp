#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const WORKFLOW_DIR = path.resolve(".github/workflows");
const WORKFLOW_EXT = /\.(ya?ml)$/i;

function printUsage() {
  console.error(
    "Usage: node scripts/ci/check-node24-workflows.mjs [--json] [--json-output <path>]",
  );
}

function parseArgs(argv) {
  let json = false;
  let jsonOutputPath = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--json-output") {
      jsonOutputPath = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { json, jsonOutputPath };
}

function listWorkflowFiles() {
  if (!fs.existsSync(WORKFLOW_DIR)) return [];
  return fs
    .readdirSync(WORKFLOW_DIR)
    .filter((name) => WORKFLOW_EXT.test(name))
    .map((name) => path.join(WORKFLOW_DIR, name))
    .sort((a, b) => a.localeCompare(b));
}

function normalizeNodeVersion(raw) {
  if (!raw) return "";
  const withoutComment = raw.split("#")[0].trim();
  return withoutComment.replace(/^['"]|['"]$/g, "").trim();
}

function parseSetupNodeEntries(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const entries = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/uses:\s*actions\/setup-node@/i.test(line)) continue;

    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    let nodeVersion = "";
    let nodeVersionLine = null;

    for (let j = i + 1; j < lines.length; j += 1) {
      const nextLine = lines[j];
      const nextTrimmed = nextLine.trim();
      const nextLeadingSpaces = nextLine.match(/^(\s*)/)?.[1].length ?? 0;

      if (/^\s*-\s+/.test(nextLine) && nextLeadingSpaces <= leadingSpaces) {
        break;
      }

      const nodeVersionMatch = nextLine.match(/node-version:\s*(.+)\s*$/i);
      if (nodeVersionMatch) {
        nodeVersion = normalizeNodeVersion(nodeVersionMatch[1]);
        nodeVersionLine = j + 1;
        break;
      }
    }

    const compliant = /^24(\.x)?$/i.test(nodeVersion);
    const reason = nodeVersion
      ? compliant
        ? "ok"
        : nodeVersion.includes("${{")
          ? "dynamic-value"
          : "not-24"
      : "missing-node-version";

    entries.push({
      compliant,
      file: path.relative(process.cwd(), filePath),
      line: nodeVersionLine,
      nodeVersion: nodeVersion || null,
      reason,
      stepLine: i + 1,
    });
  }

  return entries;
}

function buildResult() {
  const workflowFiles = listWorkflowFiles();
  const fileEntries = workflowFiles.map((filePath) => ({
    entries: parseSetupNodeEntries(filePath),
    file: path.relative(process.cwd(), filePath),
  }));

  const target = fileEntries.filter((x) => x.entries.length > 0);
  const compliantWorkflows = target.filter((x) => x.entries.every((e) => e.compliant));
  const nonCompliantEntries = target.flatMap((x) => x.entries.filter((e) => !e.compliant));
  const compliantUsages = target.flatMap((x) => x.entries.filter((e) => e.compliant)).length;
  const totalUsages = target.reduce((sum, x) => sum + x.entries.length, 0);

  return {
    compliantUsages,
    node24CompliantWorkflows: compliantWorkflows.length,
    nonCompliantEntries,
    nonCompliantUsages: nonCompliantEntries.length,
    nonCompliantWorkflows: target.length - compliantWorkflows.length,
    scannedWorkflows: workflowFiles.length,
    setupNodeUsages: totalUsages,
    targetWorkflows: target.length,
  };
}

function printSummary(result) {
  console.log(`[node24-guard] scannedWorkflows=${result.scannedWorkflows}`);
  console.log(`[node24-guard] targetWorkflows=${result.targetWorkflows}`);
  console.log(`[node24-guard] node24CompliantWorkflows=${result.node24CompliantWorkflows}`);
  console.log(`[node24-guard] nonCompliantWorkflows=${result.nonCompliantWorkflows}`);
  console.log(`[node24-guard] setupNodeUsages=${result.setupNodeUsages}`);
  console.log(`[node24-guard] compliantUsages=${result.compliantUsages}`);
  console.log(`[node24-guard] nonCompliantUsages=${result.nonCompliantUsages}`);

  if (result.nonCompliantEntries.length > 0) {
    console.log("[node24-guard] non-compliant entries:");
    for (const entry of result.nonCompliantEntries) {
      const lineLabel = entry.line ?? entry.stepLine;
      console.log(
        `  - ${entry.file}:${lineLabel} node-version=${entry.nodeVersion ?? "<missing>"} reason=${entry.reason}`,
      );
    }
    console.error("[node24-guard] Node 24 policy violation detected.");
  } else {
    console.log("[node24-guard] Node 24 policy is fully compliant.");
  }
}

function main() {
  const { json, jsonOutputPath } = parseArgs(process.argv.slice(2));
  const result = buildResult();

  printSummary(result);

  if (jsonOutputPath) {
    fs.writeFileSync(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`[node24-guard] wrote json report: ${jsonOutputPath}`);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.nonCompliantUsages > 0 ? 1 : 0);
}

main();
