import * as rootEnv from '@/env';
import { __resetAppConfigForTests } from '@/lib/env';
import { resetParsedEnvForTests } from '@/lib/env.schema';
import { __test__, getStaffMaster, getUsersMaster } from '@/lib/spClient';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const buildResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('spClient master list helpers', () => {
  beforeEach(() => {
    __test__.resetMissingOptionalFieldsCache();
    resetParsedEnvForTests();
    __resetAppConfigForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __test__.resetMissingOptionalFieldsCache();
  });

  it('retries user master fetches when SharePoint reports missing optional fields', async () => {
    const runtimeSpy = vi.spyOn(rootEnv, 'getRuntimeEnv').mockReturnValue({
      VITE_SP_LIST_USERS: 'Users_Master',
    });

    const spFetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("The field 'FullNameKana' does not exist");
      })
      .mockResolvedValueOnce(buildResponse({ value: [{ Id: 1 }] }));

  const client = { spFetch } as unknown as Parameters<typeof getUsersMaster>[0];
    const rows = await getUsersMaster(client, 10);

    expect(rows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(spFetch.mock.calls[1]?.[0]).toContain('$top=10');

    runtimeSpy.mockRestore();
  });

  it('drops optional fields opportunistically when error details are unavailable', async () => {
    const runtimeSpy = vi.spyOn(rootEnv, 'getRuntimeEnv').mockReturnValue({
      VITE_SP_LIST_USERS: 'Users_Master',
    });

    const spFetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error('Network timeout');
      })
      .mockResolvedValueOnce(buildResponse({ value: [{ Id: 2 }] }));

  const client = { spFetch } as unknown as Parameters<typeof getUsersMaster>[0];
    const rows = await getUsersMaster(client, undefined);

    expect(rows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);

    runtimeSpy.mockRestore();
  });

  it('honours staff list guid overrides and clamps the requested page size', async () => {
    const guid = '{11111111-2222-3333-4444-555555555555}';
    const runtimeSpy = vi.spyOn(rootEnv, 'getRuntimeEnv').mockReturnValue({
      VITE_SP_LIST_STAFF: 'guid:deadbeef-dead-beef-dead-beefdeadbeef',
      VITE_SP_LIST_STAFF_GUID: guid,
    });

    const spFetch = vi.fn().mockResolvedValue(buildResponse({ value: [] }));

  const client = { spFetch } as unknown as Parameters<typeof getStaffMaster>[0];
    await getStaffMaster(client, 99999);

    expect(spFetch).toHaveBeenCalledTimes(1);
    const path = spFetch.mock.calls[0]?.[0] as string;
    expect(path).toMatch(/lists\(guid'11111111-2222-3333-4444-555555555555'\)/);
    expect(path).toMatch(/\$top=5000/);

    runtimeSpy.mockRestore();
  });

  it('falls back to default staff list title when overrides are empty', async () => {
    const runtimeSpy = vi.spyOn(rootEnv, 'getRuntimeEnv').mockReturnValue({
      VITE_SP_LIST_STAFF: '   ',
      VITE_SP_LIST_STAFF_GUID: '   ',
    });

    const spFetch = vi.fn().mockResolvedValue(buildResponse({ value: [] }));
  const client = { spFetch } as unknown as Parameters<typeof getStaffMaster>[0];
    await getStaffMaster(client, -1);

    const path = spFetch.mock.calls[0]?.[0] as string;
    expect(path).toContain("getbytitle('Staff_Master')");

    runtimeSpy.mockRestore();
  });
});

describe('resolveStaffListIdentifier', () => {
  it('parses guid prefixes and braces consistently', () => {
    expect(__test__.resolveStaffListIdentifier('guid:{AAAA1111-BBBB-2222-CCCC-333333333333}', '')).toEqual({
      type: 'guid',
      value: 'AAAA1111-BBBB-2222-CCCC-333333333333',
    });
    expect(__test__.resolveStaffListIdentifier('custom-title', '{DDDD1111-EEEE-2222-FFFF-444444444444}')).toEqual({
      type: 'guid',
      value: 'DDDD1111-EEEE-2222-FFFF-444444444444',
    });
    expect(__test__.resolveStaffListIdentifier('  staff-name  ', '')).toEqual({ type: 'title', value: 'staff-name' });
  });
});
