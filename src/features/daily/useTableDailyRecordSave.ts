import { useCallback } from 'react';
import type { TableDailyRecordData } from './hooks/useTableDailyRecordForm';
import { useDailyRecordRepository } from './repositoryFactory';

export const useTableDailyRecordSave = () => {
  const repository = useDailyRecordRepository();

  const save = useCallback(async (data: TableDailyRecordData) => {
    // Pure save only, no UI side effects (alert/navigate)
    await repository.save(data);
  }, [repository]);

  return { save };
};
