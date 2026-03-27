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
import type { UserRowData } from '../../hooks/view-models/useTableDailyRecordForm';
import { BehaviorTagChips } from './BehaviorTagChips';

const LUNCH_OPTIONS = ['完食', '8割', '半分', '少量', 'なし'];

const PROBLEM_BEHAVIOR_LABELS: Record<keyof UserRowData['problemBehavior'], string> = {
  selfHarm: '自傷',
  otherInjury: '他傷',
  loudVoice: '大声',
  pica: '異食',
  other: 'その他',
};

type TableDailyRecordTableProps = {
  rows: UserRowData[];
  onRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  onProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  onBehaviorTagToggle: (userId: string, tagKey: string) => void;
  onClearRow: (userId: string) => void;
};

export const TableDailyRecordTable: React.FC<TableDailyRecordTableProps> = ({
  rows,
  onRowDataChange,
  onProblemBehaviorChange,
  onBehaviorTagToggle,
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
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', fontWeight: 600 }}>利用者</TableCell>
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', fontWeight: 600 }}>午前活動</TableCell>
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', fontWeight: 600 }}>午後活動</TableCell>
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', fontWeight: 600 }}>昼食</TableCell>
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', fontWeight: 600 }}>問題行動</TableCell>
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', fontWeight: 600 }}>特記事項</TableCell>
              <TableCell sx={{ py: 0.25, fontSize: '0.72rem', width: 32 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', lineHeight: 1.2, fontWeight: 500 }}>
                    {row.userName}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                    {row.userId}
                  </Typography>
                </TableCell>

                <TableCell sx={{ py: 0.25, verticalAlign: 'top' }}>
                  <TextField
                    size="small"
                    placeholder="午前"
                    value={row.amActivity}
                    onChange={(e) => onRowDataChange(row.userId, 'amActivity', e.target.value)}
                    sx={{ minWidth: 100 }}
                    inputProps={{ style: { fontSize: '0.78rem', padding: '3px 6px' } }}
                  />
                </TableCell>

                <TableCell sx={{ py: 0.25, verticalAlign: 'top' }}>
                  <TextField
                    size="small"
                    placeholder="午後"
                    value={row.pmActivity}
                    onChange={(e) => onRowDataChange(row.userId, 'pmActivity', e.target.value)}
                    sx={{ minWidth: 100 }}
                    inputProps={{ style: { fontSize: '0.78rem', padding: '3px 6px' } }}
                  />
                </TableCell>

                <TableCell sx={{ py: 0.25, verticalAlign: 'top' }}>
                  <FormControl size="small" sx={{ minWidth: 68 }}>
                    <Select
                      name={`lunchAmount-${row.userId}`}
                      value={row.lunchAmount}
                      onChange={(e) => onRowDataChange(row.userId, 'lunchAmount', e.target.value)}
                      displayEmpty
                      sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: '3px', px: '6px' } }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.75rem' }}>-</MenuItem>
                      {LUNCH_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option} sx={{ fontSize: '0.75rem' }}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>

                <TableCell sx={{ py: 0.25, verticalAlign: 'top', position: 'relative' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: '2px', alignItems: 'center', minWidth: 0 }}>
                    {(Object.keys(PROBLEM_BEHAVIOR_LABELS) as Array<keyof UserRowData['problemBehavior']>).map((type) => (
                      <Chip
                        key={type}
                        label={PROBLEM_BEHAVIOR_LABELS[type]}
                        size="small"
                        variant={row.problemBehavior[type] ? 'filled' : 'outlined'}
                        clickable
                        onClick={() => onProblemBehaviorChange(row.userId, type, !row.problemBehavior[type])}
                        color={row.problemBehavior[type] ? 'warning' : 'default'}
                        sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }}
                      />
                    ))}
                    <BehaviorTagChips
                      selectedTags={row.behaviorTags ?? []}
                      onToggleTag={(tagKey) => onBehaviorTagToggle(row.userId, tagKey)}
                      inline
                    />
                  </Box>
                </TableCell>

                <TableCell sx={{ py: 0.25, verticalAlign: 'top' }}>
                  <TextField
                    size="small"
                    placeholder="特記"
                    value={row.specialNotes}
                    onChange={(e) => onRowDataChange(row.userId, 'specialNotes', e.target.value)}
                    sx={{ minWidth: 120 }}
                    multiline
                    maxRows={1}
                    inputProps={{ style: { fontSize: '0.78rem', padding: '3px 6px' } }}
                  />
                </TableCell>

                <TableCell sx={{ py: 0.25, px: 0.25, verticalAlign: 'top' }}>
                  <Tooltip title="クリア">
                    <IconButton size="small" sx={{ p: 0.25 }} aria-label="この行をクリア" onClick={() => onClearRow(row.userId)}>
                      <ClearIcon sx={{ fontSize: 16 }} />
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
