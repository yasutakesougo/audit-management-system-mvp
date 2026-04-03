import { useCallback } from 'react';
import type { TableDailyRecordData } from '../../hooks/view-models/useTableDailyRecordForm';
import { useDailyRecordRepository } from '../../repositories/repositoryFactory';

export const useTableDailyRecordSave = () => {
  const repository = useDailyRecordRepository();

  const save = useCallback(async (data: TableDailyRecordData) => {
    // Pure save only, no UI side effects (alert/navigate)
    // Inject userCount derived from userRows count to satisfy DailyRecordDomain schema
    await repository.save({
      ...data,
      userCount: data.userRows.length,
    });
  }, [repository]);

  return { save };
};
