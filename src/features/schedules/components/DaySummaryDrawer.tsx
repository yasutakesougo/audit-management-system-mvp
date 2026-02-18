import React, { useMemo } from 'react';
import {
  Drawer,
  Box,
  IconButton,
  Typography,
  Stack,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import type { SchedItem } from '../data';

interface DaySummaryDrawerProps {
  open: boolean;
  selectedDateIso: string | null;
  items: SchedItem[];
  onClose: () => void;
  onAdd: () => void;
}

const parseDateIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDateDisplay = (iso: string): string => {
  const date = parseDateIso(iso);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
};

export const DaySummaryDrawer: React.FC<DaySummaryDrawerProps> = ({
  open,
  selectedDateIso,
  items,
  onClose,
  onAdd,
}) => {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const anchor = isTablet ? ('bottom' as const) : ('right' as const);

  // Filter items for selected date
  const dayItems = useMemo(() => {
    if (!selectedDateIso) return [];
    return items.filter((item) => {
      const itemDateIso = item.start?.substring(0, 10);
      return itemDateIso === selectedDateIso;
    });
  }, [items, selectedDateIso]);

  // Sort by start time
  const sortedItems = useMemo(() => {
    return [...dayItems].sort((a, b) => {
      const aTime = a.start || '99:99';
      const bTime = b.start || '99:99';
      return aTime.localeCompare(bTime);
    });
  }, [dayItems]);

  const dateDisplay = selectedDateIso ? formatDateDisplay(selectedDateIso) : '';

  const drawerWidth = isTablet ? '100%' : 360;
  const drawerHeight = isTablet ? 'auto' : '100vh';

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: isTablet ? drawerWidth : drawerWidth,
          maxHeight: isTablet ? '70vh' : drawerHeight,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">{dateDisplay}</Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={onAdd}
              variant="contained"
            >
              追加
            </Button>
          </Stack>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Body */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2,
          }}
        >
          {sortedItems.length === 0 ? (
            <Stack sx={{ alignItems: 'center', pt: 4 }} spacing={2}>
              <Typography variant="body2" color="textSecondary">
                予定はまだありません
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={onAdd}
                variant="outlined"
              >
                予定を追加
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {sortedItems.map((item, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 0.5,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {item.title || 'Untitled'}
                    </Typography>
                    {item.start && (
                      <Typography variant="caption" color="textSecondary">
                        {item.start.substring(11, 16)}
                        {item.end && ` - ${item.end.substring(11, 16)}`}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
