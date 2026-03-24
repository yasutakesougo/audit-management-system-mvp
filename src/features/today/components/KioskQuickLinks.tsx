/**
 * KioskQuickLinks — キオスクモード専用のクイックナビゲーション
 *
 * 📊 本日の進捗カード内に配置し、サイドメニューを開かずに
 * スケジュール・申し送り・議事録へ1タップで遷移できるようにする。
 *
 * キオスクモード以外では描画されない（呼び出し側で制御）。
 */
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

// ─── Types ───────────────────────────────────────────────────

export type KioskQuickLinkItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
};

type KioskQuickLinksProps = {
  onNavigate: (href: string) => void;
};

// ─── Links ───────────────────────────────────────────────────

const LINKS: KioskQuickLinkItem[] = [
  {
    key: 'schedule',
    label: 'スケジュール',
    icon: <CalendarMonthRoundedIcon fontSize="small" />,
    href: '/schedules/week',
  },
  {
    key: 'handoff',
    label: '申し送り',
    icon: <SwapHorizRoundedIcon fontSize="small" />,
    href: '/handoff-timeline',
  },
  {
    key: 'minutes',
    label: '議事録',
    icon: <SummarizeRoundedIcon fontSize="small" />,
    href: '/meeting-minutes',
  },
  {
    key: 'room',
    label: 'お部屋管理',
    icon: <MeetingRoomRoundedIcon fontSize="small" />,
    href: '/room-management',
  },
  {
    key: 'briefing',
    label: '朝会・夕会',
    icon: <GroupsRoundedIcon fontSize="small" />,
    href: '/dashboard/briefing',
  },
];

// ─── Component ───────────────────────────────────────────────

export const KioskQuickLinks: React.FC<KioskQuickLinksProps> = ({ onNavigate }) => {
  const theme = useTheme();

  return (
    <Box
      data-testid="kiosk-quick-links"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 1.5,
        pt: 1.5,
        mt: 1.5,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      }}
    >
      {LINKS.map((link) => (
        <ButtonBase
          key={link.key}
          onClick={() => onNavigate(link.href)}
          data-testid={`kiosk-quick-link-${link.key}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            transition: 'background-color 0.2s ease',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.12),
            },
            '&:active': {
              bgcolor: alpha(theme.palette.primary.main, 0.18),
            },
          }}
        >
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            {link.icon}
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              color: 'text.primary',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label}
          </Typography>
        </ButtonBase>
      ))}
    </Box>
  );
};
