import { useCallback, useState } from 'react';
import { TESTIDS } from '@/testids';
import { useCancelToDashboard } from '@/lib/nav/useCancelToDashboard';
import { useDailyRecordRepository } from './repositoryFactory';
import type { TableDailyRecordData } from './hooks/useTableDailyRecordForm';

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
  const cancelToDashboard = useCancelToDashboard();
  const repository = useDailyRecordRepository();
  const [open, setOpen] = useState(true);

  const navigateBackToMenu = useCallback(() => {
    setOpen(false);
    cancelToDashboard();
  }, [cancelToDashboard]);

  const handleTableSave = useCallback(async (data: TableDailyRecordPayload) => {
    console.log('一覧形式記録保存@/daily/table:', data);

    try {
      // Save to repository (SharePoint in production, InMemory in demo mode)
      await repository.save(data);
      
      alert(`${data.userRows.length}人分の活動記録を保存しました`);
      navigateBackToMenu();
    } catch (error) {
      console.error('日報保存に失敗しました:', error);
      alert('保存に失敗しました。もう一度お試しください。');
      throw error;
    }
  }, [repository, navigateBackToMenu]);

  return {
    open,
    title: '一覧形式ケース記録',
    backTo: '/dashboard',
    testId: TESTIDS['daily-table-record-page'],
    onClose: navigateBackToMenu,
    onSave: handleTableSave,
  };
};

export type { TableDailyRecordViewModel };
