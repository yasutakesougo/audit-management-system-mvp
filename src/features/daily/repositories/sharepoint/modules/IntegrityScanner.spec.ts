import { describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { DailyRecordIntegrityScanner } from './IntegrityScanner';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('DailyRecordIntegrityScanner', () => {
  const resolvedRowsFields = {
    parentId: 'Parent_x0020_ID',
    userId: 'User_x0020_ID',
    version: 'Version',
    commitId: 'CommitId',
    status: 'Status',
    payload: 'Payload',
    recordedAt: 'Recorded_x0020_At',
    rowKey: 'DailyRecordRow_x0020_Key',
  };

  it('returns empty result when dates are empty without querying', async () => {
    const spFetch = vi.fn<SpFetchFn>().mockResolvedValue(jsonResponse({ value: [] }));
    const scanner = new DailyRecordIntegrityScanner(spFetch);

    const result = await scanner.scan([], 'SupportRecord_Daily', 'DailyRecordRows', resolvedRowsFields);

    expect(result).toEqual([]);
    expect(spFetch).not.toHaveBeenCalled();
  });

  it('classifies orphan when LatestVersion+LatestCommitId has no matching children', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        expect(url).toContain('LatestCommitId');
        return jsonResponse({
          value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 3, LatestCommitId: 'commit-3' }],
        });
      }

      if (url.includes('DailyRecordRows') && url.includes('/items')) {
        expect(url).toContain('CommitId');
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 11,
              User_x0020_ID: 'U001',
              Version: 1,
              CommitId: 'commit-1',
              Status: 'committed',
              Recorded_x0020_At: '2026-06-10T00:00:00Z',
            },
          ],
        });
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        return jsonResponse({ value: [{ User_x0020_ID: 'U001' }] });
      }

      return jsonResponse({ value: [] });
    });

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.map((item) => item.type)).toContain('orphan_parent');
    expect(result.filter((item) => item.type === 'orphan_parent')).toHaveLength(1);
  });

  it('AC-14: reports CommitId ghost at same Version as LatestVersion', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        return jsonResponse({
          value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 5, LatestCommitId: 'A', UserCount: 1 }],
        });
      }

      if (url.includes('DailyRecordRows') && url.includes('/items')) {
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 11,
              User_x0020_ID: 'U001',
              Version: 5,
              CommitId: 'A',
              Status: 'completed',
              Recorded_x0020_At: '2026-06-10T00:00:00Z',
            },
            {
              Parent_x0020_ID: 11,
              User_x0020_ID: 'U001',
              Version: 5,
              CommitId: 'B',
              Status: 'completed',
              Recorded_x0020_At: '2026-06-10T00:00:01Z',
            },
          ],
        });
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        return jsonResponse({ value: [{ User_x0020_ID: 'U001' }] });
      }

      return jsonResponse({ value: [] });
    });

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.find((item) => item.type === 'version_mismatch')?.details).toContain('CommitId ghost');
    expect(result.find((item) => item.type === 'version_mismatch')?.details).toContain('B');
  });

  it('AC-14: reports missing LatestCommitId as integrity failure / HOLD path', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        return jsonResponse({
          value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 5 }],
        });
      }

      if (url.includes('DailyRecordRows') && url.includes('/items')) {
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 11,
              User_x0020_ID: 'U001',
              Version: 5,
              CommitId: 'any',
              Status: 'completed',
              Recorded_x0020_At: '2026-06-10T00:00:00Z',
            },
          ],
        });
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        return jsonResponse({ value: [{ User_x0020_ID: 'U001' }] });
      }

      return jsonResponse({ value: [] });
    });

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.find((item) => item.type === 'version_mismatch')?.details).toContain('LatestCommitId is missing');
  });

  it('returns HOLD/UNKNOWN instead of empty PASS when parent fetch throws', async () => {
    const spFetch = vi.fn<SpFetchFn>(async () => {
      throw new Error('sharepoint unavailable');
    });

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('scan_unknown');
    expect(result[0].details).toContain('HOLD');
  });

  it('returns HOLD/UNKNOWN instead of empty PASS when parent HTTP status is not ok', async () => {
    const spFetch = vi.fn<SpFetchFn>(async () =>
      new Response('forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } }),
    );

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.map((item) => item.type)).toEqual(['scan_unknown']);
  });

  it('selects UserCount and reports count_mismatch against current identity rows', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        expect(url).toContain('UserCount');
        return jsonResponse({
          value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 1, LatestCommitId: 'c1', UserCount: 5 }],
        });
      }

      if (url.includes('DailyRecordRows') && url.includes('/items')) {
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 11,
              User_x0020_ID: 'U001',
              Version: 1,
              CommitId: 'c1',
              Status: 'completed',
              Recorded_x0020_At: '2026-06-10T00:00:00Z',
            },
          ],
        });
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        return jsonResponse({ value: [{ User_x0020_ID: 'U001' }] });
      }

      return jsonResponse({ value: [] });
    });

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.map((item) => item.type)).toContain('count_mismatch');
  });

  it('continues when accessory probe fails and still reports orphan_parent', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (url.startsWith('SupportRecord_Daily/items?')) {
        return jsonResponse({
          value: [{ Id: 11, RecordDate: '2026-06-10T00:00:00Z', LatestVersion: 2, LatestCommitId: 'c2' }],
        });
      }

      if (url.includes('DailyRecordRows') && url.includes('/items')) {
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 11,
              User_x0020_ID: 'U001',
              Version: 1,
              CommitId: 'c1',
              Status: 'committed',
              Recorded_x0020_At: '2026-06-10T00:00:00Z',
            },
          ],
        });
      }

      if (url.includes("lists/getbytitle('UserTransport_Settings')/items?$filter=")) {
        throw new Error('transport fetch failed');
      }

      return jsonResponse({ value: [] });
    });

    const scanner = new DailyRecordIntegrityScanner(spFetch);
    const result = await scanner.scan(
      ['2026-06-10'],
      'SupportRecord_Daily',
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(result.map((item) => item.type)).toContain('orphan_parent');
  });
});
