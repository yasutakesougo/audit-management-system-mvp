/**
 * RoomReservationForm — 予約登録フォーム
 *
 * RoomStatusTab から抽出 (#766)
 */
import {
    Box,
    Button,
    Card,
    CardContent,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { GROUPS, ROOMS } from '../roomStatusConstants';

export type RoomReservationFormProps = {
  selectedDate: string;
  onSelectedDateChange: (value: string) => void;
  room: string;
  onRoomChange: (value: string) => void;
  slot: 'AM' | 'PM';
  onSlotChange: (value: 'AM' | 'PM') => void;
  group: string;
  onGroupChange: (value: string) => void;
  detail: string;
  onDetailChange: (value: string) => void;
  submitSuccess: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export const RoomReservationForm: React.FC<RoomReservationFormProps> = ({
  selectedDate,
  onSelectedDateChange,
  room,
  onRoomChange,
  slot,
  onSlotChange,
  group,
  onGroupChange,
  detail,
  onDetailChange,
  submitSuccess,
  onSubmit,
}) => {
  const theme = useTheme();

  return (
    <Card sx={{ position: 'sticky', top: 16, borderTop: `4px solid ${theme.palette.primary.dark}`, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="900" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: '#1f2937' }}>
          <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.dark, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
            ＋
          </Box>
          予約の登録・更新
        </Typography>
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
              利用日
            </Typography>
            <TextField
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectedDateChange(e.target.value)}
              size="small"
              fullWidth
              sx={{ bgcolor: '#f9fafb', '& .MuiOutlinedInput-root': { fontSize: '13px' } }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
              部屋
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
              <Select value={room} onChange={(e) => onRoomChange(e.target.value)} size="small" fullWidth sx={{ bgcolor: '#f9fafb', fontSize: '13px' }}>
                {ROOMS.map(r => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
              <Select value={slot} onChange={(e) => onSlotChange(e.target.value as 'AM' | 'PM')} size="small" fullWidth sx={{ bgcolor: '#f9fafb', fontSize: '13px' }}>
                <MenuItem value="AM">AM</MenuItem>
                <MenuItem value="PM">PM</MenuItem>
              </Select>
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#4b5563', mb: 1, fontSize: '11px' }}>
              利用グループ
            </Typography>
            <Select value={group} onChange={(e) => onGroupChange(e.target.value)} size="small" fullWidth sx={{ bgcolor: '#f9fafb', fontSize: '13px' }}>
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
              onChange={(e) => onDetailChange(e.target.value)}
              size="small"
              fullWidth
              sx={{ bgcolor: '#f9fafb', '& .MuiOutlinedInput-root': { fontSize: '13px' } }}
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
  );
};
