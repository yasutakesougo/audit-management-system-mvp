import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UseSP } from '../../src/lib/spClient';
import * as spClient from '../../src/lib/spClient';

const BASE_CONFIG = {
  resource: 'https://contoso.sharepoint.com',
  siteRel: '/sites/Audit',
  baseUrl: 'https://contoso.sharepoint.com/sites/Audit/_api/web',
};

describe('spClient optional field fallback', () => {

  afterEach(() => {
    vi.restoreAllMocks();
    spClient.__test__.resetMissingOptionalFieldsCache();
  });

  it('retries without optional fields when SharePoint reports missing FullNameKana', async () => {
    vi.spyOn(spClient, 'ensureConfig').mockReturnValue(BASE_CONFIG);

  const spFetch = vi.fn();
  const client = { spFetch: spFetch as unknown as UseSP['spFetch'] } as unknown as UseSP;

    spFetch.mockImplementationOnce(() => {
      throw new Error("The field or property 'FullNameKana' does not exist.");
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(path).not.toContain('FullNameKana');
      expect(path).toContain('Furigana');
      return new Response(JSON.stringify({ value: [{ Id: 1 }] }), { status: 200 });
    });

    const rows = await spClient.getUsersMaster(client, 50);

    expect(rows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);
  });

  it('drops any non-required Staff_Master column when SharePoint reports it missing', async () => {
    vi.spyOn(spClient, 'ensureConfig').mockReturnValue(BASE_CONFIG);

  const spFetch = vi.fn();
  const client = { spFetch: spFetch as unknown as UseSP['spFetch'] } as unknown as UseSP;

    spFetch.mockImplementationOnce(() => {
      throw new Error("The field or property 'Email' does not exist.");
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(path).not.toContain('Email');
      expect(path).toContain('StaffID');
      return new Response(JSON.stringify({ value: [{ Id: 10 }] }), { status: 200 });
    });

    const rows = await spClient.getStaffMaster(client, 50);

    expect(rows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to requesting Staff_Master without StaffID when the column is absent', async () => {
    vi.spyOn(spClient, 'ensureConfig').mockReturnValue(BASE_CONFIG);

    const spFetch = vi.fn();
    const client = { spFetch: spFetch as unknown as UseSP['spFetch'] } as unknown as UseSP;

    let firstPath: string | null = null;

    spFetch.mockImplementationOnce((path: string) => {
      firstPath = path;
      throw new Error("The field or property 'StaffID' does not exist.");
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(firstPath).not.toBeNull();
      expect(firstPath).toContain('StaffID');
      expect(path).not.toContain('StaffID');
      return new Response(JSON.stringify({ value: [{ Id: 42 }] }), { status: 200 });
    });

    const rows = await spClient.getStaffMaster(client, 10);

    expect(rows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);
  });

  it('narrows Staff_Master select list even if SharePoint error does not reveal the missing field', async () => {
    vi.spyOn(spClient, 'ensureConfig').mockReturnValue(BASE_CONFIG);

    const spFetch = vi.fn();
    const client = { spFetch: spFetch as unknown as UseSP['spFetch'] } as unknown as UseSP;

    let firstPath: string | null = null;

    spFetch.mockImplementationOnce((path: string) => {
      firstPath = path;
      throw new Error('One or more field types are not installed properly. Go to the list settings page to delete these fields.');
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(firstPath).not.toBeNull();
      const selectMatcher = /\$select=([^&]+)/;
      const firstSelect = firstPath?.match(selectMatcher)?.[1] ?? '';
      const secondSelect = path.match(selectMatcher)?.[1] ?? '';
      const firstCount = firstSelect ? firstSelect.split(',').length : 0;
      const secondCount = secondSelect ? secondSelect.split(',').length : 0;
      expect(secondCount).toBeLessThan(firstCount);
      return new Response(JSON.stringify({ value: [{ Id: 20 }] }), { status: 200 });
    });

    const rows = await spClient.getStaffMaster(client, 25);

    expect(rows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);
  });

  it('skips cached optional fields on subsequent requests', async () => {
    vi.spyOn(spClient, 'ensureConfig').mockReturnValue(BASE_CONFIG);

    const spFetch = vi.fn();
    const client = { spFetch: spFetch as unknown as UseSP['spFetch'] } as unknown as UseSP;

    spFetch.mockImplementationOnce(() => {
      throw new Error("The field or property 'FullNameKana' does not exist.");
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(path).not.toContain('FullNameKana');
      return new Response(JSON.stringify({ value: [{ Id: 1 }] }), { status: 200 });
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(path).not.toContain('FullNameKana');
      return new Response(JSON.stringify({ value: [{ Id: 2 }] }), { status: 200 });
    });

    await spClient.getUsersMaster(client, 10);
    const secondRows = await spClient.getUsersMaster(client, 10);

    expect(secondRows).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(3);
    const firstCallPath = spFetch.mock.calls[0]?.[0] as string;
    const thirdCallPath = spFetch.mock.calls[2]?.[0] as string;
    expect(firstCallPath).toContain('FullNameKana');
    expect(thirdCallPath).not.toContain('FullNameKana');
  });

  it('restores optional fields after cache reset', async () => {
    vi.spyOn(spClient, 'ensureConfig').mockReturnValue(BASE_CONFIG);

    const spFetch = vi.fn();
    const client = { spFetch: spFetch as unknown as UseSP['spFetch'] } as unknown as UseSP;

    spFetch.mockImplementationOnce(() => {
      throw new Error("The field or property 'FullNameKana' does not exist.");
    });

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(path).not.toContain('FullNameKana');
      return new Response(JSON.stringify({ value: [{ Id: 5 }] }), { status: 200 });
    });

    await spClient.getUsersMaster(client, 10);

    spClient.__test__.resetMissingOptionalFieldsCache();
    spFetch.mockClear();

    spFetch.mockImplementationOnce(async (path: string) => {
      expect(path).toContain('FullNameKana');
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    });

    const rows = await spClient.getUsersMaster(client, 10);

    expect(rows).toHaveLength(0);
    expect(spFetch).toHaveBeenCalledTimes(1);
  });

  it('parses staff list overrides into identifiers', () => {
    const { resolveStaffListIdentifier } = spClient.__test__;

    expect(resolveStaffListIdentifier('Custom_List', '')).toEqual({ type: 'title', value: 'Custom_List' });

    const guid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(resolveStaffListIdentifier(`guid:${guid}`, '')).toEqual({ type: 'guid', value: guid });

    const braceGuid = '{BBBBBBBB-CCCC-DDDD-EEEE-FFFFFFFFFFFF}';
    expect(resolveStaffListIdentifier('', braceGuid)).toEqual({
      type: 'guid',
      value: 'BBBBBBBB-CCCC-DDDD-EEEE-FFFFFFFFFFFF',
    });
  });
});
