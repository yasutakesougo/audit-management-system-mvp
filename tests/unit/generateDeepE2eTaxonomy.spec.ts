import { describe, expect, it } from "vitest";

// @ts-expect-error The production entrypoint is a plain Node ESM diagnostic script.
import * as taxonomyModule from "../../scripts/ci/generate-deep-e2e-taxonomy.mjs";

const { classifyReport, readAndClassify, validateAvailable } = taxonomyModule;

function reportWith(specs: unknown[]) {
  return { suites: [{ title: "deep", specs }] };
}

function failedTest(projectName = "chromium") {
  return { status: "unexpected", projectName };
}

describe("Deep E2E taxonomy generation", () => {
  it("emits a valid zero-failure contract", () => {
    const taxonomy = classifyReport(reportWith([]));
    expect(taxonomy).toMatchObject({
      status: "available",
      failed: 0,
      featureClassifications: {},
      causeClassifications: {},
      failureKeys: [],
    });
  });

  it("records multiple mechanical failure keys and unclassified totals", () => {
    const taxonomy = classifyReport(
      reportWith([
        {
          file: "tests/e2e/users.spec.ts",
          title: "lists users",
          tests: [failedTest()],
        },
        {
          file: "tests/e2e/transport.spec.ts",
          title: "assigns transport",
          tests: [failedTest()],
        },
      ]),
    );
    expect(taxonomy.failed).toBe(2);
    expect(taxonomy.failureKeys).toHaveLength(2);
    expect(taxonomy.featureClassifications).toEqual({ unclassified: 2 });
    expect(taxonomy.causeClassifications).toEqual({ unclassified: 2 });
  });

  it("counts a retried test once", () => {
    const taxonomy = classifyReport(
      reportWith([
        {
          file: "tests/e2e/example.spec.ts",
          title: "retries",
          tests: [
            { status: "unexpected", projectName: "chromium", results: [{ retry: 0 }, { retry: 1 }] },
          ],
        },
      ]),
    );
    expect(taxonomy.failed).toBe(1);
  });

  it("reports missing input explicitly instead of returning an empty success", () => {
    const taxonomy = readAndClassify("/tmp/does-not-exist-deep-e2e-results.json");
    expect(taxonomy.status).toBe("unavailable");
    expect(taxonomy.error).toMatch(/ENOENT/);
  });

  it("reports malformed JSON explicitly", () => {
    const taxonomy = readAndClassify("tests/fixtures/deep-e2e-malformed.json");
    expect(taxonomy.status).toBe("unavailable");
    expect(taxonomy.error).toMatch(/JSON|Unexpected token/);
  });

  it("rejects malformed Playwright input", () => {
    expect(() => classifyReport({})).toThrow(/suites array/);
  });

  it("rejects classification totals that do not equal failed", () => {
    expect(() =>
      validateAvailable({
        failed: 1,
        featureClassifications: {},
        causeClassifications: {},
        failureKeys: ["one"],
      }),
    ).toThrow(/featureClassifications total must equal failed/);
  });
});
