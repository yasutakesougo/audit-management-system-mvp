import { describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { DailyRecordSaver } from './Saver';
import type { ResolvedParentFields, ResolvedRowsFields, SharePointItem } from '../../constants';
import type { SaveDailyRecordInput } from '../../../../domain/legacy/DailyRecordRepository';

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const resolvedParentFields: ResolvedParentFields = {
  title: 'Title',
  recordDate: 'RecordDate',
  reporterName: 'ReporterName',
  reporterRole: 'ReporterRole',
  userRowsJSON: 'User_x0020_Rows_x0020_JSON',
  userCount: 'UserCount',
  latestVersion: 'LatestVersion',
};

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

const sampleRow = (userId: string) => ({
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

const sampleInput = (userIds: string[]): SaveDailyRecordInput => ({
  date: '2026-08-27',
  reporter: { name: 'Staff', role: 'Staff' },
  userRows: userIds.map(sampleRow),
  userCount: userIds.length,
});

describe('DailyRecordSaver DAILY-RECORD-PERSISTENCE-V1', () => {
  it('appends Versioned children and commits LatestVersion without DELETE (AC-1, AC-2, AC-3)', async () => {
    const childBodies: Record<string, unknown>[] = [];
    const parentMerges: Record<string, unknown>[] = [];
    const methods: Array<{ url: string; method?: string; httpMethod?: string }> = [];

    const existing: SharePointItem = {
      Id: 42,
      Title: '2026-08-27',
      LatestVersion: 4,
      UserCount: 2,
      __metadata: { etag: '"etag-4"' },
    };

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
      methods.push({ url, method: init?.method, httpMethod });

      if (url.includes('/items') && init?.method === 'POST' && !url.includes('items(')) {
        childBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 1000 + childBodies.length });
      }

      if (url.includes('items(42)') && httpMethod === 'MERGE') {
        parentMerges.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }

      return jsonResponse({ value: [] });
    });

    const saver = new DailyRecordSaver(spFetch);
    await saver.save(
      sampleInput(['U001', 'U002']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      existing,
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(methods.some((call) => call.httpMethod === 'DELETE')).toBe(false);
    expect(childBodies).toHaveLength(2);
    expect(childBodies.every((row) => row.Version === 5)).toBe(true);
    expect(parentMerges).toHaveLength(1);
    expect(parentMerges[0].LatestVersion).toBe(5);
    expect(parentMerges[0].UserCount).toBe(2);
  });

  it('keeps the old LatestVersion when a child POST fails mid-save (AC-4)', async () => {
    let childPosts = 0;
    const parentMerges: Record<string, unknown>[] = [];

    const existing: SharePointItem = {
      Id: 7,
      Title: '2026-08-27',
      LatestVersion: 4,
    };

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
      if (url.includes("DailyRecordRows')/items") && init?.method === 'POST' && !url.includes('items(')) {
        childPosts += 1;
        if (childPosts === 3) {
          throw new Error('network failed on child 3');
        }
        return jsonResponse({ Id: 2000 + childPosts });
      }
      if (url.includes('items(7)') && httpMethod === 'MERGE') {
        parentMerges.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ value: [] });
    });

    const saver = new DailyRecordSaver(spFetch);
    await expect(
      saver.save(
        sampleInput(['U001', 'U002', 'U003']),
        "lists/getbytitle('SupportRecord_Daily')",
        "lists/getbytitle('DailyRecordRows')",
        existing,
        resolvedRowsFields,
        resolvedParentFields,
      ),
    ).rejects.toThrow(/network failed on child 3/);

    expect(childPosts).toBe(3);
    expect(parentMerges).toHaveLength(0);
  });

  it('creates a parent at LatestVersion 0 then commits v1 after children exist', async () => {
    const creates: Record<string, unknown>[] = [];
    const childBodies: Record<string, unknown>[] = [];
    const merges: Record<string, unknown>[] = [];

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
      if (url.endsWith('/items') && init?.method === 'POST' && url.includes('SupportRecord_Daily')) {
        creates.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 90 });
      }
      if (url.includes('DailyRecordRows') && init?.method === 'POST' && !url.includes('items(')) {
        childBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 901 });
      }
      if (url.includes('items(90)') && httpMethod === 'MERGE') {
        merges.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ value: [] });
    });

    const saver = new DailyRecordSaver(spFetch);
    await saver.save(
      sampleInput(['U001']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      null,
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(creates[0].LatestVersion).toBe(0);
    expect(childBodies[0].Version).toBe(1);
    expect(merges[0].LatestVersion).toBe(1);
  });
});
