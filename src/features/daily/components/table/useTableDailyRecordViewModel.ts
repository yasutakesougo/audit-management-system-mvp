import { useCancelToToday } from '@/lib/nav/useCancelToDashboard';
import { TESTIDS } from '@/testids';
import { useCallback, useState } from 'react';
import type { DailyRecordRepository } from '../../domain/legacy/DailyRecordRepository';

type TableDailyRecordViewModel = {
  open: boolean;
  title: string;
  backTo: string;
  testId: string;
  onClose: () => void;
  onSuccess: () => void;
  repository: DailyRecordRepository;
};

export const useTableDailyRecordViewModel = (
  repository: DailyRecordRepository,
): TableDailyRecordViewModel => {
  const cancelToToday = useCancelToToday();
  const [open, setOpen] = useState(true);

  const navigateBackToMenu = useCallback(() => {
    setOpen(false);
    cancelToToday();
  }, [cancelToToday]);

  const handleTableSuccess = useCallback(() => {
    // 成功時のコールバック（画面を閉じてメニューへ戻る）
    navigateBackToMenu();
  }, [navigateBackToMenu]);

  return {
    open,
    title: '一覧形式の日々の記録',
    backTo: '/today',
    testId: TESTIDS['daily-table-record-page'],
    onClose: navigateBackToMenu,
    onSuccess: handleTableSuccess,
    repository,
  };
};

export type { TableDailyRecordViewModel };
