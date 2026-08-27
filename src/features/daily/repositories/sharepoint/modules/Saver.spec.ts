import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { DailyRecordSaver } from './Saver';
import { DailyRecordDataAccess } from './DataAccess';
import type { ResolvedParentFields, ResolvedRowsFields } from '../../constants';
import type { SaveDailyRecordInput } from '../../../../domain/legacy/DailyRecordRepository';
import * as persistence from '../../../domain/persistence/dailyRecordPersistence';

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const jsonResponseWithEtag = (value: unknown, etag: string, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ETag: etag },
  });

const isParentList = (url: string): boolean =>
  url.includes('/items?') &&
  (url.includes('$filter') || url.includes('%24filter')) &&
  url.includes('SupportRecord_Daily');

const isParentCommitEtagRefresh = (url: string, init?: RequestInit): boolean => {
  const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
  return String(url).includes('SupportRecord_Daily') &&
    String(url).includes('items(') &&
    !httpMethod &&
    init?.method !== 'POST';
};

const makeSaver = (spFetch: SpFetchFn) =>
  new DailyRecordSaver(spFetch, new DailyRecordDataAccess(spFetch));

const resolvedParentFields: ResolvedParentFields = {
  title: 'Title',
  recordDate: 'RecordDate',
  reporterName: 'ReporterName',
  reporterRole: 'ReporterRole',
  userRowsJSON: 'User_x0020_Rows_x0020_JSON',
  userCount: 'UserCount',
  latestVersion: 'LatestVersion',
  latestCommitId: 'LatestCommitId',
};

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

const existingParent42 = {
  Id: 42,
  Title: '2026-08-27',
  LatestVersion: 4,
  LatestCommitId: 'commit-v4',
  UserCount: 2,
  __metadata: { etag: '"etag-4"' },
};

describe('DailyRecordSaver DAILY-RECORD-PERSISTENCE-V1', () => {
  beforeEach(() => {
    vi.spyOn(persistence, 'createDailyRecordCommitId').mockReturnValue('commit-fixed');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends Version+CommitId children and commits LatestVersion+LatestCommitId without DELETE (AC-1, AC-2, AC-3, AC-15)', async () => {
    const childBodies: Record<string, unknown>[] = [];
    const parentMerges: Record<string, unknown>[] = [];
    const methods: Array<{ url: string; method?: string; httpMethod?: string; ifMatch?: string }> = [];

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      const httpMethod = headers?.['X-HTTP-Method'];
      methods.push({
        url,
        method: init?.method,
        httpMethod,
        ifMatch: headers?.['IF-MATCH'],
      });

      if (isParentList(String(url))) {
        return jsonResponse({ value: [existingParent42] });
      }

      if (isParentCommitEtagRefresh(String(url), init)) {
        return jsonResponseWithEtag({ Id: 42, LatestVersion: 4 }, '"etag-fresh"');
      }

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

    const saver = makeSaver(spFetch);
    await saver.save(
      sampleInput(['U001', 'U002']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(methods.some((call) => call.httpMethod === 'DELETE')).toBe(false);
    expect(childBodies).toHaveLength(2);
    expect(childBodies.every((row) => row.Version === 5)).toBe(true);
    expect(childBodies.every((row) => row.CommitId === 'commit-fixed')).toBe(true);
    expect(parentMerges).toHaveLength(1);
    expect(parentMerges[0].LatestVersion).toBe(5);
    expect(parentMerges[0].LatestCommitId).toBe('commit-fixed');
    expect(parentMerges[0].UserCount).toBe(2);
    expect(methods.find((call) => call.httpMethod === 'MERGE')?.ifMatch).toBe('"etag-fresh"');
  });

  it('AC-20: aborts before child POSTs when update path parent ETag is missing', async () => {
    let childPosts = 0;

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      if (isParentList(String(url))) {
        return jsonResponse({
          value: [{ Id: 7, Title: '2026-08-27', LatestVersion: 4, LatestCommitId: 'commit-v4' }],
        });
      }
      if (isParentCommitEtagRefresh(String(url), init)) {
        return jsonResponse({ Id: 7, LatestVersion: 4 });
      }
      if (url.includes("DailyRecordRows')/items") && init?.method === 'POST' && !url.includes('items(')) {
        childPosts += 1;
        return jsonResponse({ Id: 2000 + childPosts });
      }
      return jsonResponse({ value: [] });
    });

    const saver = makeSaver(spFetch);
    await expect(
      saver.save(
        sampleInput(['U001']),
        "lists/getbytitle('SupportRecord_Daily')",
        "lists/getbytitle('DailyRecordRows')",
        resolvedRowsFields,
        resolvedParentFields,
      ),
    ).rejects.toThrow(/missing ETag before child writes/);

    expect(childPosts).toBe(0);
  });

  it('keeps the old LatestVersion/LatestCommitId when a child POST fails mid-save (AC-4, Test 1 partial)', async () => {
    let childPosts = 0;
    const parentMerges: Record<string, unknown>[] = [];

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
      if (isParentList(String(url))) {
        return jsonResponse({
          value: [{
            Id: 7,
            Title: '2026-08-27',
            LatestVersion: 4,
            LatestCommitId: 'commit-v4',
            __metadata: { etag: '"etag-7"' },
          }],
        });
      }
      if (isParentCommitEtagRefresh(String(url), init)) {
        return jsonResponseWithEtag({ Id: 7, LatestVersion: 4 }, '"etag-7"');
      }
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

    const saver = makeSaver(spFetch);
    await expect(
      saver.save(
        sampleInput(['U001', 'U002', 'U003']),
        "lists/getbytitle('SupportRecord_Daily')",
        "lists/getbytitle('DailyRecordRows')",
        resolvedRowsFields,
        resolvedParentFields,
      ),
    ).rejects.toThrow(/network failed on child 3/);

    expect(childPosts).toBe(3);
    expect(parentMerges).toHaveLength(0);
  });

  it('creates a parent at LatestVersion 0 then commits v1 + CommitId after children exist', async () => {
    const creates: Record<string, unknown>[] = [];
    const childBodies: Record<string, unknown>[] = [];
    const merges: Record<string, unknown>[] = [];
    let parentListCalls = 0;

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
      if (isParentList(String(url))) {
        parentListCalls += 1;
        if (parentListCalls <= 2) {
          return jsonResponse({ value: [] });
        }
        return jsonResponse({ value: [{ Id: 90 }] });
      }
      if (url.endsWith('/items') && init?.method === 'POST' && url.includes('SupportRecord_Daily')) {
        creates.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 90 });
      }
      if (isParentCommitEtagRefresh(String(url), init)) {
        return jsonResponse({ Id: 90, LatestVersion: 0 });
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

    const saver = makeSaver(spFetch);
    await saver.save(
      sampleInput(['U001']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(parentListCalls).toBe(3);
    expect(creates[0].LatestVersion).toBe(0);
    expect(creates[0].LatestCommitId).toBeUndefined();
    expect(childBodies[0].Version).toBe(1);
    expect(childBodies[0].CommitId).toBe('commit-fixed');
    expect(merges[0].LatestVersion).toBe(1);
    expect(merges[0].LatestCommitId).toBe('commit-fixed');
  });

  it('AC-20: first commit on a new parent may use IF-MATCH * when ETag is unavailable', async () => {
    let mergeIfMatch: string | undefined;
    let parentListCalls = 0;

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
      if (isParentList(String(url))) {
        parentListCalls += 1;
        if (parentListCalls <= 2) return jsonResponse({ value: [] });
        return jsonResponse({ value: [{ Id: 90 }] });
      }
      if (url.endsWith('/items') && init?.method === 'POST' && url.includes('SupportRecord_Daily') && !httpMethod) {
        return jsonResponse({ Id: 90 });
      }
      if (isParentCommitEtagRefresh(String(url), init)) {
        return jsonResponse({ Id: 90, LatestVersion: 0 });
      }
      if (url.includes('DailyRecordRows') && init?.method === 'POST' && !url.includes('items(')) {
        return jsonResponse({ Id: 901 });
      }
      if (url.includes('items(90)') && httpMethod === 'MERGE') {
        mergeIfMatch = (init?.headers as Record<string, string> | undefined)?.['IF-MATCH'];
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ value: [] });
    });

    const saver = makeSaver(spFetch);
    await saver.save(
      sampleInput(['U001']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(mergeIfMatch).toBe('*');
  });

  it('AC-18: pre-create gate adopts concurrent winner without Parent POST', async () => {
    let parentPosts = 0;
    let parentListCalls = 0;
    const childBodies: Record<string, unknown>[] = [];
    const merges: Record<string, unknown>[] = [];

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const target = String(url);
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];

      if (isParentList(target)) {
        parentListCalls += 1;
        if (parentListCalls === 1) {
          return jsonResponse({ value: [] });
        }
        return jsonResponse({
          value: [{ Id: 10, Title: '2026-08-27', LatestVersion: 0, __metadata: { etag: '"etag-10"' } }],
        });
      }
      if (target.includes('SupportRecord_Daily') && target.endsWith('/items') && init?.method === 'POST' && !httpMethod) {
        parentPosts += 1;
        return jsonResponse({ Id: 99 });
      }
      if (isParentCommitEtagRefresh(target, init)) {
        return jsonResponseWithEtag({ Id: 10, LatestVersion: 0 }, '"etag-10"');
      }
      if (target.includes('DailyRecordRows') && init?.method === 'POST' && !target.includes('items(')) {
        childBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 901 });
      }
      if (target.includes('items(10)') && httpMethod === 'MERGE') {
        merges.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ value: [] });
    });

    const saver = makeSaver(spFetch);
    await saver.save(
      sampleInput(['U001']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(parentListCalls).toBe(2);
    expect(parentPosts).toBe(0);
    expect(childBodies).toHaveLength(1);
    expect(merges).toHaveLength(1);
    expect(merges[0].LatestVersion).toBe(1);
  });

  it('AC-19: storage uniqueness conflict adopts existing parent and continues save', async () => {
    let parentPosts = 0;
    let parentListCalls = 0;
    const childBodies: Record<string, unknown>[] = [];
    const merges: Record<string, unknown>[] = [];

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const target = String(url);
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];

      if (isParentList(target)) {
        parentListCalls += 1;
        if (parentListCalls <= 2) {
          return jsonResponse({ value: [] });
        }
        return jsonResponse({
          value: [{ Id: 10, Title: '2026-08-27', LatestVersion: 0, __metadata: { etag: '"etag-10"' } }],
        });
      }
      if (target.includes('SupportRecord_Daily') && target.endsWith('/items') && init?.method === 'POST' && !httpMethod) {
        parentPosts += 1;
        return new Response('duplicate value found for Title', { status: 409 });
      }
      if (isParentCommitEtagRefresh(target, init)) {
        return jsonResponseWithEtag({ Id: 10, LatestVersion: 0 }, '"etag-10"');
      }
      if (target.includes('DailyRecordRows') && init?.method === 'POST' && !target.includes('items(')) {
        childBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 901 });
      }
      if (target.includes('items(10)') && httpMethod === 'MERGE') {
        merges.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ value: [] });
    });

    const saver = makeSaver(spFetch);
    await saver.save(
      sampleInput(['U001']),
      "lists/getbytitle('SupportRecord_Daily')",
      "lists/getbytitle('DailyRecordRows')",
      resolvedRowsFields,
      resolvedParentFields,
    );

    expect(parentPosts).toBe(1);
    expect(parentListCalls).toBe(3);
    expect(childBodies).toHaveLength(1);
    expect(merges).toHaveLength(1);
    expect(merges[0].LatestVersion).toBe(1);
  });

  it('AC-17: create-race aborts before child POSTs and does not DELETE losing parent', async () => {
    let childPosts = 0;
    let deleteCalls = 0;
    const createdIds: number[] = [];
    let parentListCalls = 0;

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const target = String(url);
      const headers = init?.headers as Record<string, string> | undefined;
      const httpMethod = headers?.['X-HTTP-Method'];
      if (httpMethod === 'DELETE') deleteCalls += 1;

      if (isParentList(target)) {
        parentListCalls += 1;
        if (parentListCalls <= 2) {
          return jsonResponse({ value: [] });
        }
        return jsonResponse({ value: [{ Id: 10 }, { Id: 11 }] });
      }
      if (target.includes('SupportRecord_Daily') && target.endsWith('/items') && init?.method === 'POST' && !httpMethod) {
        createdIds.push(11);
        return jsonResponse({ Id: 11 });
      }
      if (target.includes('DailyRecordRows') && init?.method === 'POST') {
        childPosts += 1;
        return jsonResponse({ Id: 5000 + childPosts });
      }
      return jsonResponse({ value: [] });
    });

    const saver = makeSaver(spFetch);
    await expect(
      saver.save(
        sampleInput(['U001']),
        "lists/getbytitle('SupportRecord_Daily')",
        "lists/getbytitle('DailyRecordRows')",
        resolvedRowsFields,
        resolvedParentFields,
      ),
    ).rejects.toThrow(/Parent create-race/);

    expect(createdIds).toEqual([11]);
    expect(childPosts).toBe(0);
    expect(deleteCalls).toBe(0);
  });

  it('fails parent commit on ETag conflict without deleting losing CommitId children (AC-11, AC-12, AC-20)', async () => {
    const childBodies: Record<string, unknown>[] = [];
    let deleteCalls = 0;

    vi.spyOn(persistence, 'createDailyRecordCommitId').mockReturnValue('commit-B');

    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      const httpMethod = headers?.['X-HTTP-Method'];
      if (httpMethod === 'DELETE') {
        deleteCalls += 1;
      }
      if (isParentList(String(url))) {
        return jsonResponse({
          value: [{
            Id: 42,
            Title: '2026-08-27',
            LatestVersion: 4,
            LatestCommitId: 'commit-v4',
            __metadata: { etag: '"etag-stale"' },
          }],
        });
      }
      if (isParentCommitEtagRefresh(String(url), init)) {
        return jsonResponseWithEtag({ Id: 42, LatestVersion: 4 }, '"etag-stale"');
      }
      if (url.includes('DailyRecordRows') && init?.method === 'POST' && !url.includes('items(')) {
        childBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 3000 + childBodies.length });
      }
      if (url.includes('items(42)') && httpMethod === 'MERGE') {
        return new Response('Precondition Failed', { status: 412 });
      }
      return jsonResponse({ value: [] });
    });

    const saver = makeSaver(spFetch);
    await expect(
      saver.save(
        sampleInput(['U001']),
        "lists/getbytitle('SupportRecord_Daily')",
        "lists/getbytitle('DailyRecordRows')",
        resolvedRowsFields,
        resolvedParentFields,
      ),
    ).rejects.toThrow(/ETag conflict/);

    expect(childBodies.every((row) => row.CommitId === 'commit-B')).toBe(true);
    expect(deleteCalls).toBe(0);
  });
});
