import { useCancelToToday } from '@/lib/nav/useCancelToDashboard';
import { TESTIDS } from '@/testids';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import type { TableDailyRecordData } from '../hooks/useTableDailyRecordForm';
import { useDailyRecordRepository } from '../repositoryFactory';

// Re-export for backward compatibility
export type TableDailyRecordPayload = TableDailyRecordData;

type TableDailyRecordViewModel = {
  open: boolean;
  title: string;
  backTo: string;
  testId: string;
  onClose: () => void;
  onSave: (data: TableDailyRecordPayload) => Promise<void>;
};

export const useTableDailyRecordViewModel = (): TableDailyRecordViewModel => {
  const cancelToToday = useCancelToToday();
  const repository = useDailyRecordRepository();
  const [open, setOpen] = useState(true);

  const navigateBackToMenu = useCallback(() => {
    setOpen(false);
    cancelToToday();
  }, [cancelToToday]);

  const handleTableSave = useCallback(async (data: TableDailyRecordPayload) => {
    try {
      // Save to repository (SharePoint in production, InMemory in demo mode)
      await repository.save(data);
      navigateBackToMenu();
    } catch (error) {
      console.error('日報保存に失敗しました:', error);
      toast.error('保存に失敗しました。もう一度お試しください。', { duration: 5000 });
      throw error;
    }
  }, [repository, navigateBackToMenu]);

  return {
    open,
    title: '一覧形式の日々の記録',
    backTo: '/today',
    testId: TESTIDS['daily-table-record-page'],
    onClose: navigateBackToMenu,
    onSave: handleTableSave,
  };
};

export type { TableDailyRecordViewModel };
