import { useCallback, useEffect, useState } from 'react';
import { createToiletRecord, listToiletRecordsByDate } from './toiletRecordRepository';
import type { ToiletRecord, ToiletRecordInput } from './types';

export function useToiletRecords(dateIso: string) {
  const [records, setRecords] = useState<ToiletRecord[]>([]);

  const refresh = useCallback(() => {
    setRecords(listToiletRecordsByDate(dateIso));
  }, [dateIso]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((input: ToiletRecordInput) => {
    const record = createToiletRecord(input);
    refresh();
    return record;
  }, [refresh]);

  return { records, create, refresh };
}
