import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DEEP_LANES,
  SPECIALIZED_LANE_SPECS,
  laneManifest,
  resolveDeepE2eLanes,
} from "../resolve-deep-e2e-lane.mjs";

const temporaryRoots = [];

function fixtureRoot(extraSpecs = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deep-lanes-"));
  temporaryRoots.push(root);
  const specs = [
    ...new Set([
      ...Object.values(SPECIALIZED_LANE_SPECS).flat(),
      "tests/e2e/general-only.spec.ts",
      ...extraSpecs,
    ]),
  ];
  for (const spec of specs) {
    const absolute = path.join(root, spec);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "// fixture\n");
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("resolveDeepE2eLanes", () => {
  it("assigns every spec to exactly one of the six lanes", () => {
    const resolved = resolveDeepE2eLanes(fixtureRoot());
    const assigned = DEEP_LANES.flatMap((lane) => resolved.assignments[lane]);

    assert.equal(new Set(assigned).size, assigned.length);
    assert.deepEqual([...assigned].sort(), resolved.allSpecs);
    assert.deepEqual(resolved.assignments.general, ["tests/e2e/general-only.spec.ts"]);
  });

  it("places newly added specs in general without editing a static list", () => {
    const root = fixtureRoot(["tests/e2e/nested/new-flow.spec.ts"]);
    const manifest = laneManifest("general", root, { sourceHeadSha: "abc123" });

    assert.equal(manifest.sourceHeadSha, "abc123");
    assert.deepEqual(manifest.files, [
      "tests/e2e/general-only.spec.ts",
      "tests/e2e/nested/new-flow.spec.ts",
    ]);
  });
});
