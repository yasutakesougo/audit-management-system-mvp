import { describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { DailyRecordIntegrityScanner } from './IntegrityScanner';

describe('DailyRecordIntegrityScanner', () => {
  const resolvedRowsFields = {
    parentId: 'Parent_x0020_ID',
    userId: 'User_x0020_ID',
    version: 'Version',
    status: 'Status',
    payload: 'Payload',
    recordedAt: 'Recorded_x0020_At',
    rowKey: 'DailyRecordRow_x0020_Key',
  };

  it('returns empty result when dates are empty without querying', async () => {
    const spFetch = vi.fn(async () => ({ ok: true, json: async () => ({ value: [] }) })) as SpFetchFn;
    const scanner = new DailyRecordIntegrityScanner(spFetch);

    const result = await scanner.scan([], 'SupportRecord_Daily', 'DailyRecordRows', resolvedRowsFields);

    expect(result).toEqual([]);
    expect(spFetch).not.toHaveBeenCalled();
  });

  it('classifies mismatch between parent latest version and child versions', async () => {
    const spFetch = vi.fn(async (url: string) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        return {
          ok: true,
          json: async () => ({
            value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 3 }],
          }),
        };
      }

      if (url.includes('DailyRecordRows/items?$filter=')) {
        return {
          ok: true,
          json: async () => ({
            value: [
              {
                Parent_x0020_ID: 11,
                User_x0020_ID: 'U001',
                Version: 1,
                Status: 'committed',
                Recorded_x0020_At: '2026-06-10T00:00:00Z',
              },
            ],
          }),
        };
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        return {
          ok: true,
          json: async () => ({ value: [] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ value: [] }),
      };
    }) as SpFetchFn;

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.map((item) => item.type)).toContain('orphan_parent');
    expect(result).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledTimes(2);
  });

  it('continues when accessory probe fails and still reports orphan_parent', async () => {
    const spFetch = vi.fn(async (url: string) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        return {
          ok: true,
          json: async () => ({
            value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 2 }],
          }),
        };
      }

      if (url.includes('DailyRecordRows/items?$filter=')) {
        return {
          ok: true,
          json: async () => ({
            value: [
              {
                Parent_x0020_ID: 11,
                User_x0020_ID: 'U001',
                Version: 1,
                Status: 'committed',
                Recorded_x0020_At: '2026-06-10T00:00:00Z',
              },
            ],
          }),
        };
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        throw new Error('transport fetch failed');
      }

      return { ok: true, json: async () => ({ value: [] }) };
    }) as SpFetchFn;

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.map((item) => item.type)).toContain('orphan_parent');
    expect(result).toHaveLength(1);
  });
});
