import { Box } from '@mui/material';
import { useFeatureFlag } from '@/config/featureFlags';
import EmptyState from '@/ui/components/EmptyState';
import { StaffAttendanceInput } from '@/features/staff/attendance/StaffAttendanceInput';

export type StaffAttendanceInputPageProps = {
  className?: string;
};

export const StaffAttendanceInputPage = ({ className }: StaffAttendanceInputPageProps) => {
  const staffAttendanceEnabled = useFeatureFlag("staffAttendance");

  if (!staffAttendanceEnabled) {
    return (
      <Box className={className} data-testid="staff-attendance-empty-state">
        <EmptyState
          title="スタッフ出勤入力は準備中です"
          description="準備ができ次第、表示されます。"
        />
      </Box>
    );
  }

  return (
    <Box className={className} data-testid="staff-attendance-input-root">
      <StaffAttendanceInput />
    </Box>
  );
};
