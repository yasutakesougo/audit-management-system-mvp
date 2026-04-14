// ---------------------------------------------------------------------------
// useExecutionRecord — B-Layer hook bridging executionStore → A-Layer
//
// Storeへのアクセスを抽象化し、UI側が日付とタイムスタンプを意識せずに済む。
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { type RecordStatus, makeRecordId, type ExecutionRecord } from '../domain/executionRecordTypes';
import { useExecutionData } from './useExecutionData';

export function useExecutionRecord(date: string, userId: string, scheduleItemId: string) {
  const { getRecord, upsertRecord } = useExecutionData();
  const [record, setRecord] = useState<ExecutionRecord | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecord = useCallback(async () => {
    setIsLoading(true);
    const r = await getRecord(date, userId, scheduleItemId);
    setRecord(r);
    setIsLoading(false);
  }, [getRecord, date, userId, scheduleItemId]);

  useEffect(() => {
    void fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, userId, scheduleItemId]);

  const setStatus = useCallback(
    async (status: RecordStatus) => {
      const next: ExecutionRecord = {
        id: makeRecordId(date, userId, scheduleItemId),
        date,
        userId,
        scheduleItemId,
        status,
        memo: record?.memo ?? '',
        triggeredBipIds: record?.triggeredBipIds ?? [],
        recordedBy: record?.recordedBy ?? '',
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecord(next);
    },
    [date, userId, scheduleItemId, record, upsertRecord],
  );

  const setMemo = useCallback(
    async (memo: string) => {
      if (!record) return;
      const next = {
        ...record,
        memo,
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecord(next);
    },
    [record, upsertRecord],
  );

  return { record, setStatus, setMemo, isLoading, refresh: fetchRecord } as const;
}

