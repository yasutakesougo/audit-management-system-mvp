/**
 * AppShell Header — top AppBar with navigation controls, branding, and actions.
 * Extracted from AppShell.tsx.
 */
import { ConnectionStatus } from '@/app/components/ConnectionStatus';
import { TESTIDS } from '@/testids';
import SignInButton from '@/ui/components/SignInButton';
import HistoryIcon from '@mui/icons-material/History';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { P0AlertBadge } from '@/features/action-engine/components/P0AlertBadge';

type Props = {
  isDesktop: boolean;
  desktopNavOpen: boolean;
  dashboardPath: string;
  currentBreadcrumb?: string;
  onMobileMenuOpen: () => void;
  onDesktopNavToggle: () => void;
  onSettingsOpen: () => void;
  isFieldStaffShell?: boolean;
};

export const AppShellHeader: React.FC<Props> = ({
  isDesktop,
  desktopNavOpen,
  dashboardPath,
  currentBreadcrumb,
  onMobileMenuOpen,
  onDesktopNavToggle,
  onSettingsOpen,
  isFieldStaffShell,
}) => {

  return (
    <AppBar
      position="static"
      color="primary"
      enableColorOnDark
      sx={{
        height: '100%',
        width: '100%',
        borderRadius: 0,
        left: 0,
        right: 0,
        '& .MuiToolbar-root': {
          height: 44,
          minHeight: '44px !important',
          paddingTop: 0,
          paddingBottom: 0,
          alignItems: 'center',
        },
        '& .MuiToolbar-root .MuiTypography-root': {
          height: 44,
          lineHeight: '44px !important',
          display: 'flex',
          alignItems: 'center',
        },
        '& .MuiToolbar-root .MuiIconButton-root': {
          alignSelf: 'center',
        },
        '& .MuiToolbar-root .MuiChip-root': {
          alignSelf: 'center',
        },
        '& .MuiToolbar-root .MuiButton-root': {
          alignSelf: 'center',
        },
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: 1,
          minHeight: 44,
          height: 44,
          alignItems: 'center',
          '& > *': { alignSelf: 'center' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isDesktop && (
            <IconButton
              color="inherit"
              aria-label="メニューを開く"
              onClick={onMobileMenuOpen}
              edge="start"
              data-testid={TESTIDS['nav-open']}
              size="small"
              sx={{ p: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {isDesktop && (
            <IconButton
              color="inherit"
              aria-label={desktopNavOpen ? 'サイドメニューを閉じる' : 'サイドメニューを開く'}
              aria-expanded={desktopNavOpen}
              onClick={onDesktopNavToggle}
              edge="start"
              data-testid="desktop-nav-open"
              size="small"
              sx={{ p: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="subtitle1"
            component={RouterLink}
            to={dashboardPath}
            sx={{
              fontWeight: 600,
              lineHeight: '44px',
              height: 44,
              display: 'flex',
              alignItems: 'center',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            クロノート Link
          </Typography>
          {currentBreadcrumb ? (
            <Typography
              variant="caption"
              sx={{
                lineHeight: '44px',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.8,
              }}
            >
              / {currentBreadcrumb}
            </Typography>
          ) : null}
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!isFieldStaffShell && <P0AlertBadge />}
          <ConnectionStatus />
          <Tooltip title="表示設定">
            <IconButton
              color="inherit"
              onClick={onSettingsOpen}
              aria-label="表示設定"
              size="small"
              sx={{ p: 0.5 }}
            >
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>

          {!isFieldStaffShell && (
            <IconButton
              component={RouterLink}
              to="/audit"
              color="inherit"
              aria-label="監査ログ"
              data-testid={TESTIDS.nav.audit}
              size="small"
              sx={{ p: 0.5 }}
            >
              <HistoryIcon />
            </IconButton>
          )}
          <SignInButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
};
