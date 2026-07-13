import { describe, expect, it } from "vitest";

// @ts-expect-error The production entrypoint is a plain Node ESM diagnostic script.
import * as taxonomyModule from "../../scripts/ci/classify-deep-e2e-failures.mjs";

const { classifyReport, renderMarkdown } = taxonomyModule;

function result(message: string, retry = 0) {
  return {
    workerIndex: 0,
    parallelIndex: 0,
    status: "failed",
    duration: 10,
    errors: [{ message }],
    stdout: [],
    stderr: [],
    retry,
    startTime: "2026-07-14T00:00:00.000Z",
    attachments: [],
  };
}

function testEntry(message: string, results = [result(message)]) {
  return {
    timeout: 30_000,
    annotations: [],
    expectedStatus: "passed",
    projectId: "chromium",
    projectName: "chromium",
    results,
    status: "unexpected",
  };
}

function reportWith(specs: unknown[]) {
  return {
    config: {},
    suites: [{ title: "deep", file: "tests/e2e/example.spec.ts", specs }],
    errors: [],
    stats: { startTime: "2026-07-14T00:00:00.000Z", duration: 100 },
  };
}

describe("deep E2E failure taxonomy", () => {
  it("counts a retried test once and records its attempts", () => {
    const report = reportWith([
      {
        title: "loads the users page",
        ok: false,
        id: "users-retry",
        file: "tests/e2e/users.spec.ts",
        tests: [
          testEntry('locator("[data-testid=users-table]") timed out', [
            result("locator timed out", 0),
            result("locator timed out", 1),
            result("locator timed out", 2),
          ]),
        ],
      },
    ]);

    const taxonomy = classifyReport(report);

    expect(taxonomy.totals.failed).toBe(1);
    expect(taxonomy.totals.featureClassifications).toBe(1);
    expect(taxonomy.totals.causeClassifications).toBe(1);
    expect(taxonomy.failures[0]).toMatchObject({
      feature: "Users",
      primaryCategory: "selector_contract",
      attempts: 3,
      retryCount: 2,
    });
  });

  it("uses deterministic cause precedence and records secondary signals", () => {
    const report = reportWith([
      {
        title: "opens protected dashboard",
        ok: false,
        id: "auth-dashboard",
        file: "tests/e2e/dashboard.spec.ts",
        tests: [
          testEntry(
            "locator timed out because authentication required; sign in",
          ),
        ],
      },
    ]);

    const taxonomy = classifyReport(report);

    expect(taxonomy.failures[0].primaryCategory).toBe("auth_required");
    expect(taxonomy.failures[0].signals).toEqual([
      "auth_required",
      "selector_contract",
      "timeout",
    ]);
  });

  it("keeps all classification totals equal to the unique failed-test count", () => {
    const taxonomy = classifyReport(
      reportWith(
        Array.from({ length: 70 }, (_, index) => ({
          title: `dashboard failure ${index}`,
          ok: false,
          id: `dashboard-${index}`,
          file: "tests/e2e/dashboard.spec.ts",
          tests: [
            testEntry(`locator for dashboard row ${index} timed out`, [
              result("locator timed out", 0),
              result("locator timed out", 1),
            ]),
          ],
        })),
      ),
    );

    expect(taxonomy.totals.failed).toBe(70);
    expect(taxonomy.totals.featureClassifications).toBe(70);
    expect(taxonomy.totals.causeClassifications).toBe(70);
    expect(taxonomy.byFeature).toEqual({ Dashboard: 70 });
    expect(taxonomy.dominantCategories).toEqual([
      { category: "selector_contract", count: 70 },
    ]);
  });

  it("separates intentionally skipped tests from tests that did not run", () => {
    const skipped = {
      ...testEntry(""),
      expectedStatus: "skipped",
      status: "skipped",
      annotations: [
        { type: "skip", description: "not available in this lane" },
      ],
      results: [{ ...result(""), status: "skipped" }],
    };
    const didNotRun = {
      ...testEntry(""),
      expectedStatus: "passed",
      status: "skipped",
      results: [0, 1, 2].map((retry) => ({
        ...result("", retry),
        status: "skipped",
        duration: 0,
        errors: [],
      })),
    };
    const taxonomy = classifyReport(
      reportWith([
        {
          title: "skip accounting",
          ok: true,
          id: "skip-accounting",
          file: "tests/e2e/example.spec.ts",
          tests: [skipped, didNotRun],
        },
      ]),
    );

    expect(taxonomy.totals.didNotRun).toBe(1);
    expect(taxonomy.totals.byStatus).toEqual({ skipped: 1, didNotRun: 1 });
  });

  it.each([
    ["tests/e2e/transport.routes.spec.ts", "Transport"],
    ["tests/e2e/dashboard.spec.ts", "Dashboard"],
    ["tests/e2e/schedules.persist.spec.ts", "Schedules"],
    ["tests/e2e/daily-handoff.spec.ts", "Daily-Handoff"],
    ["tests/e2e/kiosk.spec.ts", "Kiosk"],
    ["tests/e2e/sharepoint.contract.spec.ts", "SharePoint"],
    ["tests/e2e/misc.spec.ts", "Other"],
  ])("maps %s to %s", (file, feature) => {
    const taxonomy = classifyReport(
      reportWith([
        {
          title: "fails",
          ok: false,
          id: file,
          file,
          tests: [testEntry("unexpected application result")],
        },
      ]),
    );

    expect(taxonomy.failures[0].feature).toBe(feature);
  });

  it("throws for malformed Playwright data instead of producing false counts", () => {
    expect(() => classifyReport({ config: {} })).toThrow(/suites array/);
  });

  it("renders classification totals in Markdown", () => {
    const taxonomy = classifyReport(
      reportWith([
        {
          title: "does not persist",
          ok: false,
          id: "persist",
          file: "tests/e2e/schedules.persist.spec.ts",
          tests: [testEntry("localStorage persistence failed")],
        },
      ]),
      { GITHUB_SHA: "abc123", DEEP_E2E_LANE: "deep-non-smoke" },
    );

    expect(renderMarkdown(taxonomy)).toContain("Unique failed tests: **1**");
    expect(renderMarkdown(taxonomy)).toContain("| persistence | 1 |");
  });
});
