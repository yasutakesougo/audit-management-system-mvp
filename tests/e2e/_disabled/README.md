# Disabled E2E Tests

This directory contains E2E test files that are temporarily disabled from Playwright test discovery.

## Files

### `auth-diagnostics.spec.ts`

**Disabled:** February 2026  
**Reason:** ESM/CJS loader conflict in CI/Playwright environment

The test file causes `ReferenceError: require is not defined in ES module scope` when Playwright attempts to parse it during test discovery, even when wrapped with `test.describe.skip()`. This occurs because ts-node's default CommonJS compilation conflicts with Playwright's ESM module expectations at file parse time (before test execution).

**Workaround:** Physical exclusion from `tests/e2e/` to prevent discovery  
**Configuration:** `testIgnore: '**/tests/e2e/_disabled/**'` in playwright.config.ts

**Future resolution:** Requires fixing the fundamental ESM loader configuration or rewriting the test to avoid browser DevTools API dependencies that trigger the loader conflict.
