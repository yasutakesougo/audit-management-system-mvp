import type { Page } from '@playwright/test';
import { enableNurseFlags } from '../utils/enableNurseFlag';

type Basis = 'utc' | 'local';

type SetupOptions = {
  bulk?: boolean;
  minuteBasis?: Basis;
};

type ContextCapable = {
  context: () => ReturnType<Page['context']>;
};

const hasContextFunction = (candidate: unknown): candidate is ContextCapable =>
  typeof (candidate as { context?: unknown }).context === 'function';

export async function setupNurseFlags(page: Page, options: SetupOptions = {}): Promise<void> {
  // 環境変数のバリデーション
  const rawBasis = process.env.NURSE_MINUTE_BASIS?.toLowerCase();
  const resolvedEnvBasis: Basis | undefined =
    rawBasis === 'utc' || rawBasis === 'local' ? rawBasis : undefined;

  if (rawBasis && !resolvedEnvBasis && process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line no-console
    console.warn(`[setupNurseFlags] Invalid NURSE_MINUTE_BASIS="${rawBasis}", falling back to 'utc'`);
  }

  const basis: Basis = options.minuteBasis ?? resolvedEnvBasis ?? 'utc';
  const flagOptions = {
    nurseUI: true,
    bulkEntry: options.bulk ?? false,
    minuteBasis: basis,
  } as const;

  // Playwright (E2E) では context() が存在する
  if (hasContextFunction(page)) {
    await enableNurseFlags(page.context(), flagOptions);
    await enableNurseFlags(page, flagOptions);
    return;
  }

  // Vitest (unit) ではモック page に context() が無い
  await enableNurseFlags(page, flagOptions);
}
