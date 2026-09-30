// @node
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verify } from "../verify-deploy-gate-baseline.mjs";

const args = [
  "--canonical-sha", "79ccbb41e0e3c8d4172f36617d9bf58d7ee40db8",
  "--equivalent-source-sha", "afe30f206751a4e823f9f651c5770ee7eafe1988",
  "--expected-tree-sha", "78f85fed62ad1b43f751c70afe1a5b711cf39ec6",
  "--expected-toilet-repository-blob", "9c23e293ce8c6129f2351671bb63d5d02d4bdfe1",
  "--expected-toilet-test-blob", "6350f23d0a5a3ee8b52868dc6def13143e807480",
  "--expected-input-sha", "79ccbb41e0e3c8d4172f36617d9bf58d7ee40db8",
];

describe("deploy gate baseline verification", () => {
  it("passes only for the canonical commit, tree, and Toilet blobs", () => {
    assert.doesNotThrow(() => verify(args, { allowDirty: true }));
  });

  it("fails closed when an identity is missing or mismatched", () => {
    assert.throws(
      () => verify([...args.slice(0, -1), "--expected-input-sha", "0000000000000000000000000000000000000000"], { allowDirty: true }),
      /expected input SHA must be a non-empty 40-character lowercase SHA/,
    );
  });
});
