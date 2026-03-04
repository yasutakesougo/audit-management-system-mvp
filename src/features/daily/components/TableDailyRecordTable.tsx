import { TESTIDS } from '@/testids';
import ClearIcon from '@mui/icons-material/Clear';
import {
    Box,
    Chip,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import React from 'react';
import type { UserRowData } from '../hooks/useTableDailyRecordForm';

const LUNCH_OPTIONS = ['完食', '8割', '半分', '少量', 'なし'];

const PROBLEM_BEHAVIOR_LABELS: Record<keyof UserRowData['problemBehavior'], string> = {
  selfHarm: '自傷',
  violence: '暴力',
  loudVoice: '大声',
  pica: '異食',
  other: 'その他',
};

type TableDailyRecordTableProps = {
  rows: UserRowData[];
  onRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  onProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  onClearRow: (userId: string) => void;
};

export const TableDailyRecordTable: React.FC<TableDailyRecordTableProps> = ({
  rows,
  onRowDataChange,
  onProblemBehaviorChange,
  onClearRow,
}) => {
  return (
    <TableContainer
      data-testid={TESTIDS['daily-table-record-form-table']}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>利用者</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>午前活動</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>午後活動</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>昼食摂取</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>問題行動</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>特記事項</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: '0.75rem', width: 40 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
                    {row.userName}
                    <Typography component="span" variant="caption" color="textSecondary" sx={{ ml: 0.5 }}>
                      {row.userId}
                    </Typography>
                  </Typography>
                </TableCell>

                <TableCell sx={{ py: 0.5 }}>
                  <TextField
                    size="small"
                    placeholder="午前"
                    value={row.amActivity}
                    onChange={(e) => onRowDataChange(row.userId, 'amActivity', e.target.value)}
                    sx={{ minWidth: 110 }}
                    inputProps={{ style: { fontSize: '0.8rem', padding: '6px 8px' } }}
                  />
                </TableCell>

                <TableCell sx={{ py: 0.5 }}>
                  <TextField
                    size="small"
                    placeholder="午後"
                    value={row.pmActivity}
                    onChange={(e) => onRowDataChange(row.userId, 'pmActivity', e.target.value)}
                    sx={{ minWidth: 110 }}
                    inputProps={{ style: { fontSize: '0.8rem', padding: '6px 8px' } }}
                  />
                </TableCell>

                <TableCell sx={{ py: 0.5 }}>
                  <FormControl size="small" sx={{ minWidth: 75 }}>
                    <Select
                      name={`lunchAmount-${row.userId}`}
                      value={row.lunchAmount}
                      onChange={(e) => onRowDataChange(row.userId, 'lunchAmount', e.target.value)}
                      displayEmpty
                      sx={{ fontSize: '0.8rem' }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.8rem' }}>-</MenuItem>
                      {LUNCH_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option} sx={{ fontSize: '0.8rem' }}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>

                <TableCell sx={{ py: 0.5 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, minWidth: 120 }}>
                    {(Object.keys(PROBLEM_BEHAVIOR_LABELS) as Array<keyof UserRowData['problemBehavior']>).map((type) => (
                      <Chip
                        key={type}
                        label={PROBLEM_BEHAVIOR_LABELS[type]}
                        size="small"
                        variant={row.problemBehavior[type] ? 'filled' : 'outlined'}
                        clickable
                        onClick={() => onProblemBehaviorChange(row.userId, type, !row.problemBehavior[type])}
                        color={row.problemBehavior[type] ? 'warning' : 'default'}
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </TableCell>

                <TableCell sx={{ py: 0.5 }}>
                  <TextField
                    size="small"
                    placeholder="特記"
                    value={row.specialNotes}
                    onChange={(e) => onRowDataChange(row.userId, 'specialNotes', e.target.value)}
                    sx={{ minWidth: 140 }}
                    multiline
                    maxRows={2}
                    inputProps={{ style: { fontSize: '0.8rem', padding: '4px 8px' } }}
                  />
                </TableCell>

                <TableCell sx={{ py: 0.5, px: 0.5 }}>
                  <Tooltip title="クリア">
                    <IconButton size="small" aria-label="この行をクリア" onClick={() => onClearRow(row.userId)}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </TableContainer>
  );
};
