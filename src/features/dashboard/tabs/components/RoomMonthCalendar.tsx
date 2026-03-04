/**
 * RoomMonthCalendar — 月間カレンダービュー
 *
 * RoomStatusTab から抽出 (#766)
 */
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import {
    Box,
    Button,
    Card,
    CardContent,
    IconButton,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import type { Reservation } from '../roomStatusConstants';
import { GROUP_COLORS, getRoomAbbr } from '../roomStatusConstants';

export type RoomMonthCalendarProps = {
  todayStr: string;
  today: Date;
  currentMonthDate: Date;
  selectedDate: string;
  reservations: Reservation[];
  calendarDays: Array<{ date: string; day: number } | null>;
  onSelectDate: (date: string) => void;
  onChangeMonth: (delta: number) => void;
};

export const RoomMonthCalendar: React.FC<RoomMonthCalendarProps> = ({
  todayStr,
  today,
  currentMonthDate,
  selectedDate,
  reservations,
  calendarDays,
  onSelectDate,
  onChangeMonth,
}) => {
  const theme = useTheme();
  const isCurrentMonth =
    currentMonthDate.getFullYear() === today.getFullYear() &&
    currentMonthDate.getMonth() === today.getMonth();

  return (
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
              onClick={() => onChangeMonth(-1)}
              sx={{ bgcolor: 'white', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', '&:hover': { bgcolor: theme.palette.primary.light }, fontSize: '12px' }}
            >
              <NavigateBeforeIcon />{' '}
              <span style={{ marginLeft: '4px', fontWeight: 'bold', fontSize: '11px' }}>前月</span>
            </IconButton>
            <Button
              size="small"
              onClick={() => onChangeMonth(0)}
              variant={isCurrentMonth ? 'contained' : 'text'}
              sx={{
                bgcolor: isCurrentMonth ? theme.palette.primary.dark : 'white',
                color: isCurrentMonth ? 'white' : theme.palette.primary.dark,
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'none',
                boxShadow: isCurrentMonth
                  ? `0 2px 4px ${alpha(theme.palette.primary.dark, 0.3)}`
                  : '0 1px 2px rgba(0, 0, 0, 0.05)',
              }}
            >
              今月
            </Button>
            <IconButton
              size="small"
              onClick={() => onChangeMonth(1)}
              sx={{ bgcolor: 'white', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', '&:hover': { bgcolor: theme.palette.primary.light }, fontSize: '12px' }}
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
                onClick={() => onSelectDate(dayInfo.date)}
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
  );
};
