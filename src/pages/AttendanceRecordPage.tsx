import { AttendancePanel } from '@/features/attendance';
import { TESTIDS } from '@/testids';
import { Container } from '@mui/material';

import { FullScreenDailyDialogPage } from '@/features/daily/components/FullScreenDailyDialogPage';

type AttendanceRecordPageProps = {
  'data-testid'?: string;
};

const AttendanceRecordPage = ({ 'data-testid': dataTestId }: AttendanceRecordPageProps): JSX.Element => {
  return (
    <FullScreenDailyDialogPage title="通所（出欠）" backTo="/dashboard" testId="daily-attendance-page">
      <Container maxWidth="lg" sx={{ py: 4 }} data-testid={dataTestId ?? TESTIDS['attendance-page']}>
        <AttendancePanel />
      </Container>
    </FullScreenDailyDialogPage>
  );
};

export default AttendanceRecordPage;
