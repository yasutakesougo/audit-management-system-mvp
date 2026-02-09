import PersonIcon from '@mui/icons-material/Person';
import { FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import React from 'react';

const ROLE_OPTIONS = ['生活支援員', '管理者', '看護師', '其他'];

type TableDailyRecordHeaderProps = {
  date: string;
  reporterName: string;
  reporterRole: string;
  onDateChange: (value: string) => void;
  onReporterNameChange: (value: string) => void;
  onReporterRoleChange: (value: string) => void;
};

export const TableDailyRecordHeader: React.FC<TableDailyRecordHeaderProps> = ({
  date,
  reporterName,
  reporterRole,
  onDateChange,
  onReporterNameChange,
  onReporterRoleChange,
}) => {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <PersonIcon sx={{ mr: 1 }} />
        基本情報
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          type="date"
          label="記録日"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          fullWidth
          label="記録者名"
          value={reporterName}
          onChange={(e) => onReporterNameChange(e.target.value)}
          placeholder="記録者の氏名を入力"
        />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>役職</InputLabel>
          <Select
            name="reporterRole"
            value={reporterRole}
            onChange={(e) => onReporterRoleChange(e.target.value)}
            label="役職"
          >
            {ROLE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Paper>
  );
};
