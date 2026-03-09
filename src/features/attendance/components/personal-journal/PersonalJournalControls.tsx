import { TESTIDS } from '@/testids';
import PrintIcon from '@mui/icons-material/Print';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import React from 'react';
import { MOCK_USERS } from './personalJournalHelpers';

export interface PersonalJournalControlsProps {
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  selectedYear: number;
  selectedMonth: number;
  handleMonthChange: (val: string) => void;
  monthOptions: { value: string; label: string; year: number; month: number }[];
}

export const PersonalJournalControls: React.FC<PersonalJournalControlsProps> = ({
  selectedUserId,
  setSelectedUserId,
  selectedYear,
  selectedMonth,
  handleMonthChange,
  monthOptions,
}) => {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center" data-print="hide">
      <TextField
        select
        size="small"
        label="利用者"
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        data-testid={TESTIDS['personal-journal-user-select']}
        sx={{ minWidth: 180 }}
      >
        {MOCK_USERS.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="対象月"
        value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
        onChange={(e) => handleMonthChange(e.target.value)}
        data-testid={TESTIDS['personal-journal-month-select']}
        sx={{ minWidth: 180 }}
      >
        {monthOptions.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>

      <Button
        variant="outlined"
        size="small"
        startIcon={<PrintIcon />}
        onClick={() => window.print()}
        sx={{ ml: 'auto' }}
      >
        印刷
      </Button>
    </Stack>
  );
};
