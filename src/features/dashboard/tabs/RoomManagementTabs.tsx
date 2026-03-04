import { motionTokens } from '@/app/theme';
import { RoomStatusTab } from '@/features/dashboard/tabs/RoomStatusTab';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    Typography
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';

interface Reservation {
  id: number;
  room: string;
  slot: 'AM' | 'PM';
  group: string;
  detail: string;
  date?: string;
}

const groupColors: Record<string, { bg: string; text: string }> = {
  生活支援: { bg: '#E8F0E4', text: '#3D6B3C' },
  さつき会: { bg: '#fef3c7', text: '#92400e' },
  リバティ: { bg: '#e0f2f1', text: '#00695c' },
  日中: { bg: '#d1fae5', text: '#065f46' },
  会議: { bg: '#f1f5f9', text: '#475569' },
  来客: { bg: '#ffedd5', text: '#9a3412' },
  その他: { bg: '#fce7f3', text: '#9d174d' },
};

export const RoomManagementTabs: React.FC = () => {
  const theme = useTheme();
  const [tab, setTab] = useState<number>(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([
    { id: 1, room: 'プレイルーム', slot: 'AM', group: '生活支援', detail: '09:30~' },
    { id: 2, room: '和室（中）', slot: 'PM', group: '会議', detail: '14:00~' },
  ]);
  const [openClearDialog, setOpenClearDialog] = useState(false);

  const handleDeleteReservation = (id: number) => {
    setReservations(reservations.filter(res => res.id !== id));
  };

  const handleClearAll = () => {
    setReservations([]);
    setOpenClearDialog(false);
  };

  // 月間カレンダーデータ生成
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days = [];
    // 前月の空白
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 当月の日付
    for (let i = 1; i <= lastDate; i++) {
      days.push(i);
    }
    return days;
  }, [currentMonth]);

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const currentMonthStr = currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

  return (
    <Box sx={{ width: '100%' }}>
      {/* タブ */}
      <Tabs
        value={tab}
        onChange={(_, newTab) => setTab(newTab)}
        sx={{
          borderBottom: '2px solid #e5e7eb',
          mb: 3,
          '& .MuiTab-root': {
            fontWeight: 'bold',
            fontSize: '0.95rem',
            textTransform: 'none',
            '&.Mui-selected': {
              color: theme.palette.primary.dark,
            },
          },
        }}
      >
        <Tab label="📋 本日の状況" value={0} />
        <Tab label="🗓️ 月間カレンダー" value={1} />
      </Tabs>

      {/* 本日ビュー */}
      {tab === 0 && <RoomStatusTab />}

      {/* 月間ビュー */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* ヘッダー */}
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight="bold">
                  {currentMonthStr}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    startIcon={<ChevronLeftIcon />}
                    onClick={previousMonth}
                    size="small"
                    variant="outlined"
                  >
                    前月
                  </Button>
                  <Button
                    onClick={() => setCurrentMonth(new Date())}
                    size="small"
                    variant="contained"
                  >
                    今月
                  </Button>
                  <Button
                    endIcon={<ChevronRightIcon />}
                    onClick={nextMonth}
                    size="small"
                    variant="outlined"
                  >
                    翌月
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ClearAllIcon />}
                    color="error"
                    onClick={() => setOpenClearDialog(true)}
                  >
                    全消去
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* カレンダーグリッド */}
          <Paper sx={{ overflow: 'hidden', boxShadow: 2 }}>
            {/* 曜日ヘッダー */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', bgcolor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
                <Box
                  key={day}
                  sx={{
                    p: 2,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    bgcolor: idx === 0 ? '#fee2e2' : idx === 6 ? alpha(theme.palette.primary.main, 0.1) : '#f9fafb',
                    color: idx === 0 ? '#dc2626' : idx === 6 ? theme.palette.primary.dark : '#4b5563',
                    borderRight: idx < 6 ? '1px solid #e5e7eb' : 'none',
                  }}
                >
                  {day}
                </Box>
              ))}
            </Box>

            {/* カレンダーセル */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', bgcolor: '#fff' }}>
              {daysInMonth.map((day, idx) => {
                const dateStr = day
                  ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : null;
                const dayReservations = dateStr
                  ? reservations.filter(() => {
                      const resDate = `${new Date().getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      return resDate === dateStr;
                    })
                  : [];

                const isToday = day === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();

                return (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      minHeight: '120px',
                      borderRight: idx % 7 !== 6 ? '1px solid #e5e7eb' : 'none',
                      borderBottom: '1px solid #e5e7eb',
                      bgcolor: day === null ? '#f9fafb' : isToday ? alpha(theme.palette.primary.main, 0.06) : '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      overflow: 'hidden',
                      transition: motionTokens.transition.bgColor,
                      '&:hover': day !== null ? { bgcolor: '#f3f4f6' } : {},
                    }}
                  >
                    {day && (
                      <>
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          sx={{
                            fontSize: '0.9rem',
                            color: isToday ? theme.palette.primary.dark : '#4b5563',
                            bgcolor: isToday ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                            display: 'inline-block',
                            px: 1,
                            py: 0.25,
                            borderRadius: '4px',
                            width: 'fit-content',
                          }}
                        >
                          {day}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          {dayReservations.slice(0, 3).map(res => (
                            <Box
                              key={res.id}
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                px: 1,
                                py: 0.375,
                                borderRadius: '3px',
                                bgcolor: groupColors[res.group]?.bg || '#f1f5f9',
                                color: groupColors[res.group]?.text || '#475569',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {res.slot} {res.room[0]} - {res.group}
                            </Box>
                          ))}
                          {dayReservations.length > 3 && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 'bold' }}>
                              他{dayReservations.length - 3}件
                            </Typography>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* 予約詳細表 */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                {currentMonthStr} の予約一覧
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f3f4f6' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>部屋</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="center">時間帯</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>グループ</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>詳細</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="center">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reservations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">予約がありません</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reservations.map(res => (
                        <TableRow key={res.id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>{res.room}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.primary.dark }}>{res.slot}</TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                display: 'inline-block',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                bgcolor: groupColors[res.group]?.bg,
                                color: groupColors[res.group]?.text,
                              }}
                            >
                              {res.group}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: '#6b7280' }}>{res.detail}</TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteReservation(res.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* クリア確認ダイアログ */}
      <Dialog open={openClearDialog} onClose={() => setOpenClearDialog(false)}>
        <DialogTitle>確認</DialogTitle>
        <DialogContent>
          <Typography>すべての予約をクリアしますか？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenClearDialog(false)}>キャンセル</Button>
          <Button onClick={handleClearAll} color="error" variant="contained">
            クリア
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoomManagementTabs;
