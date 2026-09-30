// @node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TOILET_REPOSITORY = "src/features/kiosk/toilet/SharePointToiletRecordRepository.ts";
const TOILET_TEST = "src/features/kiosk/toilet/__tests__/toiletRecordRepository.spec.ts";

function valueAfter(flag, args) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) {
    throw new Error(`missing required argument: ${flag}`);
  }
  return args[index + 1];
}

function requireSha(label, value) {
  if (!/^[0-9a-f]{40}$/.test(value ?? "")) {
    throw new Error(`${label} must be a non-empty 40-character lowercase SHA`);
  }
  return value;
}

function git(ref) {
  return execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
}

function workingTreeStatus() {
  return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
}

function verify(args = process.argv.slice(2), { allowDirty = false } = {}) {
  const canonicalSha = requireSha("canonical SHA", valueAfter("--canonical-sha", args));
  const equivalentSourceSha = requireSha("equivalent source SHA", valueAfter("--equivalent-source-sha", args));
  const expectedTreeSha = requireSha("expected tree SHA", valueAfter("--expected-tree-sha", args));
  const expectedRepositoryBlob = requireSha("expected repository blob", valueAfter("--expected-toilet-repository-blob", args));
  const expectedTestBlob = requireSha("expected test blob", valueAfter("--expected-toilet-test-blob", args));
  const expectedInputSha = requireSha("expected input SHA", valueAfter("--expected-input-sha", args));

  const headSha = git("HEAD");
  const originMainSha = git("origin/main");
  const dirtyStatus = workingTreeStatus();
  const canonicalTreeSha = git(`${canonicalSha}^{tree}`);
  const equivalentSourceTreeSha = git(`${equivalentSourceSha}^{tree}`);
  const headTreeSha = git("HEAD^{tree}");
  const repositoryBlob = git(`${canonicalSha}:${TOILET_REPOSITORY}`);
  const testBlob = git(`${canonicalSha}:${TOILET_TEST}`);

  const checks = [
    ["input SHA", expectedInputSha, canonicalSha],
    ["HEAD", headSha, canonicalSha],
    ["origin/main", originMainSha, canonicalSha],
    ["canonical tree", canonicalTreeSha, expectedTreeSha],
    ["source tree", equivalentSourceTreeSha, expectedTreeSha],
    ["HEAD tree", headTreeSha, expectedTreeSha],
    ["Toilet repository blob", repositoryBlob, expectedRepositoryBlob],
    ["Toilet test blob", testBlob, expectedTestBlob],
  ];

  for (const [label, actual, expected] of checks) {
    if (!actual || actual !== expected) {
      throw new Error(`${label} identity mismatch: expected ${expected}, got ${actual || "UNKNOWN"}`);
    }
    console.log(`${label}=${actual}`);
  }

  if (dirtyStatus && !allowDirty) {
    throw new Error(`working tree must be clean before deploy: ${dirtyStatus}`);
  }

  console.log("changed_file_set=TOILET_TARGET_IDENTITIES_ONLY");
  console.log("gate_decision=PASS");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verify();
  } catch (error) {
    console.error(`gate_decision=FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

export { verify };
