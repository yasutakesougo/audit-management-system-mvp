// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isTransientDangerFailure } from "../run-danger-with-retry.mjs";

describe("isTransientDangerFailure", () => {
  it.each([
    "ERR_STREAM_PREMATURE_CLOSE",
    "Error: Premature close",
    "Danger: Failed to fetch GitHub pull request files",
    "Danger: Failed to fetch pull request diff",
    "GET /repos/example/repo/pulls/2345/commits failed: fetch failed",
    "fetch failure while requesting /repos/example/repo/pulls/2345/commits",
  ])("classifies transient Danger API output: %s", (output) => {
    expect(isTransientDangerFailure(output)).toBe(true);
  });

  it.each([
    "Danger found 2 fails. Please update Today guardrails.",
    "SyntaxError: Unexpected token in dangerfile.ts",
    "npm ERR! missing script: danger",
    "Error: Request failed with status code 422",
    "GET /repos/example/repo/pulls/2345/files failed",
  ])("does not classify non-transient output: %s", (output) => {
    expect(isTransientDangerFailure(output)).toBe(false);
  });
});
