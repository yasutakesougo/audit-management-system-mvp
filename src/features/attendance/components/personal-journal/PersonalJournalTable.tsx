import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { PersonalDayEntry } from '@/features/attendance/journalMapper';
import {
    ABSENT_BG,
    CELL_BORDER,
    cellSx,
    getDowColor,
    HEADER_BG,
    headerCellSx,
    SIGN_CELL_BORDER,
    toJapaneseEra,
    WEEKEND_BG,
} from './personalJournalHelpers';

export interface PersonalJournalTableProps {
  entries: PersonalDayEntry[];
  selectedYear: number;
  selectedMonth: number;
  selectedUser: { id: string; name: string };
  stats: { attended: number; absent: number; late: number };
}

export const PersonalJournalTable: React.FC<PersonalJournalTableProps> = ({
  entries,
  selectedYear,
  selectedMonth,
  selectedUser,
  stats,
}) => {
  return (
    <TableContainer
      sx={{
        mt: 2,
        maxWidth: { xs: '100%', xl: 1400 },
        overflowX: 'auto',
      }}
    >
      <Table
        size="small"
        sx={{
          minWidth: 1000,
          borderRight: CELL_BORDER,
          borderBottom: CELL_BORDER,
          borderCollapse: 'separate',
          borderSpacing: 0,
        }}
      >
        {/* ── Title Row ────────────────────────────────────────────── */}
        <TableHead>
          {/* Row 1: Header with title and name */}
          <TableRow>
            <TableCell
              colSpan={3}
              sx={{
                ...headerCellSx,
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: 2,
                borderLeft: CELL_BORDER,
                borderTop: CELL_BORDER,
              }}
            >
              業務日誌
            </TableCell>
            <TableCell colSpan={2} sx={{ ...headerCellSx, fontSize: 12, borderTop: CELL_BORDER }}>
              {toJapaneseEra(selectedYear)}
            </TableCell>
            <TableCell sx={{ ...headerCellSx, fontSize: 14, fontWeight: 900, borderTop: CELL_BORDER }}>
              {selectedMonth}月
            </TableCell>
            <TableCell colSpan={2} sx={{ ...headerCellSx, fontSize: 12, borderTop: CELL_BORDER }}>
              利用者氏名
            </TableCell>
            <TableCell colSpan={4} sx={{ ...headerCellSx, fontSize: 14, fontWeight: 900, borderTop: CELL_BORDER }}>
              {selectedUser.name}{' '}様
            </TableCell>

            {/* Screen: attendance summary chips (hidden when printing) */}
            <TableCell
              colSpan={2}
              sx={{
                ...headerCellSx,
                borderTop: CELL_BORDER,
                '@media print': { display: 'none' },
              }}
            >
              <Stack direction="row" spacing={2} justifyContent="center">
                <Box>
                  <Typography variant="caption" sx={{ fontSize: 9 }}>出席</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{stats.attended}日</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontSize: 9 }}>欠席</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>{stats.absent}日</Typography>
                </Box>
                {stats.late > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: 9 }}>遅刻</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>{stats.late}日</Typography>
                  </Box>
                )}
              </Stack>
            </TableCell>

            {/* Print-only: signature boxes (hidden on screen, shown when printing) */}
            <TableCell
              colSpan={2}
              sx={{
                ...headerCellSx,
                borderTop: CELL_BORDER,
                p: 0,
                verticalAlign: 'top',
                display: 'none',
                '@media print': { display: 'table-cell !important' },
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        border: SIGN_CELL_BORDER,
                        padding: '2px 6px',
                        fontSize: 9,
                        fontWeight: 700,
                        textAlign: 'center',
                        background: HEADER_BG,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      管理者
                    </th>
                    <th
                      style={{
                        border: SIGN_CELL_BORDER,
                        padding: '2px 6px',
                        fontSize: 9,
                        fontWeight: 700,
                        textAlign: 'center',
                        background: HEADER_BG,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      サービス管理責任者
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      style={{
                        border: SIGN_CELL_BORDER,
                        height: 36,
                      }}
                    >
                      &nbsp;
                    </td>
                    <td
                      style={{
                        border: SIGN_CELL_BORDER,
                        height: 36,
                      }}
                    >
                      &nbsp;
                    </td>
                  </tr>
                </tbody>
              </table>
            </TableCell>
          </TableRow>

          {/* Row 2: Column Headers */}
          <TableRow>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36, borderLeft: CELL_BORDER }}>日付</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 28, minWidth: 28 }}>曜日</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36 }}>出欠</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 70, minWidth: 70 }}>朝</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 70, minWidth: 70 }}>帰り</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 40, minWidth: 40 }}>食事</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 90, minWidth: 90 }}>AM作業</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 90, minWidth: 90 }}>PM作業</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36 }}>拘束</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36 }}>自傷</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36 }}>他傷</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36 }}>発作</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 200 }}>様子・特記（ヒヤリハット・発作時間等）</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 36, minWidth: 36 }}>別紙</TableCell>
          </TableRow>
        </TableHead>

        {/* ── Data Rows ────────────────────────────────────────────── */}
        <TableBody>
          {entries.map((entry) => {
            const isWeekend = entry.attendance === '休日';
            const isAbsent = entry.attendance === '欠席';
            const rowBg = isWeekend ? WEEKEND_BG : isAbsent ? ABSENT_BG : undefined;

            return (
              <TableRow key={entry.day} sx={{ bgcolor: rowBg }}>
                {/* 日付 */}
                <TableCell
                  sx={{
                    ...cellSx,
                    textAlign: 'center',
                    fontWeight: 700,
                    borderLeft: CELL_BORDER,
                    color: getDowColor(entry.dow),
                  }}
                >
                  {entry.day}
                </TableCell>

                {/* 曜日 */}
                <TableCell
                  sx={{
                    ...cellSx,
                    textAlign: 'center',
                    fontWeight: 600,
                    color: getDowColor(entry.dow),
                  }}
                >
                  {entry.dow}
                </TableCell>

                {/* 出欠 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center' }}>
                  {isWeekend ? '' : (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        px: 0.5,
                        borderRadius: 0.5,
                        fontSize: 10,
                        fontWeight: 700,
                        ...(entry.attendance === '出席' && { color: '#2e7d32' }),
                        ...(entry.attendance === '欠席' && { color: '#d32f2f', fontWeight: 900 }),
                        ...(entry.attendance === '遅刻' && { color: '#e65100' }),
                      }}
                    >
                      {entry.attendance === '出席' ? '出' : entry.attendance === '欠席' ? '欠' : '遅'}
                    </Box>
                  )}
                </TableCell>

                {/* 朝(送迎) */}
                <TableCell sx={{ ...cellSx, fontSize: 10 }}>
                  {entry.arrivalTime && (
                    <Box>
                      <Box component="span" sx={{ fontSize: 9, color: 'text.secondary' }}>
                        {entry.arrivalTransport.split('→')[1] ?? ''}
                      </Box>
                      {' '}
                      {entry.arrivalTime}
                    </Box>
                  )}
                </TableCell>

                {/* 帰り(送迎) */}
                <TableCell sx={{ ...cellSx, fontSize: 10 }}>
                  {entry.departTime && (
                    <Box>
                      <Box component="span" sx={{ fontSize: 9, color: 'text.secondary' }}>
                        {entry.departTransport.split('→')[1] ?? ''}
                      </Box>
                      {' '}
                      {entry.departTime}
                    </Box>
                  )}
                </TableCell>

                {/* 食事 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center', fontSize: 10 }}>
                  {entry.mealAmount === '完食' ? '完' :
                   entry.mealAmount === '多め' ? '多' :
                   entry.mealAmount === '半分' ? '半' :
                   entry.mealAmount === '少なめ' ? '少' :
                   entry.mealAmount === 'なし' ? '×' : ''}
                </TableCell>

                {/* AM作業 */}
                <TableCell sx={{ ...cellSx, fontSize: 10 }}>
                  {entry.amActivity}
                </TableCell>

                {/* PM作業 */}
                <TableCell sx={{ ...cellSx, fontSize: 10 }}>
                  {entry.pmActivity}
                </TableCell>

                {/* 拘束 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center', color: entry.restraint ? '#d32f2f' : 'text.disabled' }}>
                  {isWeekend || isAbsent ? '' : entry.restraint ? '有' : '無'}
                </TableCell>

                {/* 自傷 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center', color: entry.selfHarm ? '#e65100' : 'text.disabled' }}>
                  {isWeekend || isAbsent ? '' : entry.selfHarm ? '有' : '無'}
                </TableCell>

                {/* 他傷 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center', color: entry.otherInjury ? '#e65100' : 'text.disabled' }}>
                  {isWeekend || isAbsent ? '' : entry.otherInjury ? '有' : '無'}
                </TableCell>

                {/* 発作 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center', color: entry.seizure ? '#c62828' : 'text.disabled' }}>
                  {isWeekend || isAbsent ? '' : entry.seizure ? '有' : '無'}
                </TableCell>

                {/* 様子・特記 */}
                <TableCell sx={{ ...cellSx, fontSize: 10, maxWidth: 300 }}>
                  {entry.specialNotes && (
                    <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      {entry.specialNotes}
                    </Box>
                  )}
                </TableCell>

                {/* 別紙 */}
                <TableCell sx={{ ...cellSx, textAlign: 'center', color: entry.hasAttachment ? '#1565c0' : 'text.disabled' }}>
                  {isWeekend || isAbsent ? '' : entry.hasAttachment ? '有' : '無'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
