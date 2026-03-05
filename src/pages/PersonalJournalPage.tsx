/**
 * Personal Monthly Journal Page (個人月次業務日誌)
 *
 * Displays a single user's daily records for one month in the exact layout
 * of the legacy Excel business journal (業務日誌01.07.19.xlsx).
 *
 * Layout: rows = days of month, columns match the Excel:
 * 日付 | 曜日 | 出欠 | 朝(送迎) | 帰り(送迎) | 食事 |
 */
import { usePersonalJournalData } from '@/features/attendance/usePersonalJournalData';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';
import { TESTIDS } from '@/testids';
import PrintIcon from '@mui/icons-material/Print';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import GlobalStyles from '@mui/material/GlobalStyles';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useSearchParams } from 'react-router-dom';

// ── Mock Users (will be replaced by user master integration) ────────────────

const MOCK_USERS = [
  { id: 'U001', name: '吉田 卓' },
  { id: 'U002', name: '田中 太郎' },
  { id: 'U003', name: '鈴木 花子' },
  { id: 'U004', name: '佐藤 一郎' },
  { id: 'U005', name: '高橋 美咲' },
  { id: 'U006', name: '山田 健二' },
  { id: 'U007', name: '渡辺 愛子' },
  { id: 'U008', name: '伊藤 誠' },
  { id: 'U009', name: '中村 さくら' },
  { id: 'U010', name: '小林 大輔' },
] as const;

// ── Styling ─────────────────────────────────────────────────────────────────

const CELL_BORDER = '1px solid #333';
const HEADER_BG = '#e8e8e8';
const WEEKEND_BG = '#f5f5f5';
const ABSENT_BG = '#fff3e0';

const cellSx = {
  borderRight: CELL_BORDER,
  borderBottom: CELL_BORDER,
  px: 0.5,
  py: 0.25,
  fontSize: 11,
  lineHeight: 1.3,
  whiteSpace: 'nowrap' as const,
} as const;

const headerCellSx = {
  ...cellSx,
  bgcolor: HEADER_BG,
  fontWeight: 700,
  textAlign: 'center' as const,
  position: 'sticky' as const,
  top: 0,
  zIndex: 2,
} as const;

// ── Fiscal year helper ──────────────────────────────────────────────────────

function toJapaneseEra(year: number): string {
  // Reiwa era started 2019
  const reiwaYear = year - 2018;
  if (reiwaYear >= 1) return `令和${reiwaYear}年度`;
  return `${year}年度`;
}

// ── Print Styles ────────────────────────────────────────────────────────────

const SIGN_CELL_BORDER = '1px solid #333';

const printStyles = (
  <GlobalStyles
    styles={{
      '[data-print="only"]': { display: 'none' },
      '@page': {
        size: 'A4 landscape',
        margin: '4mm 4mm 14mm 4mm',
      },
      '@media print': {
        // Hide screen-only UI
        '[data-print="hide"]': { display: 'none !important' },
        '[data-print="only"]': { display: 'block !important' },

        body: {
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          background: '#fff',
          overflow: 'visible !important',
        },

        'html, body': {
          height: 'auto !important',
          overflow: 'visible !important',
        },

        // ── AppShell Reset ──────────────────────────────────────────
        // Hide AppBar (header), sidebar (navigation), footer, mobile drawer, FABs
        '.MuiAppBar-root': { display: 'none !important' },
        '.MuiDrawer-root': { display: 'none !important' },
        '.MuiFab-root': { display: 'none !important' },
        '[data-testid="app-shell"]': {
          display: 'block !important',
          height: 'auto !important',
          overflow: 'visible !important',
        },

        // Reset AppShellV2 grid → single area, no header/sidebar/footer
        '[data-testid="app-shell"] > div': {
          display: 'block !important',
          height: 'auto !important',
          overflow: 'visible !important',
          gridTemplateAreas: 'none !important' as string,
          gridTemplateRows: 'auto !important',
          gridTemplateColumns: '1fr !important',
        },

        // Hide grid areas except main
        '[data-testid="app-shell"] > div > div:not(main)': {
          display: 'none !important',
        },

        // Main content area: remove scroll constraints
        main: {
          overflow: 'visible !important',
          maxWidth: 'none !important',
          height: 'auto !important',
        },

        'main > div': {
          maxWidth: 'none !important',
          padding: '0 !important',
        },

        // ── Content Layer ───────────────────────────────────────────
        '.MuiContainer-root': {
          maxWidth: 'none !important',
          paddingLeft: '0 !important',
          paddingRight: '0 !important',
        },

        '.MuiPaper-root': {
          boxShadow: 'none !important',
        },

        // Compact table cells for print — fit on single A4 landscape page
        '.MuiTableCell-root': {
          paddingTop: '1px !important',
          paddingBottom: '1px !important',
          paddingLeft: '3px !important',
          paddingRight: '3px !important',
          fontSize: '7pt !important',
          lineHeight: '1.15 !important',
        },

        // Stretch table to fill full page height
        '.MuiTableContainer-root': {
          border: 'none !important',
          overflow: 'visible !important',
        },

        '.MuiTable-root': {
          width: '100% !important',
        },

        // Repeat table header on every printed page
        thead: {
          display: 'table-header-group',
        },

        // Stretch data rows to fill 2 pages
        // 22 weekday rows × 15mm ≈ 330mm → fills 2 A4 landscape pages
        '.MuiTableRow-root': {
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        },
        'tbody .MuiTableRow-root': {
          height: '14mm !important',
        },

        // Remove padding from page container
        '[data-testid="personal-journal-page"] > div': {
          padding: '0 !important',
        },


      },
    }}
  />
);

// ── Component ───────────────────────────────────────────────────────────────

export default function PersonalJournalPage() {
  const now = new Date();
  const [searchParams] = useSearchParams();

  // Deep-link support: ?user=U001&month=2026-03
  const initialUser = searchParams.get('user') ?? MOCK_USERS[0].id;
  const initialMonth = searchParams.get('month'); // "YYYY-MM" or null
  const [selectedUserId, setSelectedUserId] = React.useState<string>(
    MOCK_USERS.some((u) => u.id === initialUser) ? initialUser : MOCK_USERS[0].id,
  );
  const [selectedYear, setSelectedYear] = React.useState(() => {
    if (initialMonth) {
      const y = Number(initialMonth.split('-')[0]);
      if (Number.isFinite(y) && y > 2000) return y;
    }
    return now.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    if (initialMonth) {
      const m = Number(initialMonth.split('-')[1]);
      if (Number.isFinite(m) && m >= 1 && m <= 12) return m;
    }
    return now.getMonth() + 1;
  });

  const selectedUser = MOCK_USERS.find((u) => u.id === selectedUserId) ?? MOCK_USERS[0];

  // 申し送りデータ取得（当日分）
  const { todayHandoffs } = useHandoffTimeline('all', 'today');

  const { entries } = usePersonalJournalData(selectedUserId, selectedYear, selectedMonth, todayHandoffs);

  // Month options
  const monthOptions = React.useMemo(() => {
    const options: { value: string; label: string; year: number; month: number }[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      options.push({
        value: `${y}-${String(m).padStart(2, '0')}`,
        label: `${y}年${m}月`,
        year: y,
        month: m,
      });
    }
    return options;
  }, []);

  const handleMonthChange = (value: string) => {
    const opt = monthOptions.find((o) => o.value === value);
    if (opt) {
      setSelectedYear(opt.year);
      setSelectedMonth(opt.month);
    }
  };

  // Summary stats
  const stats = React.useMemo(() => {
    let attended = 0;
    let absent = 0;
    let late = 0;
    for (const e of entries) {
      if (e.attendance === '出席') attended++;
      if (e.attendance === '欠席') absent++;
      if (e.attendance === '遅刻') { attended++; late++; }
    }
    return { attended, absent, late };
  }, [entries]);

  const getDowColor = (dow: string): string => {
    if (dow === '日') return '#d32f2f';
    if (dow === '土') return '#1565c0';
    return '#333';
  };

  return (
    <>
    {printStyles}
    <Container
      maxWidth={false}
      sx={{ px: { xs: 1, md: 2 } }}
      data-testid={TESTIDS['personal-journal-page']}
    >
      <Box sx={{ py: 2 }}>
        {/* Controls — hidden when printing */}
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

        {/* ── Excel-style Journal Table ────────────────────────────────── */}
        <TableContainer
          sx={{
            border: '2px solid #333',
            maxHeight: 'calc(100vh - 200px)',
            '@media print': {
              maxHeight: 'none',
              overflow: 'visible',
            },
          }}
          data-testid={TESTIDS['personal-journal-table']}
        >
          <Table
            size="small"
            stickyHeader
            aria-label={`業務日誌 ${selectedUser.name} ${selectedYear}年${selectedMonth}月`}
            sx={{
              borderCollapse: 'collapse',
              '& td, & th': { border: CELL_BORDER },
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

        {/* Footer legend */}
        <Box
          sx={{
            mt: 1,
            p: 1,
            border: '1px solid #ccc',
            borderRadius: 0.5,
            bgcolor: '#fafafa',
            fontSize: 10,
            color: 'text.secondary',
          }}
        >
          <Typography variant="caption" component="p" sx={{ fontSize: 10 }}>
            活送迎→○ 家族の送迎→K（車使用→K 電車使用→D バス使用→B 徒歩→T）
          </Typography>
          <Typography variant="caption" component="p" sx={{ fontSize: 10 }}>
            他施設の送迎→他施設の名前 ショートステイ時→SS（明けも書く） 一時ケア→一時ケア
          </Typography>
          <Typography variant="caption" component="p" sx={{ fontSize: 10 }}>
            ※その他遅刻・早退などあったら送迎場所や理由も書く。
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }} data-print="hide">
          ※ 現在はモックデータを表示しています
        </Typography>


      </Box>
    </Container>
    </>
  );
}
