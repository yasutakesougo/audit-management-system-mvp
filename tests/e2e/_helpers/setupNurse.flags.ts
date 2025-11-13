import type { BrowserContext, Page } from '@playwright/test';
import { enableNurseFlags } from '../utils/enableNurseFlag';

type Basis = 'utc' | 'local';

type SetupOptions = {
  bulk?: boolean;
};

type MaybePage = Partial<Page> & { context?: () => BrowserContext };

export async function setupNurseFlags(page: MaybePage, options: SetupOptions = {}): Promise<void> {
  const basis = (process.env.NURSE_MINUTE_BASIS as Basis | undefined) ?? 'utc';
  const flagOptions = {
    nurseUI: true,
    bulkEntry: options.bulk ?? false,
    minuteBasis: basis,
  } as const;

  // Add the init script at the context level so new pages inherit the flags, then
  // apply directly to the current page for the immediate navigation under test.
  if (typeof page?.context === 'function') {
    await enableNurseFlags(page.context(), flagOptions);
  } else if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line no-console
    console.debug('[setupNurseFlags] page.context() not available; skipping context-level flags');
  } else {
    // eslint-disable-next-line no-console
    console.warn('[setupNurseFlags] page.context() missing; skipping context-level flags');
  }

  if (page) {
    await enableNurseFlags(page as Page, flagOptions);
  }
}
