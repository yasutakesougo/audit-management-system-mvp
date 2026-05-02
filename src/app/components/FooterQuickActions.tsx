/**
 * FooterQuickActions — Fixed bottom action bar for quick access to daily workflows.
 *
 * Renders actions defined in footerActionsConfig.ts (SSOT).
 * This component is purely presentational — button definitions live in the config.
 */

import { createFooterActions, type FooterAction } from '@/app/config/footerActionsConfig';
import { HandoffQuickNoteCard } from '@/features/handoff/HandoffQuickNoteCard';
import { CallLogQuickDrawer } from '@/features/callLogs/components/CallLogQuickDrawer';
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
import { useTheme, type Theme } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MuiRouterLink } from '@/lib/muiLink';

// ─── Dialog action registry ──────────────────────────────────────────
// Maps onClickKey → state setter. Extend here when adding new dialog actions.
type DialogRegistry = Record<string, () => void>;

const releaseActiveFocus = () => {
  if (typeof document === 'undefined') {
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
};

export const FooterQuickActions: React.FC<{ fixed?: boolean; onlyDialogs?: boolean }> = ({ 
  fixed = true, 
  onlyDialogs = false 
}) => {
  const location = useLocation();
  const theme = useTheme();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);

  // Listen for global open event from any page (e.g. /handoff-timeline page button)
  useEffect(() => {
    const handler = () => {
      releaseActiveFocus();
      setQuickNoteOpen(true);
    };
    window.addEventListener('handoff-open-quicknote-dialog', handler);
    return () => window.removeEventListener('handoff-open-quicknote-dialog', handler);
  }, []);

  // Listen for global call-log open event (e.g. from CallLogPage)
  useEffect(() => {
    const handler = () => setCallLogOpen(true);
    window.addEventListener('call-log-open-drawer', handler);
    return () => window.removeEventListener('call-log-open-drawer', handler);
  }, []);

  const dialogHandlers: DialogRegistry = useMemo(
    () => ({
      'handoff-quicknote': () => {
        releaseActiveFocus();
        setQuickNoteOpen(true);
      },
      'call-log-quick': () => setCallLogOpen(true),
    }),
    [],
  );
  const handleCloseQuickNote = () => {
    releaseActiveFocus();
    setQuickNoteOpen(false);
  };

  // Build actions from SSOT config.
  // schedulesEnabled is intentionally false here — schedule button currently always shown
  // via the hardcoded list. If schedule feature flag is needed, wire it through props/context.
  const actions = useMemo(() => createFooterActions({ schedulesEnabled: true }), []);

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={
        fixed
          ? {
              position: 'fixed',
              bottom: { xs: 8, sm: 16 },
              left: 0,
              width: '100%',
              pointerEvents: 'none',
              zIndex: (theme) => theme.zIndex.appBar,
            }
          : {
              width: '100%',
              height: '100%',
            }
      }
    >
      {!onlyDialogs && (
        <Container
          maxWidth={fixed ? 'lg' : false}
          disableGutters={!fixed}
          sx={{
            height: '100%',
            ...(fixed ? { pointerEvents: 'auto' } : {}),
          }}
        >
          <Paper
            elevation={fixed ? 6 : 0}
            sx={{
              height: '100%',
              borderRadius: 0,
              px: { xs: 1, sm: 2 },
              pt: 1,
              pb: 1,
              ...(fixed
                ? {
                    pb: 'calc(1px * (var(--mobile-safe-area, 0)) + 0.5rem)',
                  }
                : {}),
              backdropFilter: fixed ? 'blur(6px)' : undefined,
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
              {actions.map((action) => renderAction(action, location.pathname, theme, dialogHandlers))}
            </Stack>
          </Paper>
        </Container>
      )}
      <Dialog
        open={quickNoteOpen}
        onClose={handleCloseQuickNote}
        fullWidth
        maxWidth="sm"
        data-testid="handoff-quicknote-dialog"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          今すぐ申し送り
          <IconButton aria-label="申し送りダイアログを閉じる" onClick={handleCloseQuickNote}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <HandoffQuickNoteCard />
        </DialogContent>
      </Dialog>

      {/* 受電ログ クイック Drawer（CallLogPage と同一 Drawer を FooterQuickActions でも共有） */}
      <CallLogQuickDrawer
        open={callLogOpen}
        onClose={() => setCallLogOpen(false)}
      />
    </Box>
  );
};

// ─── Render helpers ──────────────────────────────────────────────────

function renderAction(
  action: FooterAction,
  currentPathname: string,
  theme: Theme,
  dialogHandlers: DialogRegistry,
) {
  const { key, shortLabel, to, color, variant: baseVariant, accent, testId, kind } = action;

  const commonProps = {
    color,
    size: 'small' as const,
    fullWidth: true,
    sx: {
      flex: 1,
      minHeight: 36,
      fontWeight: 600,
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
      py: 0.25,
    } as const,
    'data-testid': testId,
  };

  if (kind === 'link' && to) {
    const targetPath = to.split('?')[0];
    const isActive = currentPathname.startsWith(targetPath);
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
        component={MuiRouterLink}
        to={to}
        variant={isActive ? 'contained' : baseVariant}
        aria-current={isActive ? 'page' : undefined}
        sx={{ ...commonProps.sx, ...activeSx }}
      >
        {shortLabel}
      </Button>
    );
  }

  // kind === 'dialog'
  const onClick = action.onClickKey ? dialogHandlers[action.onClickKey] : undefined;
  return (
    <Button
      key={key}
      {...commonProps}
      variant={baseVariant}
      startIcon={<EditNoteIcon />}
      onClick={onClick}
      data-testid={key === 'handoff-quicknote' ? TESTIDS['handoff-footer-quicknote'] : testId}
    >
      {shortLabel}
    </Button>
  );
}

export default FooterQuickActions;
