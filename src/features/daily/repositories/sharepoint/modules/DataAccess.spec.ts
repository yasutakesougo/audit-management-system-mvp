import { describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ResolvedRowsFields } from '../constants';
import { DailyRecordDataAccess } from './DataAccess';

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const resolvedRowsFields: ResolvedRowsFields = {
  parentId: 'Parent_x0020_ID',
  userId: 'User_x0020_ID',
  version: 'Version',
  status: 'Status',
  payload: 'Payload',
  recordedAt: 'Recorded_x0020_At',
  rowKey: 'Title',
  rowNo: 'RowNo',
  recordDate: 'RecordDate',
};

const userRow = (userId: string) => ({
  userId,
  userName: userId,
  amActivity: '',
  pmActivity: '',
  lunchAmount: '',
  problemBehavior: {
    selfHarm: false,
    otherInjury: false,
    loudVoice: false,
    pica: false,
    other: false,
  },
  specialNotes: '',
  behaviorTags: [],
});

const parent = (id: number, title: string, latestVersion: number, legacyUserId = 'LEGACY') => ({
  Id: id,
  Title: title,
  RecordDate: `${title}T00:00:00Z`,
  ReporterName: 'Staff',
  ReporterRole: 'Staff',
  User_x0020_Rows_x0020_JSON: JSON.stringify([userRow(legacyUserId)]),
  UserCount: 1,
  LatestVersion: latestVersion,
});

describe('DailyRecordDataAccess DAILY-RECORD-PERSISTENCE-V1', () => {
  it('load() returns only the committed LatestVersion children', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        expect(decoded).toContain('Parent_x0020_ID eq 1 and Version eq 2');
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 1,
              Version: 2,
              Payload: JSON.stringify(userRow('U-CURRENT')),
              RowNo: 1,
            },
          ],
        });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 2)] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    const record = await data.load(
      '2026-08-27',
      "lists/getbytitle('SupportRecord_Daily')",
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(record?.userRows.map((row) => row.userId)).toEqual(['U-CURRENT']);
  });

  it('load() rejects when LatestVersion > 0 but the committed version has no children', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        return jsonResponse({ value: [] });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 1)] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    await expect(
      data.load(
        '2026-08-27',
        "lists/getbytitle('SupportRecord_Daily')",
        'DailyRecordRows',
        resolvedRowsFields,
      ),
    ).rejects.toThrow(/LatestVersion 1.*no current-version child rows/);
  });

  it('load() keeps legacy parent JSON only when LatestVersion is 0 and no unversioned children exist', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        expect(decoded).toContain('(Version eq 0 or Version eq null)');
        return jsonResponse({ value: [] });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 0, 'U-LEGACY')] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    const record = await data.load(
      '2026-08-27',
      "lists/getbytitle('SupportRecord_Daily')",
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(record?.userRows.map((row) => row.userId)).toEqual(['U-LEGACY']);
  });

  it('list() hydrates each parent from its current version and never promotes unfinished higher versions', async () => {
    const childRequests: string[] = [];
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        childRequests.push(decoded);
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 1,
              Version: 2,
              Payload: JSON.stringify(userRow('U-V2')),
              RowNo: 1,
            },
            {
              Parent_x0020_ID: 2,
              Version: 0,
              Payload: JSON.stringify(userRow('U-V0')),
              RowNo: 1,
            },
          ],
        });
      }

      return jsonResponse({
        value: [
          parent(1, '2026-08-27', 2),
          parent(2, '2026-08-26', 0),
        ],
      });
    });

    const data = new DailyRecordDataAccess(spFetch);
    const records = await data.list(
      {
        range: { startDate: '2026-08-26', endDate: '2026-08-27' },
      },
      "lists/getbytitle('SupportRecord_Daily')",
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(childRequests).toHaveLength(1);
    expect(childRequests[0]).toContain('Parent_x0020_ID eq 1 and Version eq 2');
    expect(childRequests[0]).toContain('Parent_x0020_ID eq 2 and (Version eq 0 or Version eq null)');
    expect(records.map((record) => record.userRows[0]?.userId)).toEqual(['U-V2', 'U-V0']);
  });

  it('list() rejects instead of exposing legacy JSON when a committed version has no children', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        return jsonResponse({ value: [] });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 3, 'U-STALE')] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    await expect(
      data.list(
        {
          range: { startDate: '2026-08-27', endDate: '2026-08-27' },
        },
        "lists/getbytitle('SupportRecord_Daily')",
        'DailyRecordRows',
        resolvedRowsFields,
      ),
    ).rejects.toThrow(/LatestVersion 3.*no current-version child rows/);
  });
});
