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

import { useUserAuthz } from '@/auth/useUserAuthz';
import { useFeatureFlags } from '@/config/featureFlags';
import {
  getKioskQuickLinks,
  type KioskQuickLinkId,
} from '../model/getKioskQuickLinks';
import { KIOSK_TELEMETRY_EVENTS } from '../telemetry/kioskNavigationTelemetry.types';
import { recordKioskTelemetry } from '../telemetry/recordKioskTelemetry';

// ─── Types ───────────────────────────────────────────────────

type KioskQuickLinksProps = {
  onNavigate: (href: string) => void;
};

const LINK_ICONS: Record<KioskQuickLinkId, React.ReactNode> = {
  schedule: <CalendarMonthRoundedIcon fontSize="small" />,
  handoff: <SwapHorizRoundedIcon fontSize="small" />,
  minutes: <SummarizeRoundedIcon fontSize="small" />,
  room: <MeetingRoomRoundedIcon fontSize="small" />,
  briefing: <GroupsRoundedIcon fontSize="small" />,
};

// ─── Component ───────────────────────────────────────────────

export const KioskQuickLinks: React.FC<KioskQuickLinksProps> = ({ onNavigate }) => {
  const theme = useTheme();
  const flags = useFeatureFlags();
  const { role } = useUserAuthz();
  const visibleLinks = React.useMemo(() => getKioskQuickLinks({ role, flags }), [flags, role]);

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
      {visibleLinks.map((link) => (
        <ButtonBase
          key={link.id}
          onClick={() => {
            recordKioskTelemetry(KIOSK_TELEMETRY_EVENTS.NAVIGATE_FROM_TODAY, {
              mode: 'kiosk',
              target: link.id,
              source: 'today',
              to: link.href,
            });
            onNavigate(link.href);
          }}
          data-testid={`kiosk-quick-link-${link.id}`}
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
            {LINK_ICONS[link.id]}
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
