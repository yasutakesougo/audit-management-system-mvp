import type { Page } from '@playwright/test';
import { bootstrapDashboard } from '../../e2e/utils/bootstrapApp';

vi.mock('../../e2e/utils/wait', () => ({
  waitForAppShellReady: vi.fn().mockResolvedValue(undefined),
}));

type RuntimeWindow = typeof window & { __ENV__?: Record<string, string> };

const createPage = (): Page => ({
  addInitScript: vi.fn(async (callback: (arg: unknown) => void, arg: unknown) => {
    callback(arg);
  }),
  goto: vi.fn().mockResolvedValue(null),
} as unknown as Page);

describe('bootstrapDashboard data provider contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (window as RuntimeWindow).__ENV__;
  });

  it('keeps SharePoint as the default provider', async () => {
    const page = createPage();

    await bootstrapDashboard(page);

    expect((window as RuntimeWindow).__ENV__).toEqual(expect.objectContaining({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_SKIP_SHAREPOINT: '0',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_DEMO_MODE: '0',
    }));
  });

  it('makes memory authoritative over conflicting SharePoint flags and save modes', async () => {
    (window as RuntimeWindow).__ENV__ = {
      VITE_FORCE_SHAREPOINT: '1',
      VITE_SKIP_SHAREPOINT: '0',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_DEMO_MODE: '0',
      VITE_FEATURE_SCHEDULES_SP: '1',
      VITE_FEATURE_USERS_SP: '1',
      VITE_SCHEDULES_SAVE_MODE: 'real',
      VITE_STAFF_ATTENDANCE_STORAGE: 'sharepoint',
      VITE_HANDOFF_STORAGE: 'sharepoint',
    };
    const page = createPage();

    await bootstrapDashboard(page, { dataProvider: 'memory' });

    expect((window as RuntimeWindow).__ENV__).toEqual(expect.objectContaining({
      VITE_FORCE_SHAREPOINT: '0',
      VITE_SKIP_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'memory',
      VITE_DEMO_MODE: '1',
      VITE_FEATURE_SCHEDULES_SP: '0',
      VITE_FEATURE_USERS_SP: '0',
      VITE_SCHEDULES_SAVE_MODE: 'mock',
      VITE_STAFF_ATTENDANCE_STORAGE: 'local',
      VITE_HANDOFF_STORAGE: 'local',
    }));
  });
});
