import { beforeEach, describe, expect, it, vi } from 'vitest';

const envState = {
  isDev: false,
  isTestMode: false,
  isForceDemoEnabled: false,
  isDemoModeEnabled: false,
  shouldSkipLogin: false,
  forceSharePoint: false,
  dataProvider: undefined as string | undefined,
  e2e: false,
};

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({ isDev: envState.isDev }),
  isDemoModeEnabled: () => envState.isDemoModeEnabled,
  isForceDemoEnabled: () => envState.isForceDemoEnabled,
  isTestMode: () => envState.isTestMode,
  shouldSkipLogin: () => envState.shouldSkipLogin,
  readBool: (key: string, fallback = false) => {
    if (key === 'VITE_FORCE_SHAREPOINT') return envState.forceSharePoint;
    if (key === 'VITE_E2E') return envState.e2e;
    return fallback;
  },
  readOptionalEnv: (key: string) => (key === 'VITE_DATA_PROVIDER' ? envState.dataProvider : undefined),
}));

import { getCurrentExecutionRepositoryKind, getExecutionRepository } from '../executionRepositoryFactory';

describe('executionRepositoryFactory', () => {
  beforeEach(() => {
    envState.isDev = false;
    envState.isTestMode = false;
    envState.isForceDemoEnabled = false;
    envState.isDemoModeEnabled = false;
    envState.shouldSkipLogin = false;
    envState.forceSharePoint = false;
    envState.dataProvider = undefined;
    envState.e2e = false;
    window.history.pushState({}, '', '/');
  });

  it('uses local in kiosk runtime when skipLogin is true', () => {
    envState.shouldSkipLogin = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('respects local provider hint outside kiosk runtime', () => {
    envState.dataProvider = 'local';
    window.history.pushState({}, '', '/daily/activity');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('forces sharepoint when VITE_FORCE_SHAREPOINT is true', () => {
    envState.forceSharePoint = true;
    envState.dataProvider = 'local';

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });

  it('respects local/memory provider hint in kiosk runtime during e2e', () => {
    envState.e2e = true;
    envState.dataProvider = 'memory';
    window.history.pushState({}, '', '/kiosk/users/10/procedures/0');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('uses local provider in kiosk runtime during local development', () => {
    envState.isDev = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('uses local provider in kiosk runtime during demo mode', () => {
    envState.isDemoModeEnabled = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('respects sharepoint provider hint in kiosk runtime during local development', () => {
    envState.isDev = true;
    envState.dataProvider = 'sharepoint';
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });

  it('forces sharepoint in kiosk runtime when local/memory provider hint is detected in production', () => {
    envState.dataProvider = 'memory';
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });

  it('leaves the local repository on the per-record API', async () => {
    envState.dataProvider = 'local';
    const store = {
      getRecords: vi.fn(() => []),
      getRecord: vi.fn(() => undefined),
      upsertRecord: vi.fn(),
      deleteRecord: vi.fn(),
      getCompletionRate: vi.fn(() => ({ completed: 0, triggered: 0, rate: 0 })),
      getRecordsInRange: vi.fn(() => []),
    };

    const repo = getExecutionRepository(store);
    expect(repo.getRecordForCandidates).toBeUndefined();
    await expect(repo.getRecord('2026-05-07', 'user-1', 'slot-1')).resolves.toBeUndefined();
    expect(store.getRecord).toHaveBeenCalledTimes(1);
    expect(store.getRecord).toHaveBeenCalledWith('2026-05-07', 'user-1', 'slot-1');
    await repo.upsertRecord({
      id: '2026-05-07-user-1-slot-1',
      date: '2026-05-07',
      userId: 'user-1',
      scheduleItemId: 'slot-1',
      status: 'completed',
      memo: '',
      recordedAt: '2026-05-07T00:00:00.000Z',
      recordedBy: '',
      triggeredBipIds: [],
    });
    expect(store.upsertRecord).toHaveBeenCalledTimes(1);
    await repo.deleteRecord('2026-05-07', 'user-1', 'slot-1');
    expect(store.deleteRecord).toHaveBeenCalledTimes(1);
  });

  it('forwards batched lookup through the sharepoint adapter', async () => {
    envState.forceSharePoint = true;
    const spFetch = vi.fn(async (url: string) => {
      const decoded = decodeURIComponent(String(url));
      if (decoded.includes('$filter=') && decoded.includes('ID gt')) {
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ value: [] }) };
      }
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ value: [] }) };
    });
    const getFields = vi.fn(async () => new Set([
      'Title',
      'RecordDate',
      'Parent_x0020_ID',
      'User_x0020_ID',
      'Status',
      'Payload',
      'Recorded_x0020_At',
      'RowNo',
    ]));

    const repo = getExecutionRepository(undefined, spFetch, getFields);
    expect(typeof repo.getRecordForCandidates).toBe('function');
    expect(typeof repo.classifyExecutionCandidates).toBe('function');
    await expect(repo.getRecordForCandidates?.('2026-05-07', ['person-a', 'person-b'], ['aa', 'bb']))
      .resolves.toBeUndefined();

    const parentReads = spFetch.mock.calls
      .map(([url]) => decodeURIComponent(String(url)))
      .filter((url) => url.includes('SupportRecord_Daily') && url.includes('ID gt 0') && url.includes('RecordDate'));
    expect(parentReads).toHaveLength(1);
    expect(repo.getRecord).toEqual(expect.any(Function));
    expect(repo.upsertRecord).toEqual(expect.any(Function));
    expect(repo.deleteRecord).toEqual(expect.any(Function));
  });
});
