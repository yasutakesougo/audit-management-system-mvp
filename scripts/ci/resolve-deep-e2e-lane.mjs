#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEEP_LANES = [
  "app-a11y",
  "fixture-memory",
  "sp-stub",
  "transport-date-check",
  "implementation-hot",
  "general",
];

export const SPECIALIZED_LANE_SPECS = {
  "app-a11y": [
    "tests/e2e/call-logs.usability.spec.ts",
    "tests/e2e/exception-center.usability.spec.ts",
    "tests/e2e/users.usability.spec.ts",
  ],
  "fixture-memory": [
    "tests/e2e/agenda-happy-path.spec.ts",
    "tests/e2e/nurse-dashboard-happy-path.spec.ts",
    "tests/e2e/exception-center.corrective-child-flow.spec.ts",
    "tests/e2e/exception-center.daily-child-flow.spec.ts",
    "tests/e2e/exception-center.handoff-child-flow.spec.ts",
    "tests/e2e/exception-center.transport-missing-driver-flow.spec.ts",
    "tests/e2e/fortress.spec.ts",
    "tests/e2e/irc-reliability.spec.ts",
    "tests/e2e/users-basic-edit-flow.spec.ts",
    "tests/e2e/users-crud.integration.spec.ts",
    "tests/e2e/users-dashboard-happy-path.spec.ts",
    "tests/e2e/users-search-filter.spec.ts",
  ],
  "sp-stub": [
    "tests/e2e/dashboard.sp-lane.error.spec.ts",
    "tests/e2e/hub-entry-experience.ssot.spec.ts",
    "tests/e2e/isp-editor.integration.spec.ts",
    "tests/e2e/transport-assignments-integration.spec.ts",
  ],
  "transport-date-check": [
    "tests/e2e/transport-assignments-save-reflects-in-today.spec.ts",
    "tests/e2e/transport-assignments-week-bulk-apply-reflects-in-today.spec.ts",
    "tests/e2e/transport-course-users-update-reflects-in-transport-assignments.spec.ts",
  ],
  "implementation-hot": [
    "tests/e2e/staff-form.flow.spec.ts",
    "tests/e2e/transport-assignments-repository-flow.spec.ts",
  ],
};

function normalize(file) {
  return file.split(path.sep).join("/");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

export function listDeepSpecs(root = process.cwd()) {
  const testRoot = path.join(root, "tests", "e2e");
  return walk(testRoot)
    .filter((file) => file.endsWith(".spec.ts"))
    .map((file) => normalize(path.relative(root, file)))
    .sort();
}

export function resolveDeepE2eLanes(root = process.cwd()) {
  const allSpecs = listDeepSpecs(root);
  const allSpecSet = new Set(allSpecs);
  const owners = new Map();
  const assignments = {};

  for (const lane of DEEP_LANES.filter((name) => name !== "general")) {
    const files = [...(SPECIALIZED_LANE_SPECS[lane] ?? [])].sort();
    assignments[lane] = files;
    for (const file of files) {
      if (!allSpecSet.has(file)) {
        throw new Error(`Deep lane ${lane} references missing spec: ${file}`);
      }
      const existing = owners.get(file);
      if (existing) {
        throw new Error(`Deep spec has multiple owners: ${file} (${existing}, ${lane})`);
      }
      owners.set(file, lane);
    }
  }

  assignments.general = allSpecs.filter((file) => !owners.has(file));
  for (const file of assignments.general) owners.set(file, "general");

  if (owners.size !== allSpecs.length) {
    throw new Error(`Deep lane coverage mismatch: owned=${owners.size} all=${allSpecs.length}`);
  }

  const allSpecsDigest = createHash("sha256")
    .update(`${allSpecs.join("\n")}\n`)
    .digest("hex");

  return {
    schemaVersion: 1,
    lanes: DEEP_LANES,
    allSpecs,
    allSpecCount: allSpecs.length,
    allSpecsDigest,
    assignments,
  };
}

export function laneManifest(lane, root = process.cwd(), metadata = {}) {
  const resolved = resolveDeepE2eLanes(root);
  if (!DEEP_LANES.includes(lane)) throw new Error(`Unknown Deep lane: ${lane}`);
  return {
    schemaVersion: 1,
    lane,
    sourceHeadSha: metadata.sourceHeadSha ?? null,
    allSpecCount: resolved.allSpecCount,
    allSpecsDigest: resolved.allSpecsDigest,
    files: resolved.assignments[lane],
  };
}

function parseArgs(argv) {
  const options = { root: process.cwd(), format: "json", output: null, lane: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--root", "--format", "--output", "--lane"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.lane) throw new Error("--lane is required");
  if (!["json", "lines"].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = laneManifest(options.lane, path.resolve(options.root), {
    sourceHeadSha: process.env.SOURCE_HEAD_SHA ?? null,
  });
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (options.format === "lines") {
    process.stdout.write(`${manifest.files.join("\n")}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
