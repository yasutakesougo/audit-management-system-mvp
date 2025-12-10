import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { TableDailyRecordForm } from './TableDailyRecordForm';

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

export const TableDailyRecordPage: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const navigateBackToMenu = useCallback(() => {
    setOpen(false);
    navigate('/daily', { replace: true });
  }, [navigate]);

  const handleTableSave = useCallback(async (data: TableDailyRecordPayload) => {
    console.log('一覧形式記録保存@/daily/table:', data);

    // TODO: 接続先が決まり次第 SharePoint (or API) 保存処理へ差し替え
    await new Promise((resolve) => setTimeout(resolve, 1000));

    alert(`${data.userRows.length}人分の活動記録を保存しました`);
    navigateBackToMenu();
  }, [navigateBackToMenu]);

  return (
    <TableDailyRecordForm
      open={open}
      onClose={navigateBackToMenu}
      onSave={handleTableSave}
    />
  );
};

export default TableDailyRecordPage;
