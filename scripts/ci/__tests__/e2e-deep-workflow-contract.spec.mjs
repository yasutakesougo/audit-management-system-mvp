import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/e2e-deep.yml"),
  "utf8",
);
describe("E2E Deep workflow evidence contract", () => {
  it("keeps schema v2 and uploads schema v3 with the generated inventories", () => {
    expect(workflow).toMatch(
      /reports\/deep-e2e-taxonomy-union-\$\{\{ github\.run_id \}\}\.json/,
    );
    expect(workflow).toMatch(
      /reports\/deep-e2e-taxonomy-union-v3-\$\{\{ github\.run_id \}\}\.json/,
    );
    expect(workflow).toMatch(/expected-deep-inventory\.json/);
    expect(workflow).toMatch(/expected-integration-inventory\.json/);
  });

  it("uploads and downloads one Playwright JSON result artifact per lane", () => {
    expect(workflow).toMatch(
      /name: results-json-deep-\$\{\{ github\.run_id \}\}-\$\{\{ matrix\.artifact_suffix \}\}/,
    );
    expect(workflow).toMatch(/path: test-results\/results\.json/);
    expect(workflow).toMatch(
      /pattern: results-json-deep-\$\{\{ github\.run_id \}\}-\*/,
    );
  });

  it("joins Integration evidence to the union using exact-head audit data", () => {
    expect(workflow).toMatch(
      /needs:\s*\n\s*- deep-tests-chromium\s*\n\s*- deep-tests-integration/,
    );
    expect(workflow).toMatch(
      /if: needs\.deep-tests-integration\.result != 'skipped'/,
    );
    expect(workflow).toMatch(/integration-execution-audit\.json/);
    expect(workflow).toMatch(/source_head_sha: process\.env\.SOURCE_HEAD_SHA/);
    expect(workflow).toMatch(/checkout_sha: process\.env\.CHECKOUT_SHA/);
    expect(workflow).toMatch(
      /--integration-job-result "\$INTEGRATION_JOB_RESULT"/,
    );
    expect(workflow).toMatch(
      /--integration-artifact-name "integration-results-\$\{\{ github\.run_number \}\}"/,
    );
  });

  it("retains lane and Integration evidence for 14 days", () => {
    const resultArtifact = workflow.match(
      /name: results-json-deep-[\s\S]*?retention-days: 14/,
    );
    const integrationArtifact = workflow.match(
      /name: integration-results-[\s\S]*?retention-days: 14/,
    );
    expect(resultArtifact).not.toBeNull();
    expect(integrationArtifact).not.toBeNull();
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
      expect(
        workflow,
      ).toMatch(new RegExp(`if: always\\(\\)[\\s\\S]{0,1000}name: ${name}-\\$\\{\\{ github\\.run_id \\}\\}-\\$\\{\\{ matrix\\.artifact_suffix \\}\\}`));
    }
    expect(workflow).toMatch(/name: e2e-bootstrap-diagnostics-\$\{\{ github\.run_id \}\}-\$\{\{ matrix\.artifact_suffix \}\}-\$\{\{ github\.run_attempt \}\}/);
  });

  it("collects all six cancellation audits, bootstrap diagnostics, attempts, inventories, and JUnit", () => {
    expect(workflow).toMatch(/pattern: cancel-audit-deep-\$\{\{ github\.run_id \}\}-\*/);
    expect(workflow).toMatch(/pattern: e2e-bootstrap-diagnostics-\$\{\{ github\.run_id \}\}-\*/);
    expect(workflow).toMatch(/pattern: results-json-deep-\$\{\{ github\.run_id \}\}-\*/);
    expect(workflow).toMatch(/pattern: junit-e2e-deep-\$\{\{ github\.run_id \}\}-\*/);
    expect(workflow).toMatch(/expected-deep-inventory\.json/);
    expect(workflow).toMatch(/expected-integration-inventory\.json/);
  });

  it("does not silently pass missing evidence and uploads v2/v3 separately", () => {
    expect(workflow).toMatch(/continue-on-error: true[\s\S]{0,220}pattern: results-json-deep-/);
    expect(workflow).toMatch(/if-no-files-found: error/);
    expect(workflow).toMatch(/name: taxonomy-deep-union-\$\{\{ github\.run_id \}\}/);
    expect(workflow).toMatch(/deep-e2e-taxonomy-union-\$\{\{ github\.run_id \}\}\.json/);
    expect(workflow).toMatch(/deep-e2e-taxonomy-union-v3-\$\{\{ github\.run_id \}\}\.json/);
  });

  it("propagates Integration result and source/checkout SHA into the union", () => {
    expect(workflow).toMatch(/needs:\s*\n\s*- deep-tests-chromium\s*\n\s*- deep-tests-integration/);
    expect(workflow).toMatch(/INTEGRATION_JOB_RESULT: \$\{\{ needs\.deep-tests-integration\.result \}\}/);
    expect(workflow).toMatch(/source_head_sha: process\.env\.SOURCE_HEAD_SHA/);
    expect(workflow).toMatch(/checkout_sha: process\.env\.CHECKOUT_SHA/);
    expect(workflow).toMatch(/"checkout_sha": "\$\(git rev-parse HEAD\)"/);
    expect(workflow).toMatch(/--run-attempt "\$\{\{ github\.run_attempt \}\}"/);
  });
});
