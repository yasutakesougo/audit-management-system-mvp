import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';

export interface RoomStatus {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'reserved';
  currentUser?: string;
  nextReservation?: {
    time: string;
    user: string;
  };
}

export interface RoomStatusTabProps {
  rooms: RoomStatus[];
}

/**
 * 空き室情報タブ
 * 各部屋の使用状況をリアルタイムで表示
 */
export const RoomStatusTab: React.FC<RoomStatusTabProps> = ({ rooms }) => {
  const availableRooms = rooms.filter(r => r.status === 'available');
  const occupiedRooms = rooms.filter(r => r.status === 'occupied');
  const reservedRooms = rooms.filter(r => r.status === 'reserved');

  const getStatusColor = (status: RoomStatus['status']) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'occupied':
        return 'error';
      case 'reserved':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: RoomStatus['status']) => {
    switch (status) {
      case 'available':
        return '空室';
      case 'occupied':
        return '使用中';
      case 'reserved':
        return '予約済';
      default:
        return '不明';
    }
  };

  const getStatusIcon = (status: RoomStatus['status']) => {
    switch (status) {
      case 'available':
        return <CheckCircleIcon fontSize="small" />;
      case 'occupied':
      case 'reserved':
        return <EventBusyIcon fontSize="small" />;
      default:
        return null;
    }
  };

  if (rooms.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          color: 'text.secondary',
        }}
      >
        <MeetingRoomIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography>部屋情報がありません</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* サマリー */}
      <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Stack direction="row" spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              空室
            </Typography>
            <Typography variant="h6" color="success.main">
              {availableRooms.length}室
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              使用中
            </Typography>
            <Typography variant="h6" color="error.main">
              {occupiedRooms.length}室
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              予約済
            </Typography>
            <Typography variant="h6" color="warning.main">
              {reservedRooms.length}室
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* 部屋一覧 */}
      <List sx={{ py: 0 }}>
        {rooms.map((room) => (
          <ListItem
            key={room.id}
            disablePadding
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <ListItemButton
              sx={{
                py: 1.5,
                px: 2,
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'translateX(4px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <MeetingRoomIcon fontSize="small" color="action" />
                    <Typography variant="body1" fontWeight="medium">
                      {room.name}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(room.status)}
                      label={getStatusLabel(room.status)}
                      color={getStatusColor(room.status)}
                      size="small"
                      sx={{ ml: 'auto' }}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    {room.currentUser && (
                      <Typography variant="body2" color="text.secondary">
                        利用者: {room.currentUser}
                      </Typography>
                    )}
                    {room.nextReservation && (
                      <Typography variant="body2" color="text.secondary">
                        次の予約: {room.nextReservation.time} - {room.nextReservation.user}
                      </Typography>
                    )}
                    {room.status === 'available' && !room.nextReservation && (
                      <Typography variant="body2" color="success.main">
                        すぐに利用可能
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
