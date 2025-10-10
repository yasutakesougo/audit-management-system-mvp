import type { Page } from '@playwright/test';

type MockEnsureOptions = {
  skipProvisioning?: boolean;
};

/**
 * Ensures schedule provisioning logic is bypassed during E2E runs by toggling the
 * global flag consumed by useEnsureScheduleList.
 */
export async function mockEnsureScheduleList(page: Page, options: MockEnsureOptions = {}): Promise<void> {
  const skip = options.skipProvisioning ?? true;
  await page.addInitScript(({ shouldSkip }) => {
    const scope = window as typeof window & { __SKIP_ENSURE_SCHEDULE__?: boolean };
    if (shouldSkip) {
      scope.__SKIP_ENSURE_SCHEDULE__ = true;
    }
  }, { shouldSkip: skip });
}
