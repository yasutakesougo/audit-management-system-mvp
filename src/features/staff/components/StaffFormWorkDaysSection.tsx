/** StaffForm — WorkDays section component */
import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';

import type { FormValues } from '../domain/staffFormDomain';
import { DAYS } from '../domain/staffFormDomain';

interface StaffFormWorkDaysSectionProps {
  values: FormValues;
  toggleWorkDay: (day: string) => void;
}

export function StaffFormWorkDaysSection({ values, toggleWorkDay }: StaffFormWorkDaysSectionProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
        出勤曜日
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {DAYS.map((day) => {
          const checked = values.WorkDays.includes(day.value);
          return (
            <FormControlLabel
              key={day.value}
              control={
                <Checkbox
                  checked={checked}
                  onChange={() => toggleWorkDay(day.value)}
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
    </Box>
  );
}
