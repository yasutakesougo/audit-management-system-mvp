import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
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
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        type="date"
        label="記録日"
        size="small"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 140, width: 140 }}
      />
      <TextField
        size="small"
        label="記録者名"
        value={reporterName}
        onChange={(e) => onReporterNameChange(e.target.value)}
        placeholder="記録者"
        sx={{ minWidth: 120, width: 160 }}
      />
      <FormControl size="small" sx={{ minWidth: 100, width: 110 }}>
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
  );
};
