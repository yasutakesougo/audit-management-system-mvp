// @node
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verify } from "../verify-deploy-gate-baseline.mjs";

const PRE_GATE = "79ccbb41e0e3c8d4172f36617d9bf58d7ee40db8";
const POST_MERGE = "e90788e3d0179d57c599205db02aa1ba5b69d596";
const TREE = "78f85fed62ad1b43f751c70afe1a5b711cf39ec6";
const REPOSITORY_BLOB = "9c23e293ce8c6129f2351671bb63d5d02d4bdfe1";
const TEST_BLOB = "6350f23d0a5a3ee8b52868dc6def13143e807480";

const args = [
  "--canonical-sha", "79ccbb41e0e3c8d4172f36617d9bf58d7ee40db8",
  "--expected-tree-sha", TREE,
  "--expected-toilet-repository-blob", REPOSITORY_BLOB,
  "--expected-toilet-test-blob", TEST_BLOB,
  "--expected-input-sha", POST_MERGE,
];

function fakeGit(ref) {
  const values = {
    HEAD: POST_MERGE,
    "origin/main": POST_MERGE,
    [`${PRE_GATE}^{tree}`]: TREE,
    "HEAD^{tree}": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    [`HEAD:src/features/kiosk/toilet/SharePointToiletRecordRepository.ts`]: REPOSITORY_BLOB,
    [`HEAD:src/features/kiosk/toilet/__tests__/toiletRecordRepository.spec.ts`]: TEST_BLOB,
  };
  if (!(ref in values)) throw new Error(`unexpected runtime git ref: ${ref}`);
  return values[ref];
}

const allowedGateFiles = [
  ".github/workflows/deploy-cloudflare-worker.yml",
  "package.json",
  "vitest.config.ts",
  "scripts/ci/verify-deploy-gate-baseline.mjs",
  "scripts/ci/__tests__/verify-deploy-gate-baseline.spec.mjs",
  "scripts/ci/__tests__/deploy-cloudflare-worker-workflow-contract.spec.mjs",
];

function verifyWith(files = allowedGateFiles, overrides = {}) {
  return verify(args, {
    allowDirty: true,
    gitRef: fakeGit,
    getWorkingTreeStatus: () => "",
    getChangedFiles: () => files,
    ...overrides,
  });
}

describe("deploy gate baseline verification", () => {
  it("accepts a post-merge HEAD when it matches origin/main", () => {
    assert.doesNotThrow(() => verifyWith());
  });

  it("fails closed when HEAD and origin/main diverge", () => {
    assert.throws(
      () => verifyWith(allowedGateFiles, { gitRef: (ref) => ref === "origin/main" ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" : fakeGit(ref) }),
      /HEAD identity mismatch/,
    );
  });

  it("does not require the equivalent source commit at runtime", () => {
    assert.doesNotThrow(() => verifyWith());
  });

  it("rejects a Toilet repository blob mismatch", () => {
    assert.throws(
      () => verifyWith(allowedGateFiles, { gitRef: (ref) => ref.startsWith("HEAD:src/features/kiosk/toilet/SharePoint") ? "cccccccccccccccccccccccccccccccccccccccc" : fakeGit(ref) }),
      /Toilet repository blob identity mismatch/,
    );
  });

  it("rejects a changed file outside the Deploy Gate allow-list", () => {
    assert.throws(
      () => verifyWith([...allowedGateFiles, "src/features/kiosk/toilet/SharePointToiletRecordRepository.ts"]),
      /changed file set contains disallowed files/,
    );
  });

  it("rejects a well-formed but mismatched expected input identity", () => {
    const mismatchedArgs = [...args];
    mismatchedArgs[mismatchedArgs.length - 1] = "0000000000000000000000000000000000000000";
    assert.throws(
      () => verify(mismatchedArgs, {
        allowDirty: true,
        gitRef: fakeGit,
        getWorkingTreeStatus: () => "",
        getChangedFiles: () => allowedGateFiles,
      }),
      /input SHA identity mismatch/,
    );
  });
});
