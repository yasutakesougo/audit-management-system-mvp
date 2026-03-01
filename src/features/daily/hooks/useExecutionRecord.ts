// ---------------------------------------------------------------------------
// useExecutionRecord — B-Layer hook bridging executionStore → A-Layer
//
// Storeへのアクセスを抽象化し、UI側が日付とタイムスタンプを意識せずに済む。
// ---------------------------------------------------------------------------
import { useCallback } from 'react';

import { type RecordStatus, makeRecordId } from '../domain/executionRecordTypes';
import { useExecutionStore } from '../stores/executionStore';

export function useExecutionRecord(date: string, userId: string, scheduleItemId: string) {
  const { getRecord, upsertRecord } = useExecutionStore();

  const record = getRecord(date, userId, scheduleItemId);

  const setStatus = useCallback(
    (status: RecordStatus) => {
      upsertRecord({
        id: makeRecordId(date, userId, scheduleItemId),
        date,
        userId,
        scheduleItemId,
        status,
        // 既存のメモや発動BIPを維持しつつ、タイムスタンプを更新
        memo: record?.memo ?? '',
        triggeredBipIds: record?.triggeredBipIds ?? [],
        recordedBy: record?.recordedBy ?? '',
        recordedAt: new Date().toISOString(),
      });
    },
    [date, userId, scheduleItemId, record, upsertRecord],
  );

  const setMemo = useCallback(
    (memo: string) => {
      if (!record) return;
      upsertRecord({
        ...record,
        memo,
        recordedAt: new Date().toISOString(),
      });
    },
    [record, upsertRecord],
  );

  return { record, setStatus, setMemo } as const;
}
