/**
 * Ensures SharePoint 4xx responses surface during Playwright runs.
 * If `[SP ERROR]` logs are missing:
 * 1. Confirm every spec that accesses SharePoint imports `@/test/captureSp400`.
 * 2. Verify the dev/playwright guard in `src/lib/spClient.ts` evaluates truthy.
 * 3. Temporarily promote the log to `console.error` to confirm the pipeline.
 */
import { test } from '@playwright/test';
import { captureSp400 } from './e2e/_helpers/captureSp400';

test.beforeEach(({ page }) => {
  captureSp400(page);
});
