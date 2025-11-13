import type { Page } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enableNurseFlagsMock = vi.fn();

vi.mock('../e2e/utils/enableNurseFlag', () => ({
  enableNurseFlags: enableNurseFlagsMock,
}));

describe('setupNurseFlags', () => {
  const page = {} as Page;

  beforeEach(() => {
    vi.resetModules();
    enableNurseFlagsMock.mockReset();
    delete process.env.NURSE_MINUTE_BASIS;
  });

  afterEach(() => {
    delete process.env.NURSE_MINUTE_BASIS;
  });

  it('defaults to utc when env is not set', async () => {
    const { setupNurseFlags } = await import('../e2e/_helpers/setupNurse.flags');

    await setupNurseFlags(page);

    expect(enableNurseFlagsMock).toHaveBeenCalledWith(page, expect.objectContaining({
      nurseUI: true,
      bulkEntry: false,
      minuteBasis: 'utc',
    }));
  });

  it('passes through the local basis when env is set to local', async () => {
    process.env.NURSE_MINUTE_BASIS = 'local';
    const { setupNurseFlags } = await import('../e2e/_helpers/setupNurse.flags');

    await setupNurseFlags(page, { bulk: true });

    expect(enableNurseFlagsMock).toHaveBeenCalledWith(page, expect.objectContaining({
      nurseUI: true,
      bulkEntry: true,
      minuteBasis: 'local',
    }));
  });
});
