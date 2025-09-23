import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import HistoryIcon from '@mui/icons-material/History';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { ColorModeContext } from './theme';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { mode, toggle } = React.useContext(ColorModeContext);
  return (
    <>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            運営指導・記録管理
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton color="inherit" onClick={toggle} aria-label="配色切替">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton color="inherit" aria-label="監査ログ (未実装アイコンボタン)">
              <HistoryIcon />
            </IconButton>
          </Stack>
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

export default AppShell;
