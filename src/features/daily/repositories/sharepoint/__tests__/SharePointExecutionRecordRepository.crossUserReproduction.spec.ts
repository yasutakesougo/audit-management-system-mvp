import { describe, expect, it, vi } from 'vitest';
import {
  SharePointExecutionRecordRepository,
} from '../SharePointExecutionRecordRepository';
import type { ExecutionRecord } from '../../../domain/executionRecordTypes';

describe('SharePointExecutionRecordRepository - Cross-User Contamination Regression (RED -> GREEN)', () => {
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
  }) => {
    const spFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const decoded = decodeURIComponent(String(url));
      const method = (init?.method || 'GET').toUpperCase();

      if (method === 'POST') {
        const headers = new Headers(init?.headers);
        const xMethod = headers.get('X-HTTP-Method');
        if (xMethod === 'MERGE' || xMethod === 'DELETE') {
          return okBody({});
        }
        // POST to Parent or Child
        return okBody({ Id: 9999, Title: 'created' });
      }

      if (decoded.includes('SupportRecord_Daily') && decoded.includes('Title eq')) {
        // Direct title lookup
        const titleMatch = decoded.match(/Title eq '([^']+)'/);
        const targetTitle = titleMatch ? titleMatch[1] : '';
        const matched = options.existingParents.filter((p) => p.Title === targetTitle);
        return okBody({ value: matched });
      }

      if (decoded.includes('SupportRecord_Daily')) {
        // List parent page
        return okBody(pagedValue(decoded, options.existingParents));
      }

      if (decoded.includes('DailyRecordRows')) {
        // List children
        const parentMatch = decoded.match(/ParentID eq (\d+)/);
        const pid = parentMatch ? Number(parentMatch[1]) : null;
        const rows = pid != null
          ? options.existingChildren.filter((c) => (c.ParentID ?? 701) === pid)
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

  it('RED: User 6 must NOT adopt, update, or delete User 17 records when User 6 has no records', async () => {
    // User 17 has parent "2026-10-24-I017" (Id: 701) and child Id 1017 (User_x0020_ID: 'I017', RowNo: '1')
    // User 6 has NO records on this date
    const { repo, spFetch } = setupFixture({
      existingParents: [{ Id: 701, Title: `${DATE}-${USER_17_CODE}`, RecordDate: DATE }],
      existingChildren: [
        {
          Id: 1017,
          ParentID: 701,
          Title: `${DATE}-${USER_17_CODE}-1`,
          User_x0020_ID: USER_17_CODE,
          RowNo: '1',
          Status: 'completed',
          Memo: 'User 17 note',
          Recorded_x0020_At: `${DATE}T09:00:00.000Z`,
        },
      ],
    });

    // 1. READ: classifyExecutionCandidates for User 6 (using Item ID '6' or UserID 'I005')
    const classificationFor6 = await repo.classifyExecutionCandidates(DATE, [USER_6_ITEM_ID], [SLOT]);
    // FIXED EXPECTATION: User 6 must be 'absent', NEVER 'unique' pointing to User 17's internalId 1017!
    expect(classificationFor6.kind).toBe('absent');

    const getResult = await repo.getRecord(DATE, USER_6_ITEM_ID, SLOT);
    expect(getResult).toBeUndefined();

    // 2. UPDATE: upsertRecord for User 6 must NEVER issue MERGE against User 17's item (Id 1017)
    const draft: ExecutionRecord = {
      id: `${DATE}-${USER_6_CODE}-${SLOT}`,
      date: DATE,
      userId: USER_6_CODE,
      scheduleItemId: SLOT,
      status: 'completed',
    };
    await repo.upsertRecord(draft);

    for (const call of spFetch.mock.calls) {
      const url = String(call[0]);
      const init = call[1] as RequestInit | undefined;
      const headers = new Headers(init?.headers);
      const isMerge = headers.get('X-HTTP-Method') === 'MERGE' || init?.method === 'MERGE';
      if (isMerge) {
        expect(url).not.toContain('items(1017)');
      }
    }

    // 3. DELETE: deleteRecord for User 6 must NEVER issue DELETE against User 17's item (Id 1017)
    await repo.deleteRecord(DATE, USER_6_ITEM_ID, SLOT);
    for (const call of spFetch.mock.calls) {
      const url = String(call[0]);
      const init = call[1] as RequestInit | undefined;
      const headers = new Headers(init?.headers);
      const isDelete = headers.get('X-HTTP-Method') === 'DELETE' || init?.method === 'DELETE';
      if (isDelete) {
        expect(url).not.toContain('items(1017)');
      }
    }
  });
});
