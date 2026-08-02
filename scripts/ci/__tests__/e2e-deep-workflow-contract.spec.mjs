import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/e2e-deep.yml"),
  "utf8",
);
describe("E2E Deep workflow evidence contract", () => {
  it("keeps schema v2 and uploads schema v3 with the generated inventories", () => {
    assert.match(
      workflow,
      /reports\/deep-e2e-taxonomy-union-\$\{\{ github\.run_id \}\}\.json/,
    );
    assert.match(
      workflow,
      /reports\/deep-e2e-taxonomy-union-v3-\$\{\{ github\.run_id \}\}\.json/,
    );
    assert.match(workflow, /expected-deep-inventory\.json/);
    assert.match(workflow, /expected-integration-inventory\.json/);
  });

  it("uploads and downloads one Playwright JSON result artifact per lane", () => {
    assert.match(
      workflow,
      /name: results-json-deep-\$\{\{ github\.run_id \}\}-\$\{\{ matrix\.artifact_suffix \}\}/,
    );
    assert.match(workflow, /path: test-results\/results\.json/);
    assert.match(
      workflow,
      /pattern: results-json-deep-\$\{\{ github\.run_id \}\}-\*/,
    );
  });

  it("joins Integration evidence to the union using exact-head audit data", () => {
    assert.match(
      workflow,
      /needs:\s*\n\s*- deep-tests-chromium\s*\n\s*- deep-tests-integration/,
    );
    assert.match(
      workflow,
      /if: needs\.deep-tests-integration\.result != 'skipped'/,
    );
    assert.match(workflow, /integration-execution-audit\.json/);
    assert.doesNotMatch(
      workflow,
      /name: Run integration tests[\s\S]{0,1000}PLAYWRIGHT_JUNIT_OUTPUT: 'test-results\/junit-e2e-integration\.xml'/,
    );
    assert.match(workflow, /source_head_sha: process\.env\.SOURCE_HEAD_SHA/);
    assert.match(workflow, /checkout_sha: process\.env\.CHECKOUT_SHA/);
    assert.match(
      workflow,
      /--integration-job-result "\$INTEGRATION_JOB_RESULT"/,
    );
    assert.match(
      workflow,
      /--integration-artifact-name "integration-results-\$\{\{ github\.run_number \}\}"/,
    );
    assert.match(
      workflow,
      /name: Run integration tests[\s\S]{0,1000}PLAYWRIGHT_JUNIT_OUTPUT_FILE: 'test-results\/junit-e2e-integration\.xml'/,
    );
  });

  it("retains lane and Integration evidence for 14 days", () => {
    const resultArtifact = workflow.match(
      /name: results-json-deep-[\s\S]*?retention-days: 14/,
    );
    const integrationArtifact = workflow.match(
      /name: integration-results-[\s\S]*?retention-days: 14/,
    );
    assert.notEqual(resultArtifact, null);
    assert.notEqual(integrationArtifact, null);
  });

  it("uses always() for every lane evidence upload and preserves run identity", () => {
    const laneUploadNames = [
      "playwright-report-deep",
      "test-results-deep",
      "e2e-bootstrap-diagnostics",
      "junit-e2e-deep",
      "taxonomy-deep",
      "coverage-deep",
      "cancel-audit-deep",
      "results-json-deep",
    ];
    for (const name of laneUploadNames) {
      assert.match(
        workflow,
        new RegExp(`if: always\\(\\)[\\s\\S]{0,1000}name: ${name}-\\$\\{\\{ github\\.run_id \\}\\}-\\$\\{\\{ matrix\\.artifact_suffix \\}\\}`),
      );
    }
    assert.match(workflow, /name: e2e-bootstrap-diagnostics-\$\{\{ github\.run_id \}\}-\$\{\{ matrix\.artifact_suffix \}\}-\$\{\{ github\.run_attempt \}\}/);
  });

  it("collects all six cancellation audits, bootstrap diagnostics, attempts, inventories, and JUnit", () => {
    assert.match(workflow, /pattern: cancel-audit-deep-\$\{\{ github\.run_id \}\}-\*/);
    assert.match(workflow, /pattern: e2e-bootstrap-diagnostics-\$\{\{ github\.run_id \}\}-\*/);
    assert.match(workflow, /pattern: results-json-deep-\$\{\{ github\.run_id \}\}-\*/);
    assert.match(workflow, /pattern: junit-e2e-deep-\$\{\{ github\.run_id \}\}-\*/);
    assert.match(workflow, /expected-deep-inventory\.json/);
    assert.match(workflow, /expected-integration-inventory\.json/);
  });

  it("does not silently pass missing evidence and uploads v2/v3 separately", () => {
    assert.match(workflow, /continue-on-error: true[\s\S]{0,220}pattern: results-json-deep-/);
    assert.match(workflow, /if-no-files-found: error/);
    assert.match(workflow, /name: taxonomy-deep-union-\$\{\{ github\.run_id \}\}/);
    assert.match(workflow, /deep-e2e-taxonomy-union-\$\{\{ github\.run_id \}\}\.json/);
    assert.match(workflow, /deep-e2e-taxonomy-union-v3-\$\{\{ github\.run_id \}\}\.json/);
  });

  it("propagates Integration result and source/checkout SHA into the union", () => {
    assert.match(workflow, /needs:\s*\n\s*- deep-tests-chromium\s*\n\s*- deep-tests-integration/);
    assert.match(workflow, /INTEGRATION_JOB_RESULT: \$\{\{ needs\.deep-tests-integration\.result \}\}/);
    assert.match(workflow, /source_head_sha: process\.env\.SOURCE_HEAD_SHA/);
    assert.match(workflow, /checkout_sha: process\.env\.CHECKOUT_SHA/);
    assert.match(workflow, /"checkout_sha": "\$\(git rev-parse HEAD\)"/);
    assert.match(workflow, /--run-attempt "\$\{\{ github\.run_attempt \}\}"/);
  });
});
