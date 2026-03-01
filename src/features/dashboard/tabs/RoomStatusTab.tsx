import ClearAllIcon from '@mui/icons-material/ClearAll';
import DeleteIcon from '@mui/icons-material/Delete';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';

export interface Reservation {
  id: number;
  date: string;
  room: string;
  slot: 'AM' | 'PM';
  group: string;
  detail: string;
}

const ROOMS = ['プレイルーム', '和室（中）', '和室（小）'];
const SLOTS = ['AM', 'PM'];
const GROUPS = ['生活支援', 'さつき会', 'リバティ', '日中', '会議', '来客', 'その他'];

// グループごとのカラーマッピング
const GROUP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '生活支援': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  'さつき会': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'リバティ': { bg: '#ede9fe', text: '#5b21b6', border: '#d8b4fe' },
  '日中': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  '会議': { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  '来客': { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' },
  'その他': { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
};

// 部屋名を短縮表示
const getRoomAbbr = (room: string): string => {
  const map: Record<string, string> = {
    'プレイルーム': 'プ',
    '和室（中）': '和',
    '和室（小）': '小',
  };
  return map[room] || room[0];
};

// 日付を YYYY-MM-DD 形式で取得
const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const RoomStatusTab: React.FC = () => {
  const theme = useTheme();
  const today = new Date();
  const todayStr = getDateString(today);

  const [reservations, setReservations] = useState<Reservation[]>([
    { id: 1, date: todayStr, room: 'プレイルーム', slot: 'AM', group: '生活支援', detail: '09:30~' },
    { id: 2, date: todayStr, room: '和室（中）', slot: 'PM', group: '会議', detail: '14:00~' },
  ]);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<'today' | 'month'>('today');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const [room, setRoom] = useState('プレイルーム');
  const [slot, setSlot] = useState<'AM' | 'PM'>('AM');
  const [group, setGroup] = useState('生活支援');
  const [detail, setDetail] = useState('');
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // 選択日付の予約をフィルタ
  const filteredReservations = useMemo(
    () => reservations.filter(res => res.date === selectedDate),
    [reservations, selectedDate]
  );

  const isOccupied = (roomName: string, roomSlot: 'AM' | 'PM', date?: string) => {
    const checkDate = date || selectedDate;
    return reservations.some(res => res.date === checkDate && res.room === roomName && res.slot === roomSlot);
  };

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = reservations.findIndex(
      res => res.date === selectedDate && res.room === room && res.slot === slot
    );

    const newRes: Reservation = {
      id: Date.now(),
      date: selectedDate,
      room,
      slot,
      group,
      detail: detail || '-',
    };

    if (idx > -1) {
      const updated = [...reservations];
      updated[idx] = newRes;
      setReservations(updated);
    } else {
      setReservations([...reservations, newRes]);
    }

    setDetail('');

    // Success feedback
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 1800);
  };

  const handleDeleteReservation = (id: number) => {
    setReservations(reservations.filter(res => res.id !== id));
  };

  const handleClearAll = () => {
    setReservations([]);
    setOpenClearDialog(false);
  };

  const handleChangeMonth = (delta: number) => {
    if (delta === 0) {
      setCurrentMonthDate(new Date());
    } else {
      const newDate = new Date(currentMonthDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCurrentMonthDate(newDate);
    }
  };

  const formatDateDisplay = (date: string) => {
    const d = new Date(date);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  // カレンダーレンダリング
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days: Array<{ date: string; day: number } | null> = [];
    // 前月の空き枠
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 当月の日付
    for (let day = 1; day <= lastDate; day++) {
      days.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
      });
    }
    return days;
  }, [currentMonthDate]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#1f2937' }}>
          <span>🏢</span>
          施設予約管理
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
            v2.0 Compact-Sync
          </Typography>
          <Button
            size="small"
            startIcon={<ClearAllIcon />}
            color="error"
            onClick={() => setOpenClearDialog(true)}
            sx={{ fontSize: '0.75rem' }}
          >
            全データ初期化
          </Button>
        </Box>
      </Box>

      {/* Tab Navigation */}
      <Box
        sx={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          mb: 4,
          gap: 0,
          bgcolor: 'white',
          borderRadius: '8px 8px 0 0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Button
          onClick={() => setActiveTab('today')}
          sx={{
            flex: 1,
            fontSize: '0.95rem',
            fontWeight: activeTab === 'today' ? '900' : '600',
            color: activeTab === 'today' ? theme.palette.primary.dark : '#9ca3af',
            borderBottom: activeTab === 'today' ? `3px solid ${theme.palette.primary.dark}` : 'none',
            borderRadius: 0,
            textTransform: 'none',
            py: 2.5,
            '&:hover': { bgcolor: '#f9fafb', color: theme.palette.primary.dark },
            background: activeTab === 'today' ? theme.palette.primary.light : 'transparent',
          }}
        >
          📅 本日の状況
        </Button>
        <Button
          onClick={() => setActiveTab('month')}
          sx={{
            flex: 1,
            fontSize: '0.95rem',
            fontWeight: activeTab === 'month' ? '900' : '600',
            color: activeTab === 'month' ? theme.palette.primary.dark : '#9ca3af',
            borderBottom: activeTab === 'month' ? `3px solid ${theme.palette.primary.dark}` : 'none',
            borderRadius: 0,
            textTransform: 'none',
            py: 2.5,
            '&:hover': { bgcolor: '#f9fafb', color: theme.palette.primary.dark },
            background: activeTab === 'month' ? theme.palette.primary.light : 'transparent',
          }}
        >
          🗓️ 月間スケジュール
        </Button>
      </Box>

      {/* Today View */}
      {activeTab === 'today' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
          {/* Left: Status Table & Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Status Table */}
            <Card sx={{ overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
              <Box sx={{ bgcolor: theme.palette.primary.dark, p: 2, color: 'white', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>📍</span>
                  <span>{formatDateDisplay(selectedDate)}</span>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '9px', opacity: 0.9, fontFamily: 'monospace', letterSpacing: '1px' }}>
                  ROOM AVAILABILITY
                </Typography>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f3f4f6' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', pl: 3 }}>
                        部屋名
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        AM (午前)
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        PM (午後)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ROOMS.map(roomName => (
                      <TableRow key={roomName} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafbfc', fontSize: '13px', pl: 3 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <span>{getRoomAbbr(roomName)}</span>
                            <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'normal' }}>
                              {roomName}
                            </span>
                          </Box>
                        </TableCell>
                        {SLOTS.map(roomSlot => {
                          const occupied = isOccupied(roomName, roomSlot as 'AM' | 'PM');
                          return (
                            <TableCell
                              key={`${roomName}-${roomSlot}`}
                              align="center"
                              sx={{
                                fontWeight: 'bold',
                                color: occupied ? '#dc2626' : '#059669',
                                fontSize: '12px',
                                py: 2,
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <span>{occupied ? '● 予約あり' : '○ 空室'}</span>
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Card>

            {/* Details */}
            <Card sx={{ borderLeft: `4px solid ${theme.palette.primary.dark}`, boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: '1px solid #e5e7eb' }}>
                  <Typography variant="h6" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#1f2937' }}>
                    <span>📋</span> 予約詳細リスト
                  </Typography>
                  <Box sx={{ bgcolor: '#f3f4f6', px: 1.5, py: 0.5, borderRadius: '4px', fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                    {selectedDate === todayStr ? 'TODAY' : `📅 ${selectedDate}`}
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, minHeight: '100px' }}>
                  {filteredReservations.length === 0 ? (
                    <Box
                      sx={{
                        gridColumn: '1/-1',
                        py: 6,
                        textAlign: 'center',
                        bgcolor: '#f9fafb',
                        border: '2px dashed #e5e7eb',
                        borderRadius: '8px',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '12px' }}>
                        この日の予約詳細は登録されていません
                      </Typography>
                    </Box>
                  ) : (
                    filteredReservations
                      .sort((a, b) => a.slot.localeCompare(b.slot))
                      .map(res => {
                        const groupColor = GROUP_COLORS[res.group];
                        return (
                          <Box
                            key={res.id}
                            onClick={() => {
                              if (window.confirm('この予約を削除しますか？')) {
                                handleDeleteReservation(res.id);
                              }
                            }}
                            sx={{
                              p: 2,
                              bgcolor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 2,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              overflow: 'hidden',
                              '&:hover': {
                                borderColor: '#f87171',
                                boxShadow: '0 0 0 2px rgba(244, 63, 94, 0.05)',
                                bgcolor: '#fef2f2',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
                              <Box sx={{ bgcolor: theme.palette.primary.light, borderRadius: '6px', px: 1.5, py: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '44px' }}>
                                <Typography variant="caption" sx={{ fontWeight: '900', color: theme.palette.primary.dark, fontSize: '10px' }}>
                                  {res.slot}
                                </Typography>
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1f2937', fontSize: '12px' }}>
                                    {res.room}
                                  </Typography>
                                  <Chip
                                    label={res.group}
                                    size="small"
                                    sx={{
                                      height: '20px',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      bgcolor: groupColor.bg,
                                      color: groupColor.text,
                                      border: `1px solid ${groupColor.border}`,
                                    }}
                                  />
                                </Box>
                                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                  {res.detail}
                                </Typography>
                              </Box>
                            </Box>
                            <Box
                              sx={{
                                color: '#d1d5db',
                                transition: 'all 0.2s ease',
                                '&:hover': { color: '#ef4444' },
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 24,
                                height: 24,
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </Box>
                          </Box>
                        );
                      })
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Right: Form */}
          <Box>
            <Card sx={{ position: 'sticky', top: 16, borderTop: `4px solid ${theme.palette.primary.dark}`, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="900" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: '#1f2937' }}>
                  <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.dark, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                    ＋
                  </Box>
                  予約の登録・更新
                </Typography>
                <Box component="form" onSubmit={handleAddReservation} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
                      利用日
                    </Typography>
                    <TextField
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{
                        bgcolor: '#f9fafb',
                        '& .MuiOutlinedInput-root': {
                          fontSize: '13px',
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
                      部屋
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                      <Select
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{ bgcolor: '#f9fafb', fontSize: '13px' }}
                      >
                        {ROOMS.map(r => (
                          <MenuItem key={r} value={r}>{r}</MenuItem>
                        ))}
                      </Select>
                      <Select
                        value={slot}
                        onChange={(e) => setSlot(e.target.value as 'AM' | 'PM')}
                        size="small"
                        fullWidth
                        sx={{ bgcolor: '#f9fafb', fontSize: '13px' }}
                      >
                        <MenuItem value="AM">AM</MenuItem>
                        <MenuItem value="PM">PM</MenuItem>
                      </Select>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
                      利用グループ
                    </Typography>
                    <Select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{ bgcolor: '#f9fafb', fontSize: '13px' }}
                    >
                      {GROUPS.map(g => (
                        <MenuItem key={g} value={g}>{g}</MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
                      詳細・時刻
                    </Typography>
                    <TextField
                      placeholder="例: 10:00〜11:30 定例会議"
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{
                        bgcolor: '#f9fafb',
                        '& .MuiOutlinedInput-root': {
                          fontSize: '13px',
                        },
                      }}
                    />
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{
                      bgcolor: submitSuccess ? theme.palette.success.main : theme.palette.primary.dark,
                      fontWeight: 'bold',
                      py: 1.8,
                      fontSize: '13px',
                      borderRadius: '6px',
                      '&:hover': { bgcolor: submitSuccess ? theme.palette.success.dark : theme.palette.primary.main },
                      transition: 'all 0.3s ease',
                      boxShadow: submitSuccess ? `0 4px 6px ${alpha(theme.palette.success.main, 0.3)}` : `0 4px 6px ${alpha(theme.palette.primary.dark, 0.3)}`,
                    }}
                  >
                    {submitSuccess ? '✅ 保存完了しました' : 'この内容で保存する'}
                  </Button>
                </Box>

                <Box sx={{ mt: 4, p: 2, bgcolor: theme.palette.primary.light, borderRadius: '6px', border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                  <Typography variant="caption" sx={{ color: theme.palette.primary.dark, fontSize: '11px', lineHeight: 1.6, display: 'block' }}>
                    💡 カレンダーの日付をクリックすると、その日の予定を素早く表示・編集できます。
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Month View */}
      {activeTab === 'month' && (
        <Card sx={{ boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
          <CardContent>
            {/* Month Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h5" fontWeight="900" sx={{ color: '#1f2937' }}>
                {currentMonthDate.getFullYear()}年 {currentMonthDate.getMonth() + 1}月
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f3f4f6', p: 0.5, borderRadius: '8px' }}>
                <IconButton
                  size="small"
                  onClick={() => handleChangeMonth(-1)}
                  sx={{
                    bgcolor: 'white',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    '&:hover': { bgcolor: theme.palette.primary.light },
                    fontSize: '12px',
                  }}
                >
                  <NavigateBeforeIcon />{' '}
                  <span style={{ marginLeft: '4px', fontWeight: 'bold', fontSize: '11px' }}>前月</span>
                </IconButton>
                <Button
                  size="small"
                  onClick={() => handleChangeMonth(0)}
                  variant={
                    currentMonthDate.getFullYear() === today.getFullYear() &&
                    currentMonthDate.getMonth() === today.getMonth()
                      ? 'contained'
                      : 'text'
                  }
                  sx={{
                    bgcolor: currentMonthDate.getFullYear() === today.getFullYear() &&
                      currentMonthDate.getMonth() === today.getMonth()
                      ? theme.palette.primary.dark
                      : 'white',
                    color: currentMonthDate.getFullYear() === today.getFullYear() &&
                      currentMonthDate.getMonth() === today.getMonth()
                      ? 'white'
                      : theme.palette.primary.dark,
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'none',
                    boxShadow: currentMonthDate.getFullYear() === today.getFullYear() &&
                      currentMonthDate.getMonth() === today.getMonth()
                      ? `0 2px 4px ${alpha(theme.palette.primary.dark, 0.3)}`
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  今月
                </Button>
                <IconButton
                  size="small"
                  onClick={() => handleChangeMonth(1)}
                  sx={{
                    bgcolor: 'white',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    '&:hover': { bgcolor: theme.palette.primary.light },
                    fontSize: '12px',
                  }}
                >
                  <span style={{ marginRight: '4px', fontWeight: 'bold', fontSize: '11px' }}>翌月</span>
                  <NavigateNextIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Calendar Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              {/* Day Headers */}
              {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
                <Box
                  key={`header-${day}`}
                  sx={{
                    p: 1.5,
                    bgcolor: idx === 0 ? '#fef2f2' : idx === 6 ? theme.palette.primary.light : '#f3f4f6',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: idx === 0 ? '#dc2626' : idx === 6 ? theme.palette.primary.dark : '#374151',
                    borderRight: idx < 6 ? '1px solid #e5e7eb' : 'none',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {day}
                </Box>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((dayInfo, idx) =>
                dayInfo === null ? (
                  <Box key={`empty-${idx}`} sx={{ bgcolor: '#fafbfc', minHeight: '96px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }} />
                ) : (
                  <Box
                    key={dayInfo.date}
                    onClick={() => {
                      setSelectedDate(dayInfo.date);
                      setActiveTab('today');
                    }}
                    sx={{
                      p: 1,
                      bgcolor: dayInfo.date === todayStr ? theme.palette.primary.light : 'white',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      minHeight: '96px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      position: 'relative',
                      '&:hover': {
                        bgcolor: dayInfo.date !== todayStr ? '#f9fafb' : theme.palette.primary.light,
                        borderColor: theme.palette.primary.dark,
                        boxShadow: `inset 0 0 0 2px ${alpha(theme.palette.primary.dark, 0.2)}`,
                      },
                      ...(dayInfo.date === selectedDate && {
                        borderColor: theme.palette.primary.dark,
                        boxShadow: `inset 0 0 0 2px ${theme.palette.primary.dark}`,
                        bgcolor: theme.palette.primary.light,
                      }),
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 'bold',
                        mb: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        bgcolor: dayInfo.date === todayStr ? theme.palette.primary.dark : 'transparent',
                        color: dayInfo.date === todayStr ? 'white' : '#1f2937',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {dayInfo.day}
                    </Typography>
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, overflow: 'hidden' }}>
                      {reservations
                        .filter(res => res.date === dayInfo.date)
                        .slice(0, 3)
                        .map(res => {
                          const groupColor = GROUP_COLORS[res.group];
                          return (
                            <Box
                              key={res.id}
                              sx={{
                                fontSize: '8px',
                                p: '2px 3px',
                                borderRadius: '3px',
                                bgcolor: groupColor.bg,
                                color: groupColor.text,
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                border: `0.5px solid ${groupColor.border}`,
                              }}
                            >
                              <span style={{ opacity: 0.6 }}>{getRoomAbbr(res.room)}</span> {res.group}
                            </Box>
                          );
                        })}
                      {reservations.filter(res => res.date === dayInfo.date).length > 3 && (
                        <Typography variant="caption" sx={{ fontSize: '7px', color: '#9ca3af', textAlign: 'center', fontWeight: 'bold', mt: 'auto' }}>
                          ...他{reservations.filter(res => res.date === dayInfo.date).length - 3}件
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Clear Confirmation Dialog */}
      <Dialog open={openClearDialog} onClose={() => setOpenClearDialog(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '16px' }}>データ初期化の確認</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>すべての予約データ（過去・未来含む）をクリアします。よろしいですか？</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenClearDialog(false)} variant="outlined">
            キャンセル
          </Button>
          <Button onClick={handleClearAll} color="error" variant="contained">
            クリア
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
