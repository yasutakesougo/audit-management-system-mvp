/**
 * ConnectionStatus — SharePoint connection badge shown in AppShell toolbar.
 *
 * Extracted from AppShell.tsx for maintainability.
 * testid: sp-connection-status
 */

import { useMsalContext } from '@/auth/MsalProvider';
import { getAppConfig, isDemoModeEnabled, isE2eMsalMockEnabled, readBool, shouldSkipLogin } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';

const SKIP_LOGIN = shouldSkipLogin();
const E2E_MSAL_MOCK_ENABLED = isE2eMsalMockEnabled();

const ConnectionStatusMock: React.FC = () => {
  const theme = useTheme();
  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="sp-connection-status"
      data-connection-state="ok"
      sx={{
        background: theme.palette.success.dark,
        color: theme.palette.common.white,
        px: 1,
        py: 0.25,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      SP Connected
    </Box>
  );
};

const ConnectionStatusReal: React.FC<{ sharePointDisabled: boolean }> = ({ sharePointDisabled }) => {
  const theme = useTheme();
  const forceSharePoint = readBool('VITE_FORCE_SHAREPOINT', false);
  const sharePointFeatureEnabled = readBool('VITE_FEATURE_SCHEDULES_SP', false);
  const { spFetch } = useSP();
  const { accounts } = useMsalContext();
  const accountsCount = accounts.length;
  const [state, setState] = useState<'checking' | 'ok' | 'error' | 'signedOut'>('checking');
  const bypassAccountGate = SKIP_LOGIN || E2E_MSAL_MOCK_ENABLED;
  const isDemoMode = isDemoModeEnabled();

  useEffect(() => {
    if (isDemoMode) {
      // eslint-disable-next-line no-console
      console.info('[demo] Skip SharePoint bootstrap');
      setState('ok');
      return;
    }

    const { isDev: isDevelopment } = getAppConfig();
    const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
    const shouldCheckSharePoint =
      !sharePointDisabled && (!isDevelopment || isVitest || forceSharePoint || sharePointFeatureEnabled);

    if (!shouldCheckSharePoint) {
      console.info('SharePoint 接続チェックをスキップし、モック状態に設定');
      setState('ok');
      return;
    }

    if (!bypassAccountGate && accountsCount === 0) {
      setState('signedOut');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setState('checking');
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
        console.warn('SharePoint 接続エラー:', error);
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isDemoMode, accountsCount, bypassAccountGate, forceSharePoint, sharePointFeatureEnabled, sharePointDisabled]);

  const { label, background } = useMemo(() => {
    switch (state) {
      case 'signedOut':
        return { label: 'SP Sign-In', background: theme.palette.primary.main };
      case 'ok':
        return { label: 'SP Connected', background: theme.palette.success.dark };
      case 'error':
        return { label: 'SP Error', background: theme.palette.error.main };
      default:
        return { label: 'Checking', background: theme.palette.warning.main };
    }
  }, [state, theme]);

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="sp-connection-status"
      data-connection-state={state}
      sx={{
        background,
        color: theme.palette.common.white,
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

export const ConnectionStatus: React.FC = () => {
  const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  const e2eMode = readBool('VITE_E2E', false) && !isVitest;
  const sharePointDisabled = readBool('VITE_SKIP_SHAREPOINT', false);
  const shouldMockConnection = e2eMode || sharePointDisabled || E2E_MSAL_MOCK_ENABLED;

  return shouldMockConnection ? <ConnectionStatusMock /> : <ConnectionStatusReal sharePointDisabled={sharePointDisabled} />;
};

export default ConnectionStatus;
