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
  commitId: 'CommitId',
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

const parent = (
  id: number,
  title: string,
  latestVersion: number,
  latestCommitId: string | null = null,
  legacyUserId = 'LEGACY',
) => ({
  Id: id,
  Title: title,
  RecordDate: `${title}T00:00:00Z`,
  ReporterName: 'Staff',
  ReporterRole: 'Staff',
  User_x0020_Rows_x0020_JSON: JSON.stringify([userRow(legacyUserId)]),
  UserCount: 1,
  LatestVersion: latestVersion,
  LatestCommitId: latestCommitId,
});

describe('DailyRecordDataAccess DAILY-RECORD-PERSISTENCE-V1', () => {
  it('load() returns only LatestVersion + LatestCommitId children (AC-13)', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        expect(decoded).toContain("Parent_x0020_ID eq 1 and Version eq 2 and CommitId eq 'commit-v2'");
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 1,
              Version: 2,
              CommitId: 'commit-v2',
              Payload: JSON.stringify(userRow('U-CURRENT')),
              RowNo: 1,
            },
          ],
        });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 2, 'commit-v2')] });
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

  it('Test 1 / AC-9 / AC-10: after retry commit, load hydrates only retry CommitId rows', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        expect(decoded).toContain("CommitId eq 'retry-B'");
        expect(decoded).not.toContain('failed-A');
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'retry-B',
              Payload: JSON.stringify(userRow('U001')),
              RowNo: 1,
            },
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'retry-B',
              Payload: JSON.stringify(userRow('U002')),
              RowNo: 2,
            },
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'retry-B',
              Payload: JSON.stringify(userRow('U003')),
              RowNo: 3,
            },
          ],
        });
      }
      return jsonResponse({
        value: [parent(1, '2026-08-27', 5, 'retry-B')],
      });
    });

    const data = new DailyRecordDataAccess(spFetch);
    const record = await data.load(
      '2026-08-27',
      "lists/getbytitle('SupportRecord_Daily')",
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(record?.userRows.map((row) => row.userId)).toEqual(['U001', 'U002', 'U003']);
  });

  it('Test A / AC-10: list() also hydrates only retry CommitId after partial failure + retry', async () => {
    const childRequests: string[] = [];
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        childRequests.push(decoded);
        expect(decoded).toContain("CommitId eq 'retry-B'");
        expect(decoded).not.toContain('failed-A');
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'retry-B',
              Payload: JSON.stringify(userRow('U001')),
              RowNo: 1,
            },
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'retry-B',
              Payload: JSON.stringify(userRow('U002')),
              RowNo: 2,
            },
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'retry-B',
              Payload: JSON.stringify(userRow('U003')),
              RowNo: 3,
            },
          ],
        });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 5, 'retry-B')] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    const records = await data.list(
      { range: { startDate: '2026-08-27', endDate: '2026-08-27' } },
      "lists/getbytitle('SupportRecord_Daily')",
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(childRequests).toHaveLength(1);
    expect(records).toHaveLength(1);
    expect(records[0].userRows.map((row) => row.userId)).toEqual(['U001', 'U002', 'U003']);
  });

  it('Test 2 / AC-11 / AC-12: concurrent same-version keeps only winning LatestCommitId current', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        expect(decoded).toContain("CommitId eq 'A'");
        expect(decoded).not.toContain("CommitId eq 'B'");
        return jsonResponse({
          value: [
            {
              Parent_x0020_ID: 1,
              Version: 5,
              CommitId: 'A',
              Payload: JSON.stringify(userRow('U-A')),
              RowNo: 1,
            },
          ],
        });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 5, 'A')] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    const record = await data.load(
      '2026-08-27',
      "lists/getbytitle('SupportRecord_Daily')",
      'DailyRecordRows',
      resolvedRowsFields,
    );

    expect(record?.userRows.map((row) => row.userId)).toEqual(['U-A']);
  });

  it('Test 3: committed target missing fails closed without legacy JSON fallback', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        // Only CommitId B rows exist; parent points to A — filter returns empty.
        return jsonResponse({ value: [] });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 5, 'A', 'U-STALE')] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    await expect(
      data.load(
        '2026-08-27',
        "lists/getbytitle('SupportRecord_Daily')",
        'DailyRecordRows',
        resolvedRowsFields,
      ),
    ).rejects.toThrow(/LatestVersion 5 \/ LatestCommitId A.*no current child rows/);
  });

  it('Test 4 / AC-14: missing LatestCommitId must not fall back to all Version rows', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        throw new Error('should not query children when LatestCommitId is missing');
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 5, null, 'U-STALE')] });
    });

    const data = new DailyRecordDataAccess(spFetch);
    await expect(
      data.load(
        '2026-08-27',
        "lists/getbytitle('SupportRecord_Daily')",
        'DailyRecordRows',
        resolvedRowsFields,
      ),
    ).rejects.toThrow(/LatestCommitId is missing/);
  });

  it('Test 5 / AC-16: LatestVersion 0 keeps legacy JSON when no unversioned children exist', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        const decoded = decodeURIComponent(target);
        expect(decoded).toContain('(Version eq 0 or Version eq null)');
        expect(decoded).not.toContain('CommitId');
        return jsonResponse({ value: [] });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 0, null, 'U-LEGACY')] });
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

  it('list() hydrates each parent from LatestVersion + LatestCommitId (AC-13)', async () => {
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
              CommitId: 'c-v2',
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
          parent(1, '2026-08-27', 2, 'c-v2'),
          parent(2, '2026-08-26', 0, null),
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
    expect(childRequests[0]).toContain("Parent_x0020_ID eq 1 and Version eq 2 and CommitId eq 'c-v2'");
    expect(childRequests[0]).toContain('Parent_x0020_ID eq 2 and (Version eq 0 or Version eq null)');
    expect(records.map((record) => record.userRows[0]?.userId)).toEqual(['U-V2', 'U-V0']);
  });

  it('list() rejects instead of exposing legacy JSON when committed current children are missing', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        return jsonResponse({ value: [] });
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 3, 'commit-missing', 'U-STALE')] });
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
    ).rejects.toThrow(/LatestVersion 3 \/ LatestCommitId commit-missing.*no current child rows/);
  });

  it('list() fails closed when LatestVersion > 0 but LatestCommitId is absent', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      const target = String(url);
      if (target.includes('DailyRecordRows')) {
        throw new Error('should not query children when LatestCommitId is missing');
      }
      return jsonResponse({ value: [parent(1, '2026-08-27', 3, null, 'U-STALE')] });
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
    ).rejects.toThrow(/LatestCommitId is missing/);
  });
});
