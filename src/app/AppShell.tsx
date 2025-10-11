import React, { useContext, useEffect, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Tooltip from '@mui/material/Tooltip';
import HistoryIcon from '@mui/icons-material/History';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Box from '@mui/material/Box';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useFeatureFlags } from '@/config/featureFlags';
import { ColorModeContext } from './theme';
import { useSP } from '@/lib/spClient';
import SignInButton from '@/ui/components/SignInButton';

type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  testId?: string;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { schedules, schedulesCreate, complianceForm } = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      {
        label: '日次記録',
        to: '/',
        isActive: (pathname) => pathname === '/' || pathname.startsWith('/records'),
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: (pathname) => pathname.startsWith('/checklist'),
      },
      {
        label: '監査ログ',
        to: '/audit',
        isActive: (pathname) => pathname.startsWith('/audit'),
      },
      {
        label: '利用者',
        to: '/users',
        isActive: (pathname) => pathname.startsWith('/users'),
      },
    ];

    if (schedules) {
      items.push({
        label: 'スケジュール',
        to: '/schedules/week',
  isActive: (pathname) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
        testId: 'nav-schedule',
      });
    }

    if (schedulesCreate) {
      items.push({
        label: '新規予定',
        to: '/schedules/create',
        isActive: (pathname) => pathname.startsWith('/schedules/create'),
      });
    }

    if (complianceForm) {
      items.push({
        label: 'コンプラ報告',
        to: '/checklist',
        isActive: (pathname) => pathname.startsWith('/compliance'),
      });
    }

    return items;
  }, [schedules, schedulesCreate, complianceForm]);

  return (
    <>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            運営指導・記録管理
          </Typography>
          <ConnectionStatus />
          <Tooltip title={mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}>
            <IconButton color="inherit" onClick={toggle} aria-label="テーマ切り替え">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <IconButton component={RouterLink} to="/audit" color="inherit" aria-label="監査ログ">
            <HistoryIcon />
          </IconButton>
          <SignInButton />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box component="nav" role="navigation" aria-label="主要ナビゲーション" mb={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {navItems.map(({ label, to, isActive, testId }) => {
              const active = isActive(location.pathname);
              return (
                <Button
                  key={label}
                  component={RouterLink}
                  to={to}
                  variant={active ? 'contained' : 'outlined'}
                  size="small"
                  data-testid={testId}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
        </Box>
        {children}
      </Container>
    </>
  );
};

const ConnectionStatus: React.FC = () => {
  const { spFetch } = useSP();
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const result = await spFetch('/currentuser?$select=Id', { signal: controller.signal });
        if (cancelled) return;
        let ok = false;
        if (result instanceof Response) {
          ok = result.ok;
        } else if (result && typeof result === 'object' && 'ok' in result) {
          ok = Boolean((result as { ok?: unknown }).ok);
        }
        setState(ok ? 'ok' : 'error');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') {
          setState('checking');
          return;
        }
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [spFetch]);

  const { label, background } = useMemo(() => {
    switch (state) {
      case 'ok':
        return { label: 'SP Connected', background: '#2e7d32' };
      case 'error':
        return { label: 'SP Error', background: '#d32f2f' };
      default:
        return { label: 'Checking', background: '#ffb300' };
    }
  }, [state]);

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        background,
        color: '#fff',
        px: 1,
        py: 0.25,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      {label}
    </Box>
  );
};

export default AppShell;
