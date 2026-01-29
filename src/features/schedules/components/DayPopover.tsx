import React from 'react';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { A11yList, A11yListItem, A11yRowButton } from '../../../components/a11y';
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
 * - 行全体をクリック可能に → Day表示に遷移
 * - 或いは下部 "Day で開く" ボタンでも遷移
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
  const MAX_VISIBLE = 5;
  const visibleItems = items.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, items.length - MAX_VISIBLE);

  const openDayAndClose = () => {
    onOpenDay(date);
    onClose();
  };

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
          <A11yList style={{ marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
            {visibleItems.map((item, index) => (
              <A11yListItem key={`${item.id ?? 'noid'}-${item.start ?? ''}-${item.title ?? item.notes ?? ''}-${index}`}>
                <A11yRowButton
                  onClick={openDayAndClose}
                  data-testid={`day-popover-item-${index}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {item.title || item.notes || '（タイトル未設定）'}
                  </Typography>
                  {item.category ? (
                    <Typography variant="caption" color="text.secondary">
                      {item.category}
                    </Typography>
                  ) : null}
                </A11yRowButton>
              </A11yListItem>
            ))}

            {hiddenCount > 0 && (
              <A11yListItem>
                <A11yRowButton
                  onClick={openDayAndClose}
                  data-testid="day-popover-more"
                  style={{
                    padding: '8px 0',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    他 {hiddenCount} 件
                  </Typography>
                </A11yRowButton>
              </A11yListItem>
            )}
          </A11yList>
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
            onClick={openDayAndClose}
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
