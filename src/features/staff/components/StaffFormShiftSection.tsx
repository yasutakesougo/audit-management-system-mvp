/** StaffForm — Shift section component */
import WorkIcon from '@mui/icons-material/Work';
import { Box, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';

import type { Errors, FormValues } from '../domain/staffFormDomain';
import { BASE_WEEKDAY_OPTIONS } from '../domain/staffFormDomain';

interface StaffFormShiftSectionProps {
  values: FormValues;
  errors: Errors;
  errRefs: { baseShift: React.RefObject<HTMLInputElement> };
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  toggleBaseWorkingDay: (day: string) => void;
}

export function StaffFormShiftSection({
  values,
  errors,
  errRefs,
  setField,
  toggleBaseWorkingDay,
}: StaffFormShiftSectionProps) {
  return (
    <Box sx={{ mb: 3, border: '1px solid', borderColor: 'grey.300', borderRadius: 1, p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
        <WorkIcon sx={{ mr: 1 }} />
        基本勤務パターン
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="開始時刻"
          type="time"
          inputRef={errRefs.baseShift}
          value={values.BaseShiftStartTime}
          onChange={(event) => setField('BaseShiftStartTime', event.target.value)}
          error={Boolean(errors.baseShift)}
          helperText={errors.baseShift}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="終了時刻"
          type="time"
          value={values.BaseShiftEndTime}
          onChange={(event) => setField('BaseShiftEndTime', event.target.value)}
          error={Boolean(errors.baseShift)}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
          基本勤務曜日
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {BASE_WEEKDAY_OPTIONS.map((day) => {
            const checked = values.BaseWorkingDays.includes(day.value);
            return (
              <FormControlLabel
                key={day.value}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => toggleBaseWorkingDay(day.value)}
                    size="small"
                  />
                }
                label={day.label}
                sx={{
                  border: '1px solid',
                  borderColor: checked ? 'primary.main' : 'grey.300',
                  backgroundColor: checked ? 'primary.light' : 'transparent',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  m: 0,
                  '& .MuiFormControlLabel-label': { fontSize: '0.875rem' }
                }}
              />
            );
          })}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          標準勤務時間を設定すると、シフト作成時の過剰割当を検知しやすくなります。
        </Typography>
      </Box>
    </Box>
  );
}
