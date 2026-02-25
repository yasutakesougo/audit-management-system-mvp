import { useCancelToDashboard } from '@/lib/nav/useCancelToDashboard';
import { TESTIDS } from '@/testids';
import { useCallback, useState } from 'react';
import { upsertDailyTableRecords, type DailyTableRecord } from './infra/dailyTableRepository';

type TableDailyRecordPayload = {
  date: string;
  reporter: {
    name: string;
    role: string;
  };
  userRows: Array<{
    userId: string;
    userName: string;
    amActivity: string;
    pmActivity: string;
    lunchAmount: string;
    problemBehavior: Record<string, boolean>;
    specialNotes: string;
  }>;
};

type TableDailyRecordViewModel = {
  open: boolean;
  title: string;
  backTo: string;
  testId: string;
  onClose: () => void;
  onSave: (records: DailyTableRecord[]) => Promise<void>;
};

export const useTableDailyRecordViewModel = (): TableDailyRecordViewModel => {
  const cancelToDashboard = useCancelToDashboard();
  const [open, setOpen] = useState(true);

  const navigateBackToMenu = useCallback(() => {
    setOpen(false);
    cancelToDashboard();
  }, [cancelToDashboard]);

  const handleTableSave = useCallback(async (records: DailyTableRecord[]) => {
    console.log('一覧形式記録保存 (新形式):', records);

    // Simulate API delay/request
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Persist ONLY on success
    upsertDailyTableRecords(records);

    alert(`${records.length}人分の活動記録を保存しました`);
    navigateBackToMenu();
  }, [navigateBackToMenu]);

  return {
    open,
    title: '一覧形式ケース記録',
    backTo: '/dashboard',
    testId: TESTIDS['daily-table-record-page'],
    onClose: navigateBackToMenu,
    onSave: handleTableSave,
  };
};

export type { TableDailyRecordPayload, TableDailyRecordViewModel };
