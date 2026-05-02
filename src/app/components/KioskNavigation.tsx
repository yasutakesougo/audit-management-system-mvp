import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import HomeIcon from '@mui/icons-material/Home';
import EventNoteIcon from '@mui/icons-material/EventNote';
import LoginIcon from '@mui/icons-material/Login';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { appendKioskSearchParams } from '@/features/kiosk/utils/navigation';

/**
 * KioskNavigation - キオスクモード専用のナビゲーションメニュー
 * 
 * グローバルなフッターの代わりに、キオスクモード内での主要な導線を提供。
 * タブレットでの操作性を重視し、大きく押しやすいボタンを配置。
 */
export const KioskNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      label: 'ホーム',
      icon: <HomeIcon />,
      path: '/kiosk',
      testId: 'kiosk-nav-home',
      kind: 'link',
    },
    {
      label: '予定',
      icon: <EventNoteIcon />,
      path: '/schedules/day',
      testId: 'kiosk-nav-schedule',
      kind: 'link',
    },
    {
      label: '通所',
      icon: <LoginIcon />,
      path: '/daily/attendance',
      testId: 'kiosk-nav-attendance',
      kind: 'link',
    },
    {
      label: '記録',
      icon: <HistoryIcon />,
      path: '/daily/table',
      testId: 'kiosk-nav-activity',
      kind: 'link',
    },
    {
      label: '支援手順',
      icon: <PlayCircleOutlineIcon />,
      path: '/kiosk/users',
      testId: 'kiosk-nav-procedures',
      kind: 'link',
    },
    {
      label: '受電ログ',
      icon: <PhoneInTalkIcon />,
      testId: 'kiosk-nav-calllog',
      kind: 'dialog',
      onClick: () => window.dispatchEvent(new CustomEvent('call-log-open-drawer')),
    },
    {
      label: '申し送り',
      icon: <EditNoteIcon />,
      testId: 'kiosk-nav-handoff',
      kind: 'dialog',
      onClick: () => window.dispatchEvent(new CustomEvent('handoff-open-quicknote-dialog')),
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: '32px 32px 0 0',
        bgcolor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        zIndex: (theme) => theme.zIndex.appBar + 1,
        px: { xs: 2, md: 6 },
        pb: 'calc(env(safe-area-inset-bottom) + 16px)',
        pt: 2,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
        // ダークモード対応
        '.mode-dark &': {
          bgcolor: 'rgba(18, 18, 18, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }
      }}
    >
      <Stack 
        direction="row" 
        spacing={1} 
        justifyContent="flex-start" 
        alignItems="center"
        sx={{
          overflowX: 'auto',
          pb: 1,
          '::-webkit-scrollbar': { display: 'none' },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {navItems.map((item) => {
          const isActive = item.kind === 'link' && location.pathname === item.path;
          return (
            <Button
              key={item.label}
              data-testid={item.testId}
              variant={isActive ? 'contained' : 'text'}
              color={isActive ? 'primary' : 'inherit'}
              startIcon={React.cloneElement(item.icon as React.ReactElement, { sx: { fontSize: '1.5rem !important' } })}
              onClick={() => {
                if (item.kind === 'link' && item.path) {
                  navigate(appendKioskSearchParams(item.path, location.search));
                } else if (item.kind === 'dialog' && item.onClick) {
                  item.onClick();
                }
              }}
              sx={{
                flexShrink: 0,
                px: 2,
                py: 1.2,
                borderRadius: 4,
                fontSize: '0.85rem',
                fontWeight: 700,
                flexDirection: 'column',
                gap: 0.2,
                minWidth: 80,
                '& .MuiButton-startIcon': {
                  margin: 0,
                },
                ...(isActive ? {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                } : {
                  opacity: 0.8,
                })
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>
    </Paper>
  );
};
