// @node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TOILET_REPOSITORY = "src/features/kiosk/toilet/SharePointToiletRecordRepository.ts";
const TOILET_TEST = "src/features/kiosk/toilet/__tests__/toiletRecordRepository.spec.ts";
const ALLOWED_DEPLOY_GATE_FILES = new Set([
  ".github/workflows/deploy-cloudflare-worker.yml",
  "package.json",
  "vitest.config.ts",
  "scripts/ci/verify-deploy-gate-baseline.mjs",
  "scripts/ci/__tests__/verify-deploy-gate-baseline.spec.mjs",
  "scripts/ci/__tests__/deploy-cloudflare-worker-workflow-contract.spec.mjs",
]);

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

function changedFiles(canonicalSha, headSha) {
  return execFileSync("git", ["diff", "--name-only", canonicalSha, headSha], { encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function verify(args = process.argv.slice(2), {
  allowDirty = false,
  gitRef = git,
  getWorkingTreeStatus = workingTreeStatus,
  getChangedFiles = changedFiles,
} = {}) {
  const canonicalSha = requireSha("canonical SHA", valueAfter("--canonical-sha", args));
  const expectedTreeSha = requireSha("expected tree SHA", valueAfter("--expected-tree-sha", args));
  const expectedRepositoryBlob = requireSha("expected repository blob", valueAfter("--expected-toilet-repository-blob", args));
  const expectedTestBlob = requireSha("expected test blob", valueAfter("--expected-toilet-test-blob", args));
  const expectedInputSha = requireSha("expected input SHA", valueAfter("--expected-input-sha", args));

  const headSha = gitRef("HEAD");
  const originMainSha = gitRef("origin/main");
  const dirtyStatus = getWorkingTreeStatus();
  const canonicalTreeSha = gitRef(`${canonicalSha}^{tree}`);
  const headTreeSha = gitRef("HEAD^{tree}");
  const repositoryBlob = gitRef(`HEAD:${TOILET_REPOSITORY}`);
  const testBlob = gitRef(`HEAD:${TOILET_TEST}`);
  const changed = getChangedFiles(canonicalSha, headSha);

  const checks = [
    ["input SHA", expectedInputSha, headSha],
    ["HEAD", headSha, originMainSha],
    ["canonical tree", canonicalTreeSha, expectedTreeSha],
    ["Toilet repository blob", repositoryBlob, expectedRepositoryBlob],
    ["Toilet test blob", testBlob, expectedTestBlob],
  ];

  for (const [label, actual, expected] of checks) {
    if (!actual || actual !== expected) {
      throw new Error(`${label} identity mismatch: expected ${expected}, got ${actual || "UNKNOWN"}`);
    }
    console.log(`${label}=${actual}`);
  }

  const disallowed = changed.filter((file) => !ALLOWED_DEPLOY_GATE_FILES.has(file));
  if (disallowed.length > 0) {
    throw new Error(`changed file set contains disallowed files: ${disallowed.join(", ")}`);
  }

  if (dirtyStatus && !allowDirty) {
    throw new Error(`working tree must be clean before deploy: ${dirtyStatus}`);
  }

  console.log(`pre_gate_changed_file_set=${changed.length === 0 ? "NONE" : changed.join(",")}`);
  console.log(`head_tree=${headTreeSha}`);
  console.log("changed_file_set=DEPLOY_GATE_ONLY");
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
