import type { Page } from '@playwright/test';

export type ScheduleEnvOptions = {
  enableWeekV2?: boolean;
  env?: Record<string, string>;
  storage?: Record<string, string>;
  logFixtures?: boolean;
};

const DEFAULT_ENV = {
  VITE_E2E_MSAL_MOCK: '1',
  VITE_SKIP_LOGIN: '1',
  VITE_FEATURE_SCHEDULES: '1',
  VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
} satisfies Record<string, string>;

const DEFAULT_STORAGE = {
  'feature:schedules': '1',
  skipLogin: '1',
} satisfies Record<string, string>;

const buildEnvSnapshot = (options?: ScheduleEnvOptions): { env: Record<string, string>; storage: Record<string, string> } => {
  const env = { ...DEFAULT_ENV, ...(options?.env ?? {}) };

  if (typeof options?.enableWeekV2 === 'boolean') {
    env.VITE_FEATURE_SCHEDULES_WEEK_V2 = options.enableWeekV2 ? '1' : '0';
  }

  return {
    env,
    storage: { ...DEFAULT_STORAGE, ...(options?.storage ?? {}) },
  };
};

/**
 * Common Playwright bootstrap for schedule E2E specs.
 * Injects __ENV__ flags and localStorage toggles so the week V2 UI mounts consistently.
 */
export const bootstrapScheduleEnv = async (page: Page, options?: ScheduleEnvOptions): Promise<void> => {
  const snapshot = buildEnvSnapshot(options);

  if (options?.logFixtures !== false) {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });
  }

  await page.addInitScript(({ env, storage }) => {
    const scope = window as typeof window & { __ENV__?: Record<string, string> };
    scope.__ENV__ = {
      ...(scope.__ENV__ ?? {}),
      ...env,
    };
    for (const [key, value] of Object.entries(storage)) {
      window.localStorage.setItem(key, value);
    }
  }, snapshot);
};
