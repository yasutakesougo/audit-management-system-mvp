import React, { useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { RouterProvider } from 'react-router-dom';
import { MsalProvider } from './auth/MsalProvider';
import { ThemeRoot } from './app/theme';
import { router } from './app/router';
import { FeatureFlagsProvider } from './config/featureFlags';
import { ToastProvider, useToast } from './hooks/useToast';
import { registerNotifier } from './lib/notice';

export const ToastNotifierBridge: React.FC = () => {
  const { show } = useToast();

  useEffect(() => {
    registerNotifier((message) => {
      if (typeof message === 'string' && message.trim().length > 0) {
        show('info', message);
      }
    });
    return () => {
      registerNotifier(null);
    };
  }, [show]);

  return null;
};

function App() {
  return (
    <FeatureFlagsProvider>
      <MsalProvider>
        <ThemeRoot>
          <CssBaseline />
          <ToastProvider>
            <ToastNotifierBridge />
            <RouterProvider router={router} />
          </ToastProvider>
        </ThemeRoot>
      </MsalProvider>
    </FeatureFlagsProvider>
  );
}

export default App;
