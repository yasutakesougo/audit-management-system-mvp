import { useStaffAttendanceStore } from './store';
import type { StaffAttendanceStatus } from './types';
import { useStaff } from '@/stores/useStaff';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

export const StaffAttendanceInput: React.FC = () => {
  const { staff } = useStaff();
  const today = new Date().toISOString().slice(0, 10);

  const [attendances, setAttendances] = useState(() => {
    const store = useStaffAttendanceStore();
    return store.listByDate(today);
  });

  const handleStatusChange = (staffId: string, status: StaffAttendanceStatus) => {
    const store = useStaffAttendanceStore();
    store.upsert({ staffId, recordDate: today, status });
    setAttendances(store.listByDate(today));
  };

  // 他のコンポーネントからの変更を反映（1秒ごとにポーリング）
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useStaffAttendanceStore();
      setAttendances(store.listByDate(today));
    }, 1000);
    return () => clearInterval(interval);
  }, [today]);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        職員勤怠入力（{today}）
      </Typography>
      <Stack spacing={2}>
        {staff.map((s) => {
          const att = attendances.find((a) => a.staffId === s.staffId);
          return (
            <Box
              key={s.id}
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ minWidth: 120, fontWeight: 600 }}>
                {s.name}
              </Typography>
              <ToggleButtonGroup
                value={att?.status || ''}
                exclusive
                size="small"
                onChange={(_, val) => val && handleStatusChange(s.staffId, val)}
                aria-label={`${s.name}の勤怠状態`}
              >
                <ToggleButton value="出勤" aria-label="出勤">
                  出勤
                </ToggleButton>
                <ToggleButton value="欠勤" aria-label="欠勤">
                  欠勤
                </ToggleButton>
                <ToggleButton value="外出中" aria-label="外出中">
                  外出
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};
