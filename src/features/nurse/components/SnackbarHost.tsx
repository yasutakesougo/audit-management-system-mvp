import type { AlertColor } from '@mui/material/Alert';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type SnackbarPayload = {
  message: string;
  severity?: AlertColor;
  testId?: string;
  retryAction?: string | null;
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: AlertColor;
  testId?: string;
  retryAction?: string | null;
};

type SnackbarHost = {
  show: (message: string, severity?: AlertColor) => void;
  open: (payload: SnackbarPayload) => void;
  message: string;
  ui: ReactNode;
};

const DEFAULT_STATE: SnackbarState = {
  open: false,
  message: '',
  severity: 'info',
  testId: undefined,
  retryAction: null,
};

export const useSnackbarHost = (): SnackbarHost => {
  const [state, setState] = useState<SnackbarState>(DEFAULT_STATE);

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const open = useCallback((payload: SnackbarPayload) => {
    setState({
      open: true,
      message: payload.message,
      severity: payload.severity ?? 'info',
      testId: payload.testId,
      retryAction: payload.retryAction ?? null,
    });
  }, []);

  const show = useCallback((message: string, severity: AlertColor = 'info') => {
    open({ message, severity });
  }, [open]);

  const ui = useMemo<ReactNode>(() => (
    <Snackbar
      open={state.open}
      autoHideDuration={state.retryAction ? undefined : 4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={handleClose}
        severity={state.severity}
        variant="filled"
        data-testid={state.testId}
        sx={{ minWidth: 280 }}
      >
        {state.message}
      </Alert>
    </Snackbar>
  ), [handleClose, state.message, state.open, state.retryAction, state.severity, state.testId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!state.open && (state.message || state.testId || state.retryAction)) {
      const timeout = window.setTimeout(() => {
        setState(DEFAULT_STATE);
      }, 150);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [state.open, state.message, state.testId, state.retryAction]);

  return {
    show,
    open,
    message: state.message,
    ui,
  };
};
