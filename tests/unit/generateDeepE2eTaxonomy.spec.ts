import { describe, expect, it } from "vitest";

// @ts-expect-error The production entrypoint is a plain Node ESM diagnostic script.
import * as taxonomyModule from "../../scripts/ci/generate-deep-e2e-taxonomy.mjs";

const {
  classifyCause,
  classifyFeature,
  classifyReport,
  readAndClassify,
  validateAvailable,
} = taxonomyModule;

function reportWith(specs: unknown[]) {
  return { suites: [{ title: "deep", specs }] };
}

function failedTest(error: string, projectName = "chromium") {
  return {
    status: "unexpected",
    projectName,
    results: [{ errors: [{ message: error }] }],
  };
}

describe("Deep E2E taxonomy generation", () => {
  it("emits a valid zero-failure contract", () => {
    const taxonomy = classifyReport(reportWith([]));
    expect(taxonomy).toMatchObject({
      schemaVersion: 2,
      status: "available",
      failed: 0,
      failures: [],
      featureClassifications: {},
      causeClassifications: {},
      failureKeys: [],
    });
  });

  it("classifies known feature paths and observable failure causes", () => {
    const taxonomy = classifyReport(
      reportWith([
        {
          file: "tests/e2e/users.spec.ts",
          title: "lists users",
          tests: [
            failedTest(
              "locator('[data-testid=user-row]'): element(s) not found",
            ),
          ],
        },
        {
          file: "tests/e2e/transport.spec.ts",
          title: "assigns transport",
          tests: [failedTest("Test timeout of 30000ms exceeded")],
        },
      ]),
    );
    expect(taxonomy.failed).toBe(2);
    expect(taxonomy.failures).toEqual([
      expect.objectContaining({
        file: "tests/e2e/users.spec.ts",
        feature: "users",
        cause: "locator-not-found",
      }),
      expect.objectContaining({
        file: "tests/e2e/transport.spec.ts",
        feature: "transport",
        cause: "timeout",
      }),
    ]);
    expect(taxonomy.failureKeys).toHaveLength(2);
    expect(taxonomy.featureClassifications).toEqual({ users: 1, transport: 1 });
    expect(taxonomy.causeClassifications).toEqual({
      "locator-not-found": 1,
      timeout: 1,
    });
    expect(
      taxonomy.failures.filter(
        (failure: { cause: string }) => failure.cause !== "unclassified",
      ),
    ).toHaveLength(2);
  });

  it.each([
    ["tests/e2e/auth.spec.ts", "auth"],
    ["tests/e2e/users.usability.spec.ts", "users"],
    ["tests/e2e/transport.edit.spec.ts", "transport"],
    ["tests/e2e/schedule.week.spec.ts", "schedules"],
    ["tests/e2e/exception-center.spec.ts", "exception-center"],
    ["tests/e2e/isp.print.spec.ts", "isp"],
    ["tests/e2e/ui/touch-targets.spec.ts", "accessibility"],
    ["tests/e2e/dashboard.spec.ts", "dashboard"],
    ["tests/e2e/staff.spec.ts", "staff"],
    ["tests/e2e/nurse.spec.ts", "nurse"],
    ["tests/e2e/agenda.spec.ts", "agenda"],
    ["tests/e2e/reliability/offline.spec.ts", "reliability"],
  ])("classifies %s as %s", (file, feature) => {
    expect(classifyFeature(file)).toBe(feature);
  });

  it.each([
    ["ENOENT: storageState file was not found", "missing-storage-state"],
    [
      "skipLogin is enabled but expected signed out state",
      "auth-mode-mismatch",
    ],
    ["locator('button'): element(s) not found", "locator-not-found"],
    ["Test timeout of 30000ms exceeded", "timeout"],
    ["Expected 2, received 3", "assertion-mismatch"],
    ["Page unexpectedly redirected to /login", "unexpected-redirect"],
    ["request failed: net::ERR_CONNECTION_REFUSED", "request-failure"],
    ["unexpected console error: hydration failed", "console-error"],
    ["pageerror: uncaught exception", "page-error"],
    ["required fixture is missing", "fixture-missing"],
    [
      "touch target minimum height expected 64, received 51.5",
      "touch-target-size",
    ],
  ])("classifies observable error %s as %s", (errorSummary, cause) => {
    expect(classifyCause({ errorSummary })).toBe(cause);
  });

  it("counts a retried test once", () => {
    const taxonomy = classifyReport(
      reportWith([
        {
          file: "tests/e2e/example.spec.ts",
          title: "retries",
          tests: [
            {
              status: "unexpected",
              projectName: "chromium",
              results: [
                {
                  retry: 0,
                  errors: [{ message: "Test timeout of 30000ms exceeded" }],
                },
                {
                  retry: 1,
                  errors: [{ message: "Test timeout of 30000ms exceeded" }],
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(taxonomy.failed).toBe(1);
    expect(taxonomy.failures).toHaveLength(1);
    expect(new Set(taxonomy.failureKeys).size).toBe(1);
    expect(taxonomy.causeClassifications).toEqual({ timeout: 1 });
  });

  it("only leaves unknown input unclassified", () => {
    const taxonomy = classifyReport(
      reportWith([
        {
          file: "tests/e2e/unknown-area.spec.ts",
          title: "does something novel",
          tests: [failedTest("an entirely novel failure form")],
        },
      ]),
    );
    expect(taxonomy.failures[0]).toMatchObject({
      feature: "unclassified",
      cause: "unclassified",
    });
  });

  it("reports missing input explicitly instead of returning an empty success", () => {
    const taxonomy = readAndClassify(
      "/tmp/does-not-exist-deep-e2e-results.json",
    );
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
        schemaVersion: 2,
        failed: 1,
        failures: [
          {
            failureKey: "one",
            file: "tests/e2e/users.spec.ts",
            title: "users",
            project: "chromium",
            feature: "users",
            cause: "locator-not-found",
            errorSummary: "not found",
          },
        ],
        featureClassifications: {},
        causeClassifications: { "locator-not-found": 1 },
        failureKeys: ["one"],
      }),
    ).toThrow(/featureClassifications total must equal failed/);
  });

  it("rejects a compatibility failureKeys list that diverges from failures", () => {
    expect(() =>
      validateAvailable({
        schemaVersion: 2,
        failed: 1,
        failures: [
          {
            failureKey: "one",
            file: "tests/e2e/users.spec.ts",
            title: "users",
            project: "chromium",
            feature: "users",
            cause: "locator-not-found",
            errorSummary: "not found",
          },
        ],
        featureClassifications: { users: 1 },
        causeClassifications: { "locator-not-found": 1 },
        failureKeys: ["different"],
      }),
    ).toThrow(/derived from failures/);
  });

  it("rejects aggregates that do not match per-failure classifications", () => {
    expect(() =>
      validateAvailable({
        schemaVersion: 2,
        failed: 1,
        failures: [
          {
            failureKey: "one",
            file: "tests/e2e/users.spec.ts",
            title: "users",
            project: "chromium",
            feature: "users",
            cause: "locator-not-found",
            errorSummary: "not found",
          },
        ],
        featureClassifications: { transport: 1 },
        causeClassifications: { "locator-not-found": 1 },
        failureKeys: ["one"],
      }),
    ).toThrow(/featureClassifications must be derived from failures/);
  });
});
