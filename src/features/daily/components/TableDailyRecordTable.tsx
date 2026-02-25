import { TESTIDS } from '@/testids';
import ClearIcon from '@mui/icons-material/Clear';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import {
    Box,
    Chip,
    FormControl,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React from 'react';
import { useSupportPlanHints } from '../hooks/useSupportPlanHints';
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
  const hintsMap = useSupportPlanHints();

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        一覧入力テーブル
      </Typography>

      <TableContainer data-testid={TESTIDS['daily-table-record-form-table']} sx={{ maxHeight: 400 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>利用者</TableCell>
              <TableCell>午前活動</TableCell>
              <TableCell>午後活動</TableCell>
              <TableCell>昼食摂取</TableCell>
              <TableCell>問題行動</TableCell>
              <TableCell>特記事項</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ minWidth: 100 }}>
                      {row.userName}
                      <br />
                      <Typography variant="caption" color="textSecondary">
                        ({row.userId})
                      </Typography>
                    </Typography>
                    {hintsMap[row.userId]?.longTermGoal && (
                      <Tooltip title={`【長期目標】\n${hintsMap[row.userId]?.longTermGoal}`} arrow>
                        <InfoOutlinedIcon
                          data-testid="support-plan-goal-icon"
                          aria-label="長期目標あり"
                          sx={{ fontSize: 16, color: 'info.main', cursor: 'help' }}
                        />
                      </Tooltip>
                    )}
                    {hintsMap[row.userId]?.riskManagement && (
                      <Tooltip title={`【配慮・リスク】\n${hintsMap[row.userId]?.riskManagement}`} arrow>
                        <WarningRoundedIcon
                          data-testid="support-plan-risk-icon"
                          aria-label="リスク情報あり"
                          sx={{ fontSize: 16, color: 'warning.main', cursor: 'help' }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    placeholder="午前の活動"
                    value={row.amActivity}
                    onChange={(e) => onRowDataChange(row.userId, 'amActivity', e.target.value)}
                    helperText={hintsMap[row.userId]?.dailySupports ? '支援手順あり' : undefined}
                    FormHelperTextProps={{ sx: { fontSize: '0.65rem', m: 0, mt: 0.25 } }}
                    InputProps={{
                      endAdornment: hintsMap[row.userId]?.dailySupports ? (
                        <Tooltip title={`【支援手順】\n${hintsMap[row.userId]?.dailySupports}`} arrow>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'info.light', opacity: 0.7 }} />
                        </Tooltip>
                      ) : null,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' || e.key === 'Enter') {
                        // Tab移動を促進
                      }
                    }}
                    sx={{ minWidth: 150 }}
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    placeholder="午後の活動"
                    value={row.pmActivity}
                    onChange={(e) => onRowDataChange(row.userId, 'pmActivity', e.target.value)}
                    helperText={hintsMap[row.userId]?.dailySupports ? '支援手順あり' : undefined}
                    FormHelperTextProps={{ sx: { fontSize: '0.65rem', m: 0, mt: 0.25 } }}
                    InputProps={{
                      endAdornment: hintsMap[row.userId]?.dailySupports ? (
                        <Tooltip title={`【支援手順】\n${hintsMap[row.userId]?.dailySupports}`} arrow>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'info.light', opacity: 0.7 }} />
                        </Tooltip>
                      ) : null,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' || e.key === 'Enter') {
                        // Tab移動を促進
                      }
                    }}
                    sx={{ minWidth: 150 }}
                  />
                </TableCell>

                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <Select
                      name={`lunchAmount-${row.userId}`}
                      value={row.lunchAmount}
                      onChange={(e) => onRowDataChange(row.userId, 'lunchAmount', e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">選択</MenuItem>
                      {LUNCH_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>

                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, minWidth: 150 }}>
                    {(Object.keys(PROBLEM_BEHAVIOR_LABELS) as Array<keyof UserRowData['problemBehavior']>).map((type) => (
                      <Chip
                        key={type}
                        label={PROBLEM_BEHAVIOR_LABELS[type]}
                        size="small"
                        variant={row.problemBehavior[type] ? 'filled' : 'outlined'}
                        clickable
                        onClick={() => onProblemBehaviorChange(row.userId, type, !row.problemBehavior[type])}
                        color={row.problemBehavior[type] ? 'warning' : 'default'}
                      />
                    ))}
                  </Box>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    placeholder="特記事項"
                    value={row.specialNotes}
                    onChange={(e) => onRowDataChange(row.userId, 'specialNotes', e.target.value)}
                    sx={{ minWidth: 200 }}
                    multiline
                    maxRows={2}
                  />
                </TableCell>

                <TableCell>
                  <Tooltip title="この行をクリア">
                    <IconButton size="small" aria-label="この行をクリア" onClick={() => onClearRow(row.userId)}>
                      <ClearIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
