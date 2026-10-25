import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharePointExecutionRecordRepository } from '../../repositories/sharepoint/SharePointExecutionRecordRepository';
import { EXECUTION_RECORD_FIELDS, DAILY_RECORD_FIELDS, DAILY_RECORD_ROWS_FIELDS } from '../../repositories/sharepoint/constants';
import type { ExecutionRecordUpsertOptions, ExecutionRecordRepository } from '../../domain/ExecutionRecordRepository';
import { useExecutionRecord } from '../useExecutionRecord';

// Separate, distinct IDs for each entity:
// - User Item ID: 101 (user's ID in User Master, string candidate '101')
// - User Business ID: 'U001'
// - Parent Row Item ID: 501 (row ID in SupportRecord_Daily)
// - Child Row Item ID: 901 (row ID in DailyRecordRows)
const USER_BUSINESS_ID = 'U001';
const USER_ITEM_ID = 101;
const PARENT_ROW_ITEM_ID = 501;
const CHILD_ROW_ITEM_ID = 901;

function pagedValue<T extends { Id?: unknown }>(url: string, items: T[]): { value: T[] } {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/ID gt (\d+)/);
  if (!match) return { value: items };
  const lastId = Number(match[1]);
  return {
    value: items.filter((item) => typeof item.Id === 'number' && item.Id > lastId),
  };
}

const mockSpFetch = vi.fn();
let lastUpsertOptions: ExecutionRecordUpsertOptions | undefined;
const mockGetListFieldInternalNames = vi.fn().mockImplementation(async (listTitle: string) => {
  if (listTitle.includes('DailyRecordRows')) {
    return new Set([
      'Title',
      DAILY_RECORD_ROWS_FIELDS.parentId,
      DAILY_RECORD_ROWS_FIELDS.userId,
      DAILY_RECORD_ROWS_FIELDS.status,
      DAILY_RECORD_ROWS_FIELDS.recordedAt,
      EXECUTION_RECORD_FIELDS.rowKey,
      EXECUTION_RECORD_FIELDS.parentId,
      EXECUTION_RECORD_FIELDS.userId,
      EXECUTION_RECORD_FIELDS.rowNo,
      EXECUTION_RECORD_FIELDS.status,
      EXECUTION_RECORD_FIELDS.memo,
      EXECUTION_RECORD_FIELDS.recordedAt,
      EXECUTION_RECORD_FIELDS.staffName,
      EXECUTION_RECORD_FIELDS.bipsJSON,
      'ParentID',
      'Parent_x0020_ID',
      'User_x0020_ID',
      'RowNo',
    ]);
  }
  return new Set([
    DAILY_RECORD_FIELDS.title,
    DAILY_RECORD_FIELDS.recordDate,
    DAILY_RECORD_FIELDS.reporterName,
    DAILY_RECORD_FIELDS.userRowsJSON,
    'Title',
    'RecordDate',
  ]);
});

const realRepo = new SharePointExecutionRecordRepository({
  spFetch: mockSpFetch,
  getListFieldInternalNames: mockGetListFieldInternalNames,
});

const boundRepo: ExecutionRecordRepository = {
  getRecords: (d, u) => realRepo.getRecords(d, u),
  getRecord: (d, u, s) => realRepo.getRecord(d, u, s),
  getRecordForCandidates: (d, u, s) => realRepo.getRecordForCandidates(d, u, s),
  classifyExecutionCandidates: (d, u, s) => realRepo.classifyExecutionCandidates(d, u, s),
  upsertRecord: (r, o) => {
    lastUpsertOptions = o;
    return realRepo.upsertRecord(r, o);
  },
  deleteRecord: (d, u, s, o) => realRepo.deleteRecord(d, u, s, o),
  getCompletionRate: (d, u, t) => realRepo.getCompletionRate(d, u, t),
  getHistoricalRecords: (u, s, l) => realRepo.getHistoricalRecords(u, s, l),
  getRecordsInRange: (u, f, t) => realRepo.getRecordsInRange(u, f, t),
};

vi.mock('../useExecutionData', () => ({
  useExecutionData: () => boundRepo,
}));

const getEffectiveHttpMethod = (init?: RequestInit): string => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const override = new Headers(init?.headers).get('X-HTTP-Method');
  return (override ?? method).toUpperCase();
};

describe('useExecutionRecord legacy record save integration with SharePointExecutionRecordRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastUpsertOptions = undefined;
  });

  it('updates the existing legacy child row rather than creating new parent or child rows on save', async () => {
    const parentListTitle = 'SupportRecord_Daily';
    const childListTitle = 'DailyRecordRows';
    let releaseUpdate!: () => void;
    const updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });

    const parentItems = [
      {
        Id: PARENT_ROW_ITEM_ID,
        Title: `2026-10-24-${USER_ITEM_ID}`,
        RecordDate: '2026-10-24T00:00:00Z',
      },
    ];

    const childItems = [
      {
        Id: CHILD_ROW_ITEM_ID,
        Title: `2026-10-24-${USER_ITEM_ID}-slot-1`,
        ParentID: PARENT_ROW_ITEM_ID,
        Parent_x0020_ID: PARENT_ROW_ITEM_ID,
        User_x0020_ID: USER_BUSINESS_ID,
        RowNo: 'slot-1',
        Status: 'completed',
        Memo: 'Initial legacy memo',
        Recorded_x0020_At: '2026-10-24T09:00:00Z',
      },
    ];

    const okBody = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
    });

    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const decoded = decodeURIComponent(String(url));
      const method = getEffectiveHttpMethod(init);

      if (method === 'MERGE' || method === 'DELETE') {
        await updateGate;
        return okBody({});
      }
      if (method === 'POST') {
        return okBody({ Id: 8888, Title: 'created' });
      }

      if (decoded.includes('lists') && decoded.includes('$select=Title')) {
        return okBody({
          value: [
            { Title: parentListTitle },
            { Title: childListTitle },
          ],
        });
      }

      if (decoded.includes('/fields')) {
        return okBody({
          value: [
            { InternalName: 'Title' },
            { InternalName: 'RecordDate' },
            { InternalName: 'ParentID' },
            { InternalName: 'Parent_x0020_ID' },
            { InternalName: 'User_x0020_ID' },
            { InternalName: 'RowNo' },
            { InternalName: 'Status' },
            { InternalName: 'Memo' },
            { InternalName: 'Recorded_x0020_At' },
          ],
        });
      }

      if (decoded.includes(parentListTitle)) {
        return okBody(pagedValue(decoded, parentItems));
      }

      if (decoded.includes(childListTitle)) {
        const parentMatch = decoded.match(/ParentID eq (\d+)/);
        const pid = parentMatch ? Number(parentMatch[1]) : null;
        const rows = pid != null
          ? childItems.filter((c) => (c.Parent_x0020_ID ?? c.ParentID) === pid)
          : childItems;
        return okBody(pagedValue(decoded, rows));
      }

      return okBody({ value: [] });
    });

    const { result, rerender } = renderHook(
      ({ targetUserId }) =>
        useExecutionRecord(
          '2026-10-24',
          targetUserId,
          'slot-1',
          ['slot-1'],
          [String(USER_ITEM_ID)],
        ),
      { initialProps: { targetUserId: USER_BUSINESS_ID } },
    );

    // Initial load should resolve the existing legacy record
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.record).toBeDefined();
    });
    expect(result.current.record?.memo).toBe('Initial legacy memo');

    // Save updated record via the hook
    let savePromise!: Promise<unknown>;
    const saveRecordWithExternalOptions = result.current.saveRecord as unknown as (
      status: 'completed',
      memo: string,
      triggeredBipIds: string[],
      options: { candidateUserIds: string[] },
    ) => Promise<unknown>;
    act(() => {
      savePromise = saveRecordWithExternalOptions(
        'completed',
        'Updated new memo',
        [],
        { candidateUserIds: ['external-user'] },
      );
    });

    await waitFor(() => {
      expect(mockSpFetch.mock.calls.some((call) => {
        const init = call[1] as RequestInit | undefined;
        return getEffectiveHttpMethod(init) === 'MERGE';
      })).toBe(true);
    });

    expect(lastUpsertOptions).toEqual({
      memoMode: 'overwrite',
      candidateUserIds: [USER_BUSINESS_ID, String(USER_ITEM_ID)],
    });

    // Change the Hook target while the actual Repository update is pending.
    rerender({ targetUserId: 'U002' });
    expect(lastUpsertOptions).toEqual({
      memoMode: 'overwrite',
      candidateUserIds: [USER_BUSINESS_ID, String(USER_ITEM_ID)],
    });

    await act(async () => {
      releaseUpdate();
      await expect(savePromise).rejects.toThrow('Execution record identity is not ready for mutation');
    });

    // Verify calls to mockSpFetch
    const postCalls = mockSpFetch.mock.calls.filter((call) => {
      const init = call[1] as RequestInit | undefined;
      return getEffectiveHttpMethod(init) === 'POST';
    });

    const parentPostCalls = postCalls.filter((call) => call[0].includes(parentListTitle));
    const childCreationPostCalls = postCalls.filter((call) => {
      const url = call[0] as string;
      return url.includes(childListTitle) && !url.includes(`(${CHILD_ROW_ITEM_ID})`);
    });

    const updateCalls = mockSpFetch.mock.calls.filter((call) => {
      const url = call[0] as string;
      const init = call[1] as RequestInit | undefined;
      return (
        url.includes(childListTitle) &&
        url.includes(`(${CHILD_ROW_ITEM_ID})`) &&
        (getEffectiveHttpMethod(init) === 'PATCH' || getEffectiveHttpMethod(init) === 'MERGE')
      );
    });
    const observedUpdates = updateCalls.map((call) => {
      const url = call[0] as string;
      const init = call[1] as RequestInit | undefined;
      const body = JSON.parse((init?.body ?? '{}') as string) as Record<string, unknown>;
      const itemId = Number(url.match(/\((\d+)\)/)?.[1]);
      return {
        itemId,
        parentId: body.ParentID ?? body[DAILY_RECORD_ROWS_FIELDS.parentId] ?? body.Parent_x0020_ID,
        memo: body.Memo,
      };
    });

    // One assertion keeps the pre-fix failure diagnostic visible for all write invariants.
    expect({
      upsertOptions: lastUpsertOptions,
      parentCreatePosts: parentPostCalls.length,
      childCreatePosts: childCreationPostCalls.length,
      updates: observedUpdates,
    }).toEqual({
      upsertOptions: {
        memoMode: 'overwrite',
        candidateUserIds: [USER_BUSINESS_ID, String(USER_ITEM_ID)],
      },
      parentCreatePosts: 0,
      childCreatePosts: 0,
      updates: [{ itemId: CHILD_ROW_ITEM_ID, parentId: PARENT_ROW_ITEM_ID, memo: 'Updated new memo' }],
    });
  });
});
