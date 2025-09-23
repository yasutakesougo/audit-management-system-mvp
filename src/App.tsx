import React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from './auth/MsalProvider';
import { ThemeRoot } from './app/theme';
import Router from './app/router';
import AppShell from './app/AppShell';

function App() {
  return (
    <MsalProvider>
      <ThemeRoot>
        <CssBaseline />
        <BrowserRouter>
          <AppShell>
            <Router />
          </AppShell>
        </BrowserRouter>
      </ThemeRoot>
    </MsalProvider>
  );
}

export default App;
