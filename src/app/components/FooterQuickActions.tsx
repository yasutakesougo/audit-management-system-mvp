/**
 * FooterQuickActions — Fixed bottom action bar for quick access to daily workflows.
 *
 * Extracted from AppShell.tsx for maintainability.
 * Contains: attendance, case record, support procedure, handoff quick-note, schedule buttons.
 */

import { HandoffQuickNoteCard } from '@/features/handoff/HandoffQuickNoteCard';
import { TESTIDS } from '@/testids';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

type FooterAction = {
  key: string;
  label: string;
  color: 'primary' | 'secondary' | 'info';
  variant: 'contained' | 'outlined';
  to?: string;
  onClick?: () => void;
};

const footerTestIds: Record<string, string> = {
  'schedules-month': TESTIDS['schedules-footer-month'],
  'daily-attendance': TESTIDS['daily-footer-attendance'],
  'daily-activity': TESTIDS['daily-footer-activity'],
  'daily-support': TESTIDS['daily-footer-support'],
  'handoff-quicknote': TESTIDS['handoff-footer-quicknote'],
};

const footerAccentByKey: Record<string, string> = {
  'handoff-quicknote': '#C53030',
  'schedules-month': '#B7791F',
  'daily-attendance': '#2F855A',
  'daily-activity': '#C05621',
  'daily-support': '#6B46C1',
};

const footerShortLabelByKey: Record<string, string> = {
  'handoff-quicknote': '申し送り',
  'schedules-month': '予定',
  'daily-attendance': '通所',
  'daily-activity': 'ケース記録',
  'daily-support': '支援手順',
};

export const FooterQuickActions: React.FC<{ fixed?: boolean }> = ({ fixed = true }) => {
  const location = useLocation();
  const theme = useTheme();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  // Listen for global open event from any page (e.g. /handoff-timeline page button)
  useEffect(() => {
    const handler = () => setQuickNoteOpen(true);
    window.addEventListener('handoff-open-quicknote-dialog', handler);
    return () => window.removeEventListener('handoff-open-quicknote-dialog', handler);
  }, []);

  const scheduleMonthAction: FooterAction = {
    key: 'schedules-month',
    label: 'スケジュール',
    to: '/schedules/month',
    color: 'info' as const,
    variant: 'contained' as const,
  };

  const baseActions: FooterAction[] = [
    {
      key: 'daily-attendance',
      label: '通所管理',
      to: '/daily/attendance',
      color: 'info' as const,
      variant: 'contained' as const,
    },
    {
      key: 'daily-activity',
      label: 'ケース記録入力',
      to: '/daily/table',
      color: 'primary' as const,
      variant: 'contained' as const,
    },
    {
      key: 'daily-support',
      label: '支援手順記録入力',
      to: '/daily/support',
      color: 'primary' as const,
      variant: 'outlined' as const,
    },
  ] as const;

  const handleQuickNoteClick = () => {
    setQuickNoteOpen(true);
  };

  const actions: FooterAction[] = [
    {
      key: 'handoff-quicknote',
      label: '今すぐ申し送り',
      color: 'secondary' as const,
      variant: 'contained' as const,
      onClick: handleQuickNoteClick,
    },
    scheduleMonthAction,
    ...baseActions,
  ];

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        position: fixed ? 'fixed' : 'static',
        bottom: fixed ? { xs: 8, sm: 16 } : 'auto',
        left: fixed ? 0 : 'auto',
        width: '100%',
        pointerEvents: fixed ? 'none' : 'auto',
        zIndex: fixed ? ((theme) => theme.zIndex.appBar) : 'auto',
      }}
    >
      <Container maxWidth="lg" sx={fixed ? { pointerEvents: 'auto' } : undefined}>
        <Paper
          elevation={6}
          sx={{
            height: 56,
            borderRadius: 0,
            px: { xs: 1, sm: 2 },
            py: { xs: 0.5, sm: 1 },
            pb: 'calc(1px * (var(--mobile-safe-area, 0)) + 0.5rem)',
            backdropFilter: 'blur(6px)',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(33, 33, 33, 0.95)'
                : 'rgba(255, 255, 255, 0.98)',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{
              width: '100%',
              height: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              flexWrap: 'nowrap',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { height: 4 },
            }}
          >
            {actions.map(({ key, label, to, color, variant: baseVariant, onClick }) => {
              const displayLabel = footerShortLabelByKey[key] ?? label;
              const commonProps = {
                color,
                size: 'small' as const,
                fullWidth: true,
                sx: {
                  flex: 1,
                  minHeight: 44,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  py: 0.5,
                },
                'data-testid': footerTestIds[key],
              };

              if (to) {
                const targetPath = to.split('?')[0];
                const isActive = location.pathname.startsWith(targetPath);
                const accent = footerAccentByKey[key] ?? theme.palette.primary.main;
                const activeSx = isActive
                  ? {
                      color: accent,
                      borderBottom: `3px solid ${accent}`,
                      borderRadius: 0,
                      fontWeight: 700,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }
                  : undefined;
                return (
                  <Button
                    key={key}
                    {...commonProps}
                    component={RouterLink as unknown as React.ElementType}
                    to={to}
                    variant={isActive ? 'contained' : baseVariant}
                    aria-current={isActive ? 'page' : undefined}
                    sx={{ ...commonProps.sx, ...activeSx }}
                  >
                    {displayLabel}
                  </Button>
                );
              }

              return (
                <Button
                  key={key}
                  {...commonProps}
                  variant={baseVariant}
                  startIcon={<EditNoteIcon />}
                  onClick={onClick}
                  data-testid={key === 'handoff-quicknote' ? TESTIDS['handoff-footer-quicknote'] : undefined}
                >
                  {displayLabel}
                </Button>
              );
            })}
          </Stack>
        </Paper>
      </Container>
      <Dialog
        open={quickNoteOpen}
        onClose={() => setQuickNoteOpen(false)}
        fullWidth
        maxWidth="sm"
        data-testid="handoff-quicknote-dialog"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          今すぐ申し送り
          <IconButton aria-label="申し送りダイアログを閉じる" onClick={() => setQuickNoteOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <HandoffQuickNoteCard />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default FooterQuickActions;
