import ClearAllIcon from '@mui/icons-material/ClearAll';
import DeleteIcon from '@mui/icons-material/Delete';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

import { RoomMonthCalendar } from './components/RoomMonthCalendar';
import { RoomReservationForm } from './components/RoomReservationForm';
import { useRoomReservations } from './hooks/useRoomReservations';
import { GROUP_COLORS, ROOMS, SLOTS, getRoomAbbr } from './roomStatusConstants';

export const RoomStatusTab: React.FC = () => {
  const theme = useTheme();
  const rs = useRoomReservations();

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
            onClick={() => rs.setOpenClearDialog(true)}
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
          onClick={() => rs.setActiveTab('today')}
          sx={{
            flex: 1,
            fontSize: '0.95rem',
            fontWeight: rs.activeTab === 'today' ? '900' : '600',
            color: rs.activeTab === 'today' ? theme.palette.primary.dark : '#9ca3af',
            borderBottom: rs.activeTab === 'today' ? `3px solid ${theme.palette.primary.dark}` : 'none',
            borderRadius: 0,
            textTransform: 'none',
            py: 2.5,
            '&:hover': { bgcolor: '#f9fafb', color: theme.palette.primary.dark },
            background: rs.activeTab === 'today' ? theme.palette.primary.light : 'transparent',
          }}
        >
          📅 本日の状況
        </Button>
        <Button
          onClick={() => rs.setActiveTab('month')}
          sx={{
            flex: 1,
            fontSize: '0.95rem',
            fontWeight: rs.activeTab === 'month' ? '900' : '600',
            color: rs.activeTab === 'month' ? theme.palette.primary.dark : '#9ca3af',
            borderBottom: rs.activeTab === 'month' ? `3px solid ${theme.palette.primary.dark}` : 'none',
            borderRadius: 0,
            textTransform: 'none',
            py: 2.5,
            '&:hover': { bgcolor: '#f9fafb', color: theme.palette.primary.dark },
            background: rs.activeTab === 'month' ? theme.palette.primary.light : 'transparent',
          }}
        >
          🗓️ 月間スケジュール
        </Button>
      </Box>

      {/* Today View */}
      {rs.activeTab === 'today' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
          {/* Left: Status Table & Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Status Table */}
            <Card sx={{ overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
              <Box sx={{ bgcolor: theme.palette.primary.dark, p: 2, color: 'white', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>📍</span>
                  <span>{rs.formatDateDisplay(rs.selectedDate)}</span>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '9px', opacity: 0.9, fontFamily: 'monospace', letterSpacing: '1px' }}>
                  ROOM AVAILABILITY
                </Typography>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f3f4f6' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', pl: 3 }}>部屋名</TableCell>
                      <TableCell align="center" sx={{ fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AM (午前)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PM (午後)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ROOMS.map(roomName => (
                      <TableRow key={roomName} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafbfc', fontSize: '13px', pl: 3 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <span>{getRoomAbbr(roomName)}</span>
                            <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'normal' }}>{roomName}</span>
                          </Box>
                        </TableCell>
                        {SLOTS.map(roomSlot => {
                          const occupied = rs.isOccupied(roomName, roomSlot as 'AM' | 'PM');
                          return (
                            <TableCell key={`${roomName}-${roomSlot}`} align="center" sx={{ fontWeight: 'bold', color: occupied ? '#dc2626' : '#059669', fontSize: '12px', py: 2 }}>
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
                    {rs.selectedDate === rs.todayStr ? 'TODAY' : `📅 ${rs.selectedDate}`}
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, minHeight: '100px' }}>
                  {rs.filteredReservations.length === 0 ? (
                    <Box sx={{ gridColumn: '1/-1', py: 6, textAlign: 'center', bgcolor: '#f9fafb', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
                      <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '12px' }}>
                        この日の予約詳細は登録されていません
                      </Typography>
                    </Box>
                  ) : (
                    rs.filteredReservations
                      .sort((a, b) => a.slot.localeCompare(b.slot))
                      .map(res => {
                        const groupColor = GROUP_COLORS[res.group];
                        return (
                          <Box
                            key={res.id}
                            onClick={() => {
                              if (window.confirm('この予約を削除しますか？')) {
                                rs.handleDeleteReservation(res.id);
                              }
                            }}
                            sx={{
                              p: 2, bgcolor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2,
                              cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden',
                              '&:hover': { borderColor: '#f87171', boxShadow: '0 0 0 2px rgba(244, 63, 94, 0.05)', bgcolor: '#fef2f2' },
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
                                  <Chip label={res.group} size="small" sx={{ height: '20px', fontSize: '10px', fontWeight: 'bold', bgcolor: groupColor.bg, color: groupColor.text, border: `1px solid ${groupColor.border}` }} />
                                </Box>
                                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                  {res.detail}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ color: '#d1d5db', transition: 'all 0.2s ease', '&:hover': { color: '#ef4444' }, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
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
            <RoomReservationForm
              selectedDate={rs.selectedDate}
              onSelectedDateChange={rs.setSelectedDate}
              room={rs.room}
              onRoomChange={rs.setRoom}
              slot={rs.slot}
              onSlotChange={rs.setSlot}
              group={rs.group}
              onGroupChange={rs.setGroup}
              detail={rs.detail}
              onDetailChange={rs.setDetail}
              submitSuccess={rs.submitSuccess}
              onSubmit={rs.handleAddReservation}
            />
          </Box>
        </Box>
      )}

      {/* Month View */}
      {rs.activeTab === 'month' && (
        <RoomMonthCalendar
          todayStr={rs.todayStr}
          today={rs.today}
          currentMonthDate={rs.currentMonthDate}
          selectedDate={rs.selectedDate}
          reservations={rs.reservations}
          calendarDays={rs.calendarDays}
          onSelectDate={(date) => {
            rs.setSelectedDate(date);
            rs.setActiveTab('today');
          }}
          onChangeMonth={rs.handleChangeMonth}
        />
      )}

      {/* Clear Confirmation Dialog */}
      <Dialog open={rs.openClearDialog} onClose={() => rs.setOpenClearDialog(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '16px' }}>データ初期化の確認</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>すべての予約データ（過去・未来含む）をクリアします。よろしいですか？</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => rs.setOpenClearDialog(false)} variant="outlined">キャンセル</Button>
          <Button onClick={rs.handleClearAll} color="error" variant="contained">クリア</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
