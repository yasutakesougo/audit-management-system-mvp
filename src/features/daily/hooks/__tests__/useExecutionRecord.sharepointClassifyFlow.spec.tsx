import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../domain/executionRecordTypes';
import { SharePointExecutionRecordRepository } from '../../repositories/sharepoint/SharePointExecutionRecordRepository';
import { getCurrentExecutionRepositoryKind } from '../../repositories/sharepoint/executionRepositoryFactory';
import { useExecutionRecord } from '../useExecutionRecord';

const DATE = '2026-05-07';

const fields = new Set([
  'Title',
  'RecordDate',
  'Parent_x0020_ID',
  'User_x0020_ID',
  'Status',
  'Payload',
  'Memo',
  'Recorded_x0020_At',
  'RowNo',
]);

const spState = vi.hoisted(() => ({
  spFetch: vi.fn(),
  getListFieldInternalNames: vi.fn(async () => fields),
}));

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    spFetch: spState.spFetch,
    getListFieldInternalNames: spState.getListFieldInternalNames,
  }),
}));

const parentItem = { Id: 9, Title: `${DATE}-person-a`, RecordDate: DATE };
const childItem = {
  Id: 4,
  Title: `${DATE}-person-a-aa`,
  User_x0020_ID: 'person-a',
  RowNo: 'aa',
  Status: 'completed',
  Memo: 'saved',
  Payload: 'saved',
  Recorded_x0020_At: `${DATE}T09:00:00.000Z`,
};

const savedRecord: ExecutionRecord = {
  id: `${DATE}-person-a-aa`,
  date: DATE,
  userId: 'person-a',
  scheduleItemId: 'aa',
  status: 'completed',
  memo: 'saved',
  recordedBy: 'Staff A',
  recordedAt: `${DATE}T09:00:00.000Z`,
  triggeredBipIds: [],
};

const okBody = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => body,
});

const installUniqueRow = () => {
  spState.spFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const decoded = decodeURIComponent(String(url));
    if (init?.method === 'POST') return okBody({});
    const lastId = Number(decoded.match(/ID gt (\d+)/)?.[1] ?? -1);
    if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
      return okBody({ value: lastId === 0 ? [parentItem] : [] });
    }
    if (decoded.includes('DailyRecordRows') && decoded.includes('$filter=')) {
      return okBody({ value: lastId === 0 ? [childItem] : [] });
    }
    return okBody({ value: [] });
  });
};

const writeCalls = () => spState.spFetch.mock.calls.filter((call) => {
  const method = String(call[1]?.method ?? 'GET').toUpperCase();
  const headers = call[1]?.headers as Record<string, string> | undefined;
  const override = String(headers?.['X-HTTP-Method'] ?? '').toUpperCase();
  return method === 'POST' || method === 'MERGE' || method === 'DELETE'
    || override === 'MERGE' || override === 'DELETE';
});

describe('SharePoint classify flow through the hook', () => {
  let classify: ReturnType<typeof vi.spyOn>;
  let batched: ReturnType<typeof vi.spyOn>;
  let single: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('VITE_FORCE_SHAREPOINT', 'true');
    spState.spFetch.mockReset();
    spState.getListFieldInternalNames.mockClear();
    installUniqueRow();
    classify = vi.spyOn(SharePointExecutionRecordRepository.prototype, 'classifyExecutionCandidates');
    batched = vi.spyOn(SharePointExecutionRecordRepository.prototype, 'getRecordForCandidates');
    single = vi.spyOn(SharePointExecutionRecordRepository.prototype, 'getRecord');
  });

  afterEach(() => {
    classify.mockRestore();
    batched.mockRestore();
    single.mockRestore();
    vi.unstubAllEnvs();
  });

  it('calls classify for the sharepoint save and cancel decisions and does not use first-match lookup', async () => {
    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');

    const { result } = renderHook(() => useExecutionRecord(DATE, 'person-a', 'aa'));
    await waitFor(() => expect(result.current.record?.memo).toBe('saved'));
    const callsAfterLoad = classify.mock.calls.length;
    expect(callsAfterLoad).toBeGreaterThan(0);
    expect(batched).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.saveRecord('completed', 'edited');
    });
    expect(classify.mock.calls.length).toBeGreaterThan(callsAfterLoad);
    expect(result.current.record?.memo).toBe('edited');
    expect(writeCalls().filter((call) => {
      const headers = call[1]?.headers as Record<string, string> | undefined;
      return String(headers?.['X-HTTP-Method'] ?? '').toUpperCase() === 'MERGE';
    })).toHaveLength(1);
    expect(batched).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();

    const callsAfterSave = classify.mock.calls.length;
    await act(async () => {
      await result.current.deleteRecord();
    });
    expect(classify.mock.calls.length).toBeGreaterThan(callsAfterSave);
    expect(result.current.record).toBeUndefined();
    expect(writeCalls().filter((call) => {
      const headers = call[1]?.headers as Record<string, string> | undefined;
      return String(headers?.['X-HTTP-Method'] ?? '').toUpperCase() === 'DELETE';
    })).toHaveLength(1);
    expect(batched).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
  });

  it('stays blocked when classify throws and does not fall back to first-match lookup', async () => {
    classify.mockRejectedValue(new Error('classify failed'));
    batched.mockResolvedValue(savedRecord);
    single.mockResolvedValue(savedRecord);
    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');

    const { result } = renderHook(() => useExecutionRecord(DATE, 'person-a', 'aa'));
    await waitFor(() => expect(result.current.error?.message).toBe('classify failed'));
    expect(result.current.record).toBeUndefined();
    expect(batched).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();

    await expect(result.current.saveRecord('completed', 'edited')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.saveRecord('completed', 'edited again')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(batched).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
    expect(writeCalls()).toHaveLength(0);
    expect(result.current.error?.message).toBe('classify failed');
  });
});
