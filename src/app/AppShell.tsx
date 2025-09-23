import React, { useEffect, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import HistoryIcon from '@mui/icons-material/History';
import { useSP } from '../lib/spClient';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            運営指導・記録管理
          </Typography>
          <ConnectionStatus />
          <IconButton component={RouterLink} to="/audit" color="inherit" aria-label="監査ログ">
            <HistoryIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction="row" spacing={1} mb={2}>
          <Button component={RouterLink} to="/" variant={location.pathname === '/' ? 'contained' : 'outlined'} size="small">日次記録</Button>
          <Button component={RouterLink} to="/checklist" variant={location.pathname.startsWith('/checklist') ? 'contained' : 'outlined'} size="small">自己点検</Button>
          <Button component={RouterLink} to="/audit" variant={location.pathname.startsWith('/audit') ? 'contained' : 'outlined'} size="small">監査ログ</Button>
        </Stack>
        {children}
      </Container>
    </>
  );
};

const ConnectionStatus: React.FC = () => {
  const { spFetch } = useSP();
  const [state, setState] = useState<'idle'|'ok'|'fail'>('idle');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await spFetch('/?$select=Title'); // minimal call
        if (cancelled) return;
        setState(res.ok ? 'ok' : 'fail');
      } catch {
        if (!cancelled) setState('fail');
      }
    })();
    return () => { cancelled = true; };
  }, [spFetch]);
  const color = state === 'ok' ? '#2e7d32' : state === 'fail' ? '#d32f2f' : '#ffb300';
  const label = state === 'ok' ? 'SP Connected' : state === 'fail' ? 'SP Error' : 'Checking…';
  return <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>{label}</span>;
};

// Integrate ConnectionStatus into shell header (placeholder integration)
// ...existing export / component logic remains below
export default AppShell;
