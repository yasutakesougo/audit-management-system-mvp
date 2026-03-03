/**
 * IRC — Snackbar feedback components (Presentational).
 *
 * Two snackbars: one for errors, one for action feedback.
 */
import { Alert, Snackbar } from '@mui/material';
import React from 'react';

import type { SchedulesErrorInfo } from '@/features/schedules/errors';

export interface IrcSnackbarFeedbackProps {
  // Error snackbar
  snackbarOpen: boolean;
  snackbarMessage: string;
  lastError: SchedulesErrorInfo | null;
  onCloseSnackbar: () => void;

  // Feedback snackbar (double-booking, lock, etc.)
  feedbackMessage: string | null;
  onCloseFeedback: () => void;
}

export const IrcSnackbarFeedback: React.FC<IrcSnackbarFeedbackProps> = ({
  snackbarOpen,
  snackbarMessage,
  lastError,
  onCloseSnackbar,
  feedbackMessage,
  onCloseFeedback,
}) => (
  <>
    {/* Error / warning snackbar */}
    <Snackbar
      open={snackbarOpen || !!lastError}
      autoHideDuration={6000}
      onClose={onCloseSnackbar}
    >
      <Alert
        severity={lastError?.kind === 'NETWORK_ERROR' ? 'error' : 'warning'}
        onClose={onCloseSnackbar}
        data-testid="irc-error-alert"
      >
        {lastError?.message || snackbarMessage}
      </Alert>
    </Snackbar>

    {/* Action feedback snackbar */}
    <Snackbar
      open={!!feedbackMessage}
      autoHideDuration={4000}
      onClose={(_, reason) => {
        if (reason === 'clickaway') return;
        onCloseFeedback();
      }}
      message={feedbackMessage}
    />
  </>
);

export default IrcSnackbarFeedback;
