import { beforeEach, describe, expect, it } from 'vitest';

import { localSupervisionTrackingRepository } from '../localSupervisionTrackingRepository';

describe('localSupervisionTrackingRepository', () => {
  beforeEach(() => {
    localSupervisionTrackingRepository.clearAll();
  });

  it('未登録ユーザーのカウンターは初期値を返す', () => {
    const counter = localSupervisionTrackingRepository.getCounter(2001);
    expect(counter).toEqual({
      userId: 2001,
      supportCount: 0,
      lastObservedAt: null,
    });
  });

  it('incrementSupportCount でカウンターを加算できる', () => {
    localSupervisionTrackingRepository.incrementSupportCount(2001);
    localSupervisionTrackingRepository.incrementSupportCount(2001);
    const counter = localSupervisionTrackingRepository.getCounter(2001);
    expect(counter.supportCount).toBe(2);
  });

  it('resetSupportCount でカウンターを 0 に戻し最終観察日を更新する', () => {
    localSupervisionTrackingRepository.incrementSupportCount(2001);
    const observedAt = '2026-04-13T10:00:00.000Z';
    localSupervisionTrackingRepository.resetSupportCount(2001, observedAt);
    const counter = localSupervisionTrackingRepository.getCounter(2001);
    expect(counter.supportCount).toBe(0);
    expect(counter.lastObservedAt).toBe(observedAt);
  });

  it('addSupervisionLog でログ保存とカウンター自動リセットを行う', () => {
    localSupervisionTrackingRepository.incrementSupportCount(2001);
    localSupervisionTrackingRepository.incrementSupportCount(2001);
    localSupervisionTrackingRepository.addSupervisionLog({
      id: 'log-1',
      userId: 2001,
      supervisorId: 999,
      observedAt: '2026-04-13T11:00:00.000Z',
      notes: '観察メモ',
      actionsTaken: ['助言'],
    });

    const logs = localSupervisionTrackingRepository.listLogsForUser(2001);
    const counter = localSupervisionTrackingRepository.getCounter(2001);
    expect(logs).toHaveLength(1);
    expect(counter.supportCount).toBe(0);
    expect(counter.lastObservedAt).toBe('2026-04-13T11:00:00.000Z');
  });

  it('listLogsForUser は対象ユーザーのみ返す', () => {
    localSupervisionTrackingRepository.addSupervisionLog({
      id: 'log-1',
      userId: 2001,
      supervisorId: 999,
      observedAt: '2026-04-13T11:00:00.000Z',
      notes: 'u2001',
      actionsTaken: [],
    });
    localSupervisionTrackingRepository.addSupervisionLog({
      id: 'log-2',
      userId: 2002,
      supervisorId: 999,
      observedAt: '2026-04-13T12:00:00.000Z',
      notes: 'u2002',
      actionsTaken: [],
    });

    const logs = localSupervisionTrackingRepository.listLogsForUser(2001);
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('log-1');
  });
});
