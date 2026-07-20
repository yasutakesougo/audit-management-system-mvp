// @node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { describe, it } from "node:test";

const workflowPath = path.join(process.cwd(), ".github/workflows/deploy-cloudflare-worker.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

function expectContains(subject, expected, label) {
  assert.ok(subject.includes(expected), `missing ${label}: ${expected}`);
}

describe("deploy-cloudflare-worker workflow contract", () => {
  it("normalizes release_scope to full when omitted", () => {
    expectContains(
      workflow,
      "RELEASE_SCOPE: ${{ inputs.release_scope || 'full' }}",
      "release_scope default normalization",
    );
  });

  it("validates unknown release_scope and rejects before test/build", () => {
    expectContains(
      workflow,
      "case \"${RELEASE_SCOPE}\" in",
      "scope case block",
    );
    expectContains(workflow, "full|kiosk)", "full/kiosk allow list");
    expectContains(workflow, "*)", "unknown scope branch");
    expectContains(
      workflow,
      "Invalid release_scope: ${RELEASE_SCOPE}. Must be one of: full, kiosk",
      "invalid scope failure message",
    );
    expectContains(workflow, "exit 1", "unknown scope exits");
  });

  it("uses full/picked test command for each release scope", () => {
    expectContains(
      workflow,
      "- name: Required regression tests\n        if: env.RELEASE_SCOPE == 'full'\n        run: npm run test:ci:required",
      "full test command",
    );
    expectContains(
      workflow,
      "- name: Required regression tests (kiosk scope)\n        if: env.RELEASE_SCOPE == 'kiosk'\n        run: npm run test:ci:kiosk-release",
      "kiosk test command",
    );
  });

  it("does not share kiosk-only Chromium setup with full scope", () => {
    expectContains(workflow, "Cache Playwright browsers (kiosk scope)", "kiosk browser cache step");
    expectContains(workflow, "if: env.RELEASE_SCOPE == 'kiosk'", "kiosk browser step scope guard");
    expectContains(
      workflow,
      "Install Playwright browsers (chromium)\n        if: env.RELEASE_SCOPE == 'kiosk' && steps.playwright-cache.outputs.cache-hit != 'true'",
      "kiosk cache miss install",
    );
    expectContains(
      workflow,
      "Install Playwright system dependencies\n        if: env.RELEASE_SCOPE == 'kiosk' && steps.playwright-cache.outputs.cache-hit == 'true'",
      "kiosk cache hit install",
    );
    const playwrightInstallWithDepsCount = (workflow.match(/npx playwright install --with-deps chromium/g) || []).length;
    assert.equal(playwrightInstallWithDepsCount, 1);
    const playwrightInstallDepsCount = (workflow.match(/npx playwright install-deps/g) || []).length;
    assert.equal(playwrightInstallDepsCount, 1);
  });

  it("keeps confirmation phrases path-localized and non-overlapping", () => {
    expectContains(
      workflow,
      "full)",
      "full confirm scope branch",
    );
    expectContains(
      workflow,
      "confirm_production_deploy must be exactly DEPLOY",
      "full confirmation phrase",
    );
    expectContains(
      workflow,
      "kiosk)",
      "kiosk confirm scope branch",
    );
    expectContains(
      workflow,
      "confirm_production_deploy must be exactly DEPLOY_KIOSK",
      "kiosk confirmation phrase",
    );
    assert.equal(
      (workflow.match(/confirm_production_deploy must be exactly DEPLOY(?!_KIOSK)/g) || []).length,
      1,
    );
    assert.equal(
      (workflow.match(/confirm_production_deploy must be exactly DEPLOY_KIOSK/g) || []).length,
      1,
    );
  });

  it("keeps full path full-path build and deploy invariants", () => {
    expectContains(
      workflow,
      "run: npm run build",
      "full build command",
    );
    expectContains(
      workflow,
      "run: npm run bundle:check",
      "bundle check command",
    );
    expectContains(
      workflow,
      "run: npm run bundle:assert",
      "bundle assert command",
    );
    expectContains(
      workflow,
      "run: npx wrangler deploy --dry-run",
      "verify dry-run command",
    );
  });

  it("keeps deploy job SHA verification and production commands", () => {
    expectContains(
      workflow,
      "if: github.ref == 'refs/heads/main'",
      "deploy verify scope gate",
    );
    expectContains(
      workflow,
      "- name: Verify fixed clean main SHA",
      "sha verification step",
    );
    expectContains(
      workflow,
      "run: npx wrangler deploy --config wrangler.production.toml --dry-run --keep-vars",
      "production dry-run deploy command",
    );
    expectContains(
      workflow,
      "run: npx wrangler deploy --config wrangler.production.toml --keep-vars",
      "production deploy command",
    );
  });
});
