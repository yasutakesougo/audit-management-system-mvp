import React from 'react';

import { FullScreenDailyDialogPage } from './components/FullScreenDailyDialogPage';
import { TableDailyRecordForm } from './TableDailyRecordForm';
import { useTableDailyRecordViewModel } from './useTableDailyRecordViewModel';

export const TableDailyRecordPage: React.FC = () => {
  const vm = useTableDailyRecordViewModel();

  return (
    <FullScreenDailyDialogPage
      open={vm.open}
      title={vm.title}
      backTo={vm.backTo}
      hubTo="/dailysupport"
      testId={vm.testId}
      onClose={vm.onClose}
    >
      <TableDailyRecordForm
        open={vm.open}
        onClose={vm.onClose}
        onSave={vm.onSave}
        variant="content"
      />
    </FullScreenDailyDialogPage>
  );
};

export default TableDailyRecordPage;
