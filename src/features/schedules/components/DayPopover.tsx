import React from 'react';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { SchedItem } from '../data';
import { TESTIDS } from '@/testids';

interface DayPopoverProps {
  open: boolean;
  anchorEl: HTMLButtonElement | null;
  date: string;
  dateLabel: string;
  items: SchedItem[];
  onClose: () => void;
  onOpenDay: (date: string) => void;
}

/**
 * DayPopover: 月ビューの日セルをクリック時に、その日の予定一覧を表示するPopover
 * - 当日の全予定をリスト表示
 * - "Day で開く" ボタンで /schedules/day?date=... に遷移
 */
export const DayPopover: React.FC<DayPopoverProps> = ({
  open,
  anchorEl,
  date,
  dateLabel,
  items,
  onClose,
  onOpenDay,
}) => {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      data-testid={TESTIDS['schedules-day-popover']}
    >
      <Box sx={{ p: 2, minWidth: 280, maxWidth: 400 }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarTodayIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {dateLabel}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 予定リスト */}
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            この日の予定はありません
          </Typography>
        ) : (
          <List sx={{ mb: 2, maxHeight: 240, overflowY: 'auto' }}>
            {items.map((item, index) => (
              <React.Fragment key={`${item.id}-${index}`}>
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    py: 1,
                    '&:not(:last-child)': {
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                >
                  <ListItemText
                    primary={item.title || item.note || '（タイトル未設定）'}
                    secondary={
                      item.category ? (
                        <span style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                          {item.category}
                        </span>
                      ) : undefined
                    }
                    primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 500 } }}
                    secondaryTypographyProps={{ component: 'div', sx: { mt: 0.5 } }}
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onClose}>
            閉じる
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              onOpenDay(date);
              onClose();
            }}
            data-testid={TESTIDS['schedules-popover-open-day']}
            startIcon={<CalendarTodayIcon />}
          >
            Day で開く
          </Button>
        </Box>
      </Box>
    </Popover>
  );
};
