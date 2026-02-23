import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  Button,
  Card,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearAllIcon from '@mui/icons-material/ClearAll';

export interface Reservation {
  id: number;
  room: string;
  slot: 'AM' | 'PM';
  group: string;
  detail: string;
}

const ROOMS = ['プレイルーム', '和室（中）', '和室（小）'];
const SLOTS = ['AM', 'PM'];
const GROUPS = ['生活支援', 'さつき会', 'リバティ', '日中', '会議', '来客', 'その他'];

export const RoomStatusTab: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([
    { id: 1, room: 'プレイルーム', slot: 'AM', group: '生活支援', detail: '09:30~' },
    { id: 2, room: '和室（中）', slot: 'PM', group: '会議', detail: '14:00~' },
  ]);

  const [room, setRoom] = useState('プレイルーム');
  const [slot, setSlot] = useState<'AM' | 'PM'>('AM');
  const [group, setGroup] = useState('生活支援');
  const [detail, setDetail] = useState('');
  const [openClearDialog, setOpenClearDialog] = useState(false);

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = reservations.findIndex(res => res.room === room && res.slot === slot);
    
    const newRes: Reservation = {
      id: Date.now(),
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
  };

  const handleDeleteReservation = (id: number) => {
    setReservations(reservations.filter(res => res.id !== id));
  };

  const handleClearAll = () => {
    setReservations([]);
    setOpenClearDialog(false);
  };

  const isOccupied = (roomName: string, roomSlot: 'AM' | 'PM') => {
    return reservations.some(res => res.room === roomName && res.slot === roomSlot);
  };

  const today = new Date();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          {today.getMonth() + 1}/{today.getDate()} 部屋状況
        </Typography>
        <Button
          size="small"
          startIcon={<ClearAllIcon />}
          color="error"
          onClick={() => setOpenClearDialog(true)}
          sx={{ fontSize: '0.75rem' }}
        >
          全消去
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
        {/* Left: Table & Details */}
        <Box>
          {/* Table */}
          <Card sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f3f4f6' }}>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#4b5563' }}>部屋名</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#4b5563' }}>AM</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#4b5563' }}>PM</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ROOMS.map(roomName => (
                    <TableRow key={roomName} hover>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f9fafb' }}>
                        {roomName}
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
                            }}
                          >
                            {occupied ? '○' : '空'}
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
          <Card>
            <CardContent>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5, pb: 1, borderBottom: '1px solid #e5e7eb' }}>
                利用詳細
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                {reservations.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', gridColumn: '1/-1' }}>
                    予約なし
                  </Typography>
                ) : (
                  reservations
                    .sort((a, b) => a.slot.localeCompare(b.slot))
                    .map(res => (
                      <Box
                        key={res.id}
                        sx={{
                          p: 1.5,
                          bgcolor: '#f9fafb',
                          border: '1px solid #f3f4f6',
                          borderRadius: 1,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 1,
                        }}
                      >
                        <Typography variant="caption" sx={{ flex: 1 }}>
                          <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>
                            {res.slot}
                          </span>{' '}
                          <span style={{ fontWeight: 'bold' }}>{res.room[0]}</span>
                          {': '}
                          <span style={{ color: '#4b5563' }}>
                            [{res.group}] {res.detail}
                          </span>
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteReservation(res.id)}
                          sx={{ color: '#d1d5db', '&:hover': { color: '#ef4444' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right: Form */}
        <Box>
          <Card sx={{ position: 'sticky', top: 16 }}>
            <CardContent>
              <Typography
                variant="subtitle2"
                fontWeight="bold"
                sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
              >
                <span style={{ marginRight: 4 }}>＋</span>予約更新
              </Typography>
              <Box component="form" onSubmit={handleAddReservation} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ bgcolor: '#f9fafb' }}
                  >
                    {ROOMS.map(r => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </Select>
                  <Select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value as 'AM' | 'PM')}
                    size="small"
                    sx={{ width: '60px', bgcolor: '#f9fafb' }}
                  >
                    <MenuItem value="AM">AM</MenuItem>
                    <MenuItem value="PM">PM</MenuItem>
                  </Select>
                </Box>

                <Select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ bgcolor: '#f9fafb' }}
                >
                  {GROUPS.map(g => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </Select>

                <TextField
                  placeholder="例: 10:00~ 利用内容"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ bgcolor: '#f9fafb' }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{
                    bgcolor: '#4f46e5',
                    fontWeight: 'bold',
                    py: 1.2,
                    '&:hover': { bgcolor: '#4338ca' },
                  }}
                >
                  更新
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Clear Confirmation Dialog */}
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
