import type { BrowserContext, Page } from '@playwright/test';

type NurseFlagOptions = {
  nurseUI?: boolean;
  bulkEntry?: boolean;
  minuteBasis?: 'utc' | 'local';
};

const defaultOptions: Required<NurseFlagOptions> = {
  nurseUI: true,
  bulkEntry: true,
  minuteBasis: 'utc',
};

type FlagTarget = Pick<Page, 'addInitScript'> | Pick<BrowserContext, 'addInitScript'>;

export async function enableNurseFlags(target: FlagTarget, options: NurseFlagOptions = {}): Promise<void> {
  const resolved = { ...defaultOptions, ...options };
  await target.addInitScript(({ nurseUI, bulkEntry, minuteBasis }) => {
    if (nurseUI) {
      window.localStorage.setItem('VITE_FEATURE_NURSE_UI', '1');
      window.localStorage.setItem('feature:nurseUI', '1');
    }
    if (bulkEntry) {
      window.localStorage.setItem('VITE_NURSE_BULK_ENTRY', '1');
      window.localStorage.setItem('feature:nurseBulkEntry', '1');
    }
    if (minuteBasis === 'utc' || minuteBasis === 'local') {
      (window as typeof window & { __NURSE_MINUTE_BASIS__?: 'utc' | 'local' }).__NURSE_MINUTE_BASIS__ = minuteBasis;
    }
  }, resolved);
}

export async function enableNurseFlag(page: Page): Promise<void> {
  await enableNurseFlags(page);
}
