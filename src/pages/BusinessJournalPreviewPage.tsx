/**
 * Business Journal Preview Page (業務日誌プレビュー)
 *
 * Displays daily records in a monthly grid format aligned with the legacy
 * Excel business journal (業務日誌01.07.19.xlsx).
 *
 * Layout: rows = users (~30), columns = dates (1-31)
 * Each cell shows a compact summary of attendance, meals, activities, and flags.
 */
import type { MealAmount } from '@/domain/daily/types';
import { TESTIDS } from '@/testids';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';
import { Link } from 'react-router-dom';

// ── Types ───────────────────────────────────────────────────────────────────

type AttendanceStatus = '出席' | '欠席' | '遅刻' | '早退' | '休日';

interface JournalDayEntry {
  date: string; // YYYY-MM-DD
  attendance: AttendanceStatus;
  mealAmount?: MealAmount;
  amActivities: string[];
  pmActivities: string[];
  restraint?: boolean;
  selfHarm?: boolean;
  otherInjury?: boolean;
  specialNotes?: string;
  hasAttachment?: boolean;
}

interface JournalUserRow {
  userId: string;
  displayName: string;
  entries: JournalDayEntry[];
}

// ── Mock Data Generator ─────────────────────────────────────────────────────

const MOCK_USERS = [
  { userId: 'U001', displayName: '田中 太郎' },
  { userId: 'U002', displayName: '鈴木 花子' },
  { userId: 'U003', displayName: '佐藤 一郎' },
  { userId: 'U004', displayName: '高橋 美咲' },
  { userId: 'U005', displayName: '山田 健二' },
  { userId: 'U006', displayName: '渡辺 愛子' },
  { userId: 'U007', displayName: '伊藤 誠' },
  { userId: 'U008', displayName: '中村 さくら' },
  { userId: 'U009', displayName: '小林 大輔' },
  { userId: 'U010', displayName: '加藤 由美' },
] as const;

const MEAL_OPTIONS: MealAmount[] = ['完食', '多め', '半分', '少なめ', 'なし'];
const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['出席', '出席', '出席', '出席', '欠席', '遅刻'];
const AM_ACTIVITIES = ['軽作業', 'ストレッチ', '創作活動', '清掃活動', '園芸', '調理実習'];
const PM_ACTIVITIES = ['レクリエーション', '個別支援', '散歩', '音楽活動', 'PC作業', '読書'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function generateMockData(year: number, month: number): JournalUserRow[] {
  const days = getDaysInMonth(year, month);
  const rand = seededRandom(year * 100 + month);

  return MOCK_USERS.map((user) => {
    const entries: JournalDayEntry[] = [];
    for (let d = 1; d <= days; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();

      // Weekend = holiday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        entries.push({
          date,
          attendance: '休日',
          amActivities: [],
          pmActivities: [],
        });
        continue;
      }

      const attendance = ATTENDANCE_OPTIONS[Math.floor(rand() * ATTENDANCE_OPTIONS.length)];

      if (attendance === '欠席') {
        entries.push({
          date,
          attendance,
          amActivities: [],
          pmActivities: [],
        });
        continue;
      }

      entries.push({
        date,
        attendance,
        mealAmount: MEAL_OPTIONS[Math.floor(rand() * MEAL_OPTIONS.length)],
        amActivities: [AM_ACTIVITIES[Math.floor(rand() * AM_ACTIVITIES.length)]],
        pmActivities: [PM_ACTIVITIES[Math.floor(rand() * PM_ACTIVITIES.length)]],
        restraint: rand() < 0.03,
        selfHarm: rand() < 0.05,
        otherInjury: rand() < 0.04,
        specialNotes: rand() < 0.15 ? '体調変化あり。詳細は別紙参照。' : undefined,
        hasAttachment: rand() < 0.08,
      });
    }
    return { ...user, entries };
  });
}

// ── UI Helpers ──────────────────────────────────────────────────────────────

const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  出席: '#4caf50',
  欠席: '#f44336',
  遅刻: '#ff9800',
  早退: '#ff9800',
  休日: '#9e9e9e',
};

const MEAL_SHORT: Record<MealAmount, string> = {
  完食: '◎',
  多め: '○',
  半分: '△',
  少なめ: '▽',
  なし: '×',
};

function CellContent({ entry }: { entry: JournalDayEntry }) {
  if (entry.attendance === '休日') {
    return (
      <Box sx={{ textAlign: 'center', color: 'text.disabled', fontSize: 10 }}>
        —
      </Box>
    );
  }

  if (entry.attendance === '欠席') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: ATTENDANCE_COLORS['欠席'],
            lineHeight: '16px',
            fontSize: 9,
            color: '#fff',
            fontWeight: 700,
          }}
        >
          欠
        </Box>
      </Box>
    );
  }

  const hasFlags = entry.restraint || entry.selfHarm || entry.otherInjury;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
      {/* Attendance badge */}
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          bgcolor: ATTENDANCE_COLORS[entry.attendance],
          lineHeight: '14px',
          fontSize: 8,
          color: '#fff',
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {entry.attendance === '遅刻' ? '遅' : entry.attendance === '早退' ? '早' : '◯'}
      </Box>

      {/* Meal indicator */}
      {entry.mealAmount && (
        <Box sx={{ fontSize: 9, lineHeight: 1, color: 'text.secondary' }}>
          {MEAL_SHORT[entry.mealAmount]}
        </Box>
      )}

      {/* Flag icons row */}
      {(hasFlags || entry.hasAttachment || entry.specialNotes) && (
        <Box sx={{ display: 'flex', gap: '1px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {entry.restraint && (
            <Box component="span" sx={{ fontSize: 8, color: 'error.main', fontWeight: 700 }}>拘</Box>
          )}
          {(entry.selfHarm || entry.otherInjury) && (
            <WarningAmberIcon sx={{ fontSize: 10, color: 'warning.main' }} />
          )}
          {entry.hasAttachment && (
            <AttachFileIcon sx={{ fontSize: 10, color: 'info.main' }} />
          )}
          {entry.specialNotes && (
            <Box component="span" sx={{ fontSize: 8, color: 'info.main' }}>📝</Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Detail Dialog ───────────────────────────────────────────────────────────

interface DetailDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
  entry: JournalDayEntry | null;
  /** YYYY-MM for deep-link */
  monthValue: string;
}

function DetailDialog({ open, onClose, userName, userId, entry, monthValue }: DetailDialogProps) {
  if (!entry) return null;

  const personalJournalUrl = `/records/journal/personal?user=${encodeURIComponent(userId)}&month=${encodeURIComponent(monthValue)}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid={TESTIDS['journal-preview-detail-dialog']}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="span">
          {userName} — {entry.date}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">出欠</Typography>
            <Chip
              label={entry.attendance}
              size="small"
              sx={{ bgcolor: ATTENDANCE_COLORS[entry.attendance], color: '#fff', fontWeight: 600 }}
            />
          </Box>

          {entry.mealAmount && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">食事</Typography>
              <Typography>{entry.mealAmount}</Typography>
            </Box>
          )}

          {entry.amActivities.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">AM作業</Typography>
              <Typography>{entry.amActivities.join('、')}</Typography>
            </Box>
          )}

          {entry.pmActivities.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">PM作業</Typography>
              <Typography>{entry.pmActivities.join('、')}</Typography>
            </Box>
          )}

          {/* Compliance flags */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">法的記録</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Chip
                label="拘束"
                size="small"
                color={entry.restraint ? 'error' : 'default'}
                variant={entry.restraint ? 'filled' : 'outlined'}
              />
              <Chip
                label="自傷"
                size="small"
                color={entry.selfHarm ? 'warning' : 'default'}
                variant={entry.selfHarm ? 'filled' : 'outlined'}
              />
              <Chip
                label="他傷"
                size="small"
                color={entry.otherInjury ? 'warning' : 'default'}
                variant={entry.otherInjury ? 'filled' : 'outlined'}
              />
              <Chip
                label="別紙"
                size="small"
                color={entry.hasAttachment ? 'info' : 'default'}
                variant={entry.hasAttachment ? 'filled' : 'outlined'}
              />
            </Stack>
          </Box>

          {entry.specialNotes && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">様子・特記</Typography>
              <Typography variant="body2">{entry.specialNotes}</Typography>
            </Box>
          )}

          {/* Navigation to personal journal */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              component={Link}
              to={personalJournalUrl}
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              fullWidth
              data-testid="journal-detail-personal-link"
            >
              👤 この利用者の月次ページを開く（印刷）
            </Button>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function BusinessJournalPreviewPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(now.getMonth() + 1);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState('');
  const [dialogUserId, setDialogUserId] = React.useState('');
  const [selectedEntry, setSelectedEntry] = React.useState<JournalDayEntry | null>(null);

  const data = React.useMemo(
    () => generateMockData(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Generate month options (current month ± 6 months)
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

  const handleCellClick = (userId: string, displayName: string, entry: JournalDayEntry) => {
    if (entry.attendance === '休日') return;
    setSelectedUser(displayName);
    setDialogUserId(userId);
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  // Day-of-week header colors
  const getDayColor = (day: number): string => {
    const dow = new Date(selectedYear, selectedMonth - 1, day).getDay();
    if (dow === 0) return '#f44336'; // Sunday
    if (dow === 6) return '#2196f3'; // Saturday
    return 'inherit';
  };

  const getDayLabel = (day: number): string => {
    const labels = ['日', '月', '火', '水', '木', '金', '土'];
    const dow = new Date(selectedYear, selectedMonth - 1, day).getDay();
    return labels[dow];
  };

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1, md: 2 } }} data-testid={TESTIDS['journal-preview-page']}>
      <Box sx={{ py: 2 }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            業務日誌プレビュー
          </Typography>
          <Typography variant="body2" color="text.secondary">
            紙の業務日誌と同等のレイアウトで月間の日次記録を一覧表示します
          </Typography>
        </Box>

        {/* Month selector */}
        <Box sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="対象月"
            value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
            onChange={(e) => handleMonthChange(e.target.value)}
            data-testid={TESTIDS['journal-preview-month-select']}
            sx={{ minWidth: 180 }}
          >
            {monthOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Legend */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">凡例:</Typography>
          {(Object.entries(ATTENDANCE_COLORS) as [AttendanceStatus, string][]).map(([label, color]) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
              <Typography variant="caption">{label}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption">食事: ◎完食 ○多め △半分 ▽少なめ ×なし</Typography>
          </Box>
        </Box>

        {/* Monthly Grid Table */}
        <TableContainer
          sx={{
            maxHeight: 'calc(100vh - 260px)',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
          data-testid={TESTIDS['journal-preview-grid']}
        >
          <Table size="small" stickyHeader aria-label="業務日誌月間グリッド">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    bgcolor: 'background.paper',
                    minWidth: 100,
                    fontWeight: 700,
                    borderRight: 1,
                    borderColor: 'divider',
                  }}
                >
                  利用者名
                </TableCell>
                {dayHeaders.map((day) => (
                  <TableCell
                    key={day}
                    align="center"
                    sx={{
                      minWidth: 44,
                      maxWidth: 44,
                      px: 0.5,
                      py: 0.5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: getDayColor(day),
                      borderBottom: 2,
                      borderColor: 'divider',
                    }}
                  >
                    <Box>{day}</Box>
                    <Box sx={{ fontSize: 9, opacity: 0.7 }}>{getDayLabel(day)}</Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.userId} hover>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      bgcolor: 'background.paper',
                      fontWeight: 600,
                      fontSize: 12,
                      borderRight: 1,
                      borderColor: 'divider',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Link
                      to={`/records/journal/personal?user=${encodeURIComponent(row.userId)}&month=${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
                      style={{ color: '#1565c0', textDecoration: 'none' }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                      data-testid="journal-user-link"
                    >
                      {row.displayName}
                    </Link>
                  </TableCell>
                  {row.entries.map((entry, idx) => {
                    const isWeekend = entry.attendance === '休日';
                    const tooltipLines: string[] = [];
                    if (entry.attendance !== '休日') {
                      tooltipLines.push(`出欠: ${entry.attendance}`);
                      if (entry.mealAmount) tooltipLines.push(`食事: ${entry.mealAmount}`);
                      if (entry.amActivities.length) tooltipLines.push(`AM: ${entry.amActivities.join(', ')}`);
                      if (entry.pmActivities.length) tooltipLines.push(`PM: ${entry.pmActivities.join(', ')}`);
                      if (entry.specialNotes) tooltipLines.push(`特記: ${entry.specialNotes}`);
                    }

                    return (
                      <TableCell
                        key={idx}
                        align="center"
                        data-testid={TESTIDS['journal-preview-cell']}
                        onClick={() => handleCellClick(row.userId, row.displayName, entry)}
                        sx={{
                          px: 0.25,
                          py: 0.5,
                          cursor: isWeekend ? 'default' : 'pointer',
                          bgcolor: isWeekend ? 'action.hover' : undefined,
                          '&:hover': isWeekend
                            ? undefined
                            : { bgcolor: 'action.selected' },
                          minWidth: 44,
                          maxWidth: 44,
                          borderRight: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {tooltipLines.length > 0 ? (
                          <Tooltip
                            title={tooltipLines.map((line, i) => (
                              <Box key={i} sx={{ fontSize: 11 }}>{line}</Box>
                            ))}
                            placement="top"
                            arrow
                          >
                            <Box>
                              <CellContent entry={entry} />
                            </Box>
                          </Tooltip>
                        ) : (
                          <CellContent entry={entry} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Summary footer */}
        <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            利用者数: <strong>{data.length}</strong>名
          </Typography>
          <Typography variant="body2" color="text.secondary">
            表示月: <strong>{selectedYear}年{selectedMonth}月</strong>（{daysInMonth}日間）
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            ※ 現在はモックデータを表示しています
          </Typography>
        </Box>
      </Box>

      {/* Detail Dialog */}
      <DetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userName={selectedUser}
        userId={dialogUserId}
        entry={selectedEntry}
        monthValue={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
      />
    </Container>
  );
}
