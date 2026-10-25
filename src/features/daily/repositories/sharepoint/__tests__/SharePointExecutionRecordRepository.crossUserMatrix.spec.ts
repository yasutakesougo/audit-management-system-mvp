import { describe, expect, it, vi } from 'vitest';
import {
  SharePointExecutionRecordRepository,
  ExecutionTargetMismatchError,
  AmbiguousExecutionRecordError,
} from '../SharePointExecutionRecordRepository';
import type { ExecutionRecord } from '../../../domain/executionRecordTypes';

describe('SharePointExecutionRecordRepository - Cross-User Comprehensive Matrix (6 Items + Isolation + Legacy)', () => {
  const DATE = '2026-10-24';
  const USER_6_ITEM_ID = '6';
  const USER_6_CODE = 'I005';
  const USER_17_CODE = 'I017';
  const SLOT = 'procedure-1';

  const mockGetFields = vi.fn().mockResolvedValue(new Set([
    'Title',
    'RecordDate',
    'User_x0020_ID',
    'RowNo',
    'Status',
    'Memo',
    'Payload',
    'Recorded_x0020_At',
    'ParentID',
  ]));

  const okBody = (body: unknown) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  });

  function pagedValue<T extends { Id?: unknown }>(url: string, items: T[]): { value: T[] } {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/ID gt (\d+)/);
    if (!match) return { value: items };
    const lastId = Number(match[1]);
    return {
      value: items.filter((item) => typeof item.Id === 'number' && item.Id > lastId),
    };
  }

  function inspectHttpMutations(spFetch: ReturnType<typeof vi.fn>) {
    const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE']);
    let totalWriteCount = 0;
    let parentCreatePostCount = 0;
    let childCreatePostCount = 0;
    let mergeCount = 0;
    let deleteCount = 0;

    for (const call of spFetch.mock.calls) {
      const url = decodeURIComponent(String(call[0]));
      const init = call[1] as RequestInit | undefined;
      const baseMethod = (init?.method || 'GET').toUpperCase();

      const headers = new Headers(init?.headers);
      const xHttpMethod = headers.get('X-HTTP-Method');
      const effectiveMethod = (xHttpMethod || baseMethod).toUpperCase();

      if (writeMethods.has(baseMethod) || writeMethods.has(effectiveMethod)) {
        totalWriteCount++;

        if (effectiveMethod === 'MERGE') {
          mergeCount++;
        } else if (effectiveMethod === 'DELETE') {
          deleteCount++;
        } else if (effectiveMethod === 'POST') {
          if (url.includes('SupportRecord_Daily')) {
            parentCreatePostCount++;
          } else if (url.includes('DailyRecordRows')) {
            childCreatePostCount++;
          }
        }
      }
    }

    return {
      totalWriteCount,
      parentCreatePostCount,
      childCreatePostCount,
      mergeCount,
      deleteCount,
    };
  }

  const setupFixture = (options: {
    existingParents: Array<{ Id: number; Title: string; RecordDate?: string }>;
    existingChildren: Array<{
      Id: number;
      Title?: string;
      User_x0020_ID: string;
      RowNo: string;
      Status?: string;
      Memo?: string;
      Payload?: string;
      Recorded_x0020_At?: string;
      ParentID?: number;
    }>;
    failFetch?: boolean;
  }) => {
    const spFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (options.failFetch) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'fetch failed' }),
        };
      }

      const decoded = decodeURIComponent(String(url));
      const method = (init?.method || 'GET').toUpperCase();

      if (method === 'POST') {
        const headers = new Headers(init?.headers);
        const xMethod = headers.get('X-HTTP-Method');
        if (xMethod === 'MERGE' || xMethod === 'DELETE') {
          return okBody({});
        }
        return okBody({ Id: 8888, Title: 'created' });
      }

      if (decoded.includes('SupportRecord_Daily') && decoded.includes('Title eq')) {
        const titleMatch = decoded.match(/Title eq '([^']+)'/);
        const targetTitle = titleMatch ? titleMatch[1] : '';
        const matched = options.existingParents.filter((p) => p.Title === targetTitle);
        return okBody({ value: matched });
      }

      if (decoded.includes('SupportRecord_Daily')) {
        return okBody(pagedValue(decoded, options.existingParents));
      }

      if (decoded.includes('DailyRecordRows')) {
        const parentMatch = decoded.match(/ParentID eq (\d+)/);
        const pid = parentMatch ? Number(parentMatch[1]) : null;
        const rows = pid != null
          ? options.existingChildren.filter((c) => (c.ParentID ?? 601) === pid)
          : options.existingChildren;
        return okBody(pagedValue(decoded, rows));
      }

      return okBody({ value: [] });
    });

    const repo = new SharePointExecutionRecordRepository({
      spFetch,
      getListFieldInternalNames: mockGetFields,
    });

    return { repo, spFetch };
  };

  // ────────────────────────────────────────────────────────────
  // 判定マトリクス 6項目
  // ────────────────────────────────────────────────────────────

  // ① 親なし・子なし: absent -> 親作成POST 1回 + 子作成POST 1回
  it('Matrix 1: Parent absent & child absent -> absent, creates parent POST + child POST on upsert', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 701, Title: `${DATE}-${USER_17_CODE}`, RecordDate: DATE }], // other user's parent
      existingChildren: [],
    });

    const classification = await repo.classifyExecutionCandidates(DATE, [USER_6_CODE], [SLOT]);
    expect(classification.kind).toBe('absent');

    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'completed',
    };
    await repo.upsertRecord(draft);

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.parentCreatePostCount).toBe(1);
    expect(mutations.childCreatePostCount).toBe(1);
    expect(mutations.mergeCount).toBe(0);
    expect(mutations.deleteCount).toBe(0);
    expect(mutations.totalWriteCount).toBe(2);
  });

  // ② 親あり・子なし: absent -> 既存親を再利用し、子作成POST 1回のみ（親POST 0回）
  it('Matrix 2: Parent exists & child absent -> absent, reuses existing parent with 0 parent POST', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [], // slot is absent
    });

    const classification = await repo.classifyExecutionCandidates(DATE, [USER_6_CODE], [SLOT]);
    expect(classification.kind).toBe('absent');

    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'completed',
    };
    await repo.upsertRecord(draft);

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.parentCreatePostCount).toBe(0); // NO duplicate parent POST!
    expect(mutations.childCreatePostCount).toBe(1);
    expect(mutations.mergeCount).toBe(0);
    expect(mutations.deleteCount).toBe(0);
    expect(mutations.totalWriteCount).toBe(1);
  });

  // ③ 親あり・本人子あり: unique -> MERGE 1回（親POST 0回、子POST 0回）
  it('Matrix 3: Parent exists & legitimate child exists -> unique, issues exactly 1 MERGE and 0 POSTs', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1006,
          ParentID: 601,
          Title: `${DATE}-${USER_6_CODE}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    const classification = await repo.classifyExecutionCandidates(DATE, [USER_6_CODE], [SLOT]);
    expect(classification.kind).toBe('unique');
    if (classification.kind === 'unique') {
      expect(classification.internalId).toBe(1006);
      expect(classification.record.userId).toBe(USER_6_CODE);
    }

    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'skipped',
    };
    await repo.upsertRecord(draft);

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.parentCreatePostCount).toBe(0);
    expect(mutations.childCreatePostCount).toBe(0);
    expect(mutations.mergeCount).toBe(1);
    expect(mutations.deleteCount).toBe(0);
    expect(mutations.totalWriteCount).toBe(1);
  });

  // ④ 親あり・他人子混入: mismatch -> ExecutionTargetMismatchError, 全書き込み 0回
  it('Matrix 4: Parent exists & child has another user ID -> mismatch, aborts with 0 mutations', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 9999,
          ParentID: 601,
          Title: `${DATE}-${USER_6_CODE}-1`,
          User_x0020_ID: 'ANOTHER_USER', // corrupted child under user 6 parent!
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    const classification = await repo.classifyExecutionCandidates(DATE, [USER_6_CODE], [SLOT]);
    expect(classification.kind).toBe('mismatch');

    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'completed',
    };

    await expect(repo.upsertRecord(draft)).rejects.toThrow(ExecutionTargetMismatchError);
    await expect(repo.deleteRecord(DATE, USER_6_CODE, SLOT)).rejects.toThrow(ExecutionTargetMismatchError);

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.totalWriteCount).toBe(0);
  });

  // ⑤ 同一スロット重複: duplicate -> AmbiguousExecutionRecordError, 全書き込み 0回
  it('Matrix 5: Multiple children for same slot -> duplicate, aborts with 0 mutations', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1001,
          ParentID: 601,
          Title: `${DATE}-${USER_6_CODE}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
        {
          Id: 1002,
          ParentID: 601,
          Title: `${DATE}-${USER_6_CODE}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    const classification = await repo.classifyExecutionCandidates(DATE, [USER_6_CODE], [SLOT]);
    expect(classification.kind).toBe('duplicate');

    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'completed',
    };

    await expect(repo.upsertRecord(draft)).rejects.toThrow(AmbiguousExecutionRecordError);
    await expect(repo.deleteRecord(DATE, USER_6_CODE, SLOT)).rejects.toThrow(AmbiguousExecutionRecordError);

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.totalWriteCount).toBe(0);
  });

  // ⑥ 取得失敗 / 通信エラー: throws -> 全書き込み 0回
  it('Matrix 6: Fetch failure -> throws error, aborts with 0 mutations', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [],
      existingChildren: [],
      failFetch: true,
    });

    await expect(repo.classifyExecutionCandidates(DATE, [USER_6_CODE], [SLOT])).rejects.toThrow();

    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'completed',
    };

    await expect(repo.upsertRecord(draft)).rejects.toThrow();
    await expect(repo.deleteRecord(DATE, USER_6_CODE, SLOT)).rejects.toThrow();

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.totalWriteCount).toBe(0);
  });

  // ────────────────────────────────────────────────────────────
  // 逆方向の混在防止 (User 17 -> User 6)
  // ────────────────────────────────────────────────────────────

  it('Reverse isolation: User 17 never touches User 6 records', async () => {
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1006,
          ParentID: 601,
          Title: `${DATE}-${USER_6_CODE}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    const classification = await repo.classifyExecutionCandidates(DATE, [USER_17_CODE], [SLOT]);
    expect(classification.kind).toBe('absent');

    const getResult = await repo.getRecord(DATE, USER_17_CODE, SLOT);
    expect(getResult).toBeUndefined();

    await repo.deleteRecord(DATE, USER_17_CODE, SLOT);
    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.deleteCount).toBe(0);
    expect(mutations.totalWriteCount).toBe(0);
  });

  it.each([
    { label: 'another user ID', childUserId: USER_17_CODE },
    { label: 'empty user ID', childUserId: '' },
    { label: 'unverified user ID', childUserId: 'UNVERIFIED_USER' },
  ])('Read isolation: rejects a child with $label under the requested user parent', async ({ childUserId }) => {
    const store = {
      getRecords: vi.fn(() => []),
      upsertRecord: vi.fn(),
    };
    const { spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1017,
          ParentID: 601,
          Title: `${DATE}-${USER_6_CODE}-1`,
          User_x0020_ID: childUserId,
          RowNo: '1',
          Status: 'completed',
          Memo: 'foreign user content',
        },
      ],
    });
    const repo = new SharePointExecutionRecordRepository({
      spFetch,
      getListFieldInternalNames: mockGetFields,
      store,
    });

    await expect(repo.getRecords(DATE, USER_6_CODE, [USER_6_CODE, USER_6_ITEM_ID]))
      .rejects.toThrow(ExecutionTargetMismatchError);
    expect(store.upsertRecord).not.toHaveBeenCalled();
  });

  it('Read isolation: ignores a foreign child under an unrelated foreign parent', async () => {
    const { repo } = setupFixture({
      existingParents: [{ Id: 701, Title: `${DATE}-${USER_17_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1019,
          ParentID: 701,
          Title: `${DATE}-${USER_17_CODE}-1`,
          User_x0020_ID: USER_17_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    await expect(repo.getRecords(DATE, USER_6_CODE, [USER_6_CODE, USER_6_ITEM_ID])).resolves.toEqual([]);
  });

  it('Read isolation: drops a same-user child whose stored date mismatches the requested day', async () => {
    const store = {
      getRecords: vi.fn(() => []),
      upsertRecord: vi.fn(),
    };
    const { spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1018,
          ParentID: 601,
          Title: `2026-10-23-${USER_6_CODE}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });
    const repo = new SharePointExecutionRecordRepository({
      spFetch,
      getListFieldInternalNames: mockGetFields,
      store,
    });

    const records = await repo.getRecords(DATE, USER_6_CODE, [USER_6_CODE, USER_6_ITEM_ID]);

    expect(records).toEqual([]);
    expect(store.upsertRecord).not.toHaveBeenCalled();
  });

  it('Read isolation: preserves a same-master legacy child under an Item ID parent', async () => {
    const { repo } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_ITEM_ID}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1006,
          ParentID: 601,
          Title: `${DATE}-${USER_6_ITEM_ID}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    const records = await repo.getRecords(DATE, USER_6_CODE, [USER_6_CODE, USER_6_ITEM_ID]);

    expect(records).toEqual([
      expect.objectContaining({
        id: `${DATE}-${USER_6_ITEM_ID}-1`,
        userId: USER_6_CODE,
        scheduleItemId: '1',
        status: 'completed',
      }),
    ]);
  });

  it('Read isolation: fails closed when the same exact user has duplicate rows for one slot', async () => {
    const { repo } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE }],
      existingChildren: [
        { Id: 1001, ParentID: 601, Title: `${DATE}-${USER_6_CODE}-1`, User_x0020_ID: USER_6_CODE, RowNo: '1' },
        { Id: 1002, ParentID: 601, Title: `${DATE}-${USER_6_CODE}-1`, User_x0020_ID: USER_6_CODE, RowNo: '1' },
      ],
    });

    await expect(repo.getRecords(DATE, USER_6_CODE, [USER_6_CODE])).rejects.toThrow('AMBIGUOUS_EXECUTION_RECORD');
  });

  it('Read isolation: fails closed when legacy ID forms duplicate a slot for one master row', async () => {
    const { repo } = setupFixture({
      existingParents: [
        { Id: 601, Title: `${DATE}-${USER_6_CODE}`, RecordDate: DATE },
        { Id: 602, Title: `${DATE}-${USER_6_ITEM_ID}`, RecordDate: DATE },
      ],
      existingChildren: [
        { Id: 1001, ParentID: 601, Title: `${DATE}-${USER_6_CODE}-1`, User_x0020_ID: USER_6_CODE, RowNo: '1' },
        { Id: 1002, ParentID: 602, Title: `${DATE}-${USER_6_ITEM_ID}-1`, User_x0020_ID: USER_6_ITEM_ID, RowNo: '1' },
      ],
    });

    await expect(repo.getRecords(DATE, USER_6_CODE, [USER_6_CODE, USER_6_ITEM_ID]))
      .rejects.toThrow('AMBIGUOUS_EXECUTION_RECORD');
  });

  // ────────────────────────────────────────────────────────────
  // 同じマスター行で裏付けられる旧形式の本人記録
  // ────────────────────────────────────────────────────────────

  it('Legacy record support: updates existing legacy record using Item ID without duplicate creation', async () => {
    // Legacy record stored with Item ID '6' in parent title and User_x0020_ID
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_ITEM_ID}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1006,
          ParentID: 601,
          Title: `${DATE}-${USER_6_ITEM_ID}-1`,
          User_x0020_ID: USER_6_ITEM_ID,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    // Querying with candidate list backed by same master row: ['I005', '6']
    const classification = await repo.classifyExecutionCandidates(DATE, [USER_6_CODE, USER_6_ITEM_ID], [SLOT]);
    expect(classification.kind).toBe('unique');
    if (classification.kind === 'unique') {
      expect(classification.internalId).toBe(1006);
      expect(classification.record.userId).toBe(USER_6_ITEM_ID);
    }

    // Upserting for User 6 targets existing 1006 with MERGE, does NOT create duplicate parent or child
    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'skipped',
    };
    await repo.upsertRecord(draft, { candidateUserIds: [USER_6_CODE, USER_6_ITEM_ID] });

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.mergeCount).toBe(1);
    expect(mutations.parentCreatePostCount).toBe(0);
    expect(mutations.childCreatePostCount).toBe(0);
    expect(mutations.totalWriteCount).toBe(1);
  });

  it('Legacy record deletion: deletes existing record spanning legacy parent and child when candidateUserIds is provided', async () => {
    // Parent created under legacy Item ID '6', child created under canonical code 'I005'
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 601, Title: `${DATE}-${USER_6_ITEM_ID}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1006,
          ParentID: 601,
          Title: `${DATE}-${USER_6_ITEM_ID}-1`,
          User_x0020_ID: USER_6_CODE,
          RowNo: '1',
          Status: 'completed',
        },
      ],
    });

    // Delete passing both candidateUserIds (code + Item ID backed by same master row)
    await repo.deleteRecord(DATE, USER_6_CODE, SLOT, {
      candidateUserIds: [USER_6_CODE, USER_6_ITEM_ID],
    });

    const mutations = inspectHttpMutations(spFetch);
    expect(mutations.deleteCount).toBe(1);
    expect(mutations.totalWriteCount).toBe(1);

    // Verify DELETE targeted child 1006
    const deleteCall = spFetch.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined;
      const headers = new Headers(init?.headers);
      const effectiveMethod = (headers.get('X-HTTP-Method') || init?.method || '').toUpperCase();
      return effectiveMethod === 'DELETE';
    });
    expect(deleteCall).toBeDefined();
    expect(decodeURIComponent(String(deleteCall?.[0]))).toContain("lists/getbytitle('DailyRecordRows')/items(1006)");
  });
});

