/**
 * TBS — Snackbar feedback: success toast and error toast with retry.
 */
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import React from 'react';

export interface TbsSnackbarFeedbackProps {
  // Success snackbar
  snackbarOpen: boolean;
  snackbarMessage: string;
  onSnackbarClose: () => void;

  // Error snackbar
  displayedError: Error | null;
  onErrorClose: () => void;
  hasRetry: boolean;
  onRetry: () => void;
}

export const TbsSnackbarFeedback: React.FC<TbsSnackbarFeedbackProps> = ({
  snackbarOpen,
  snackbarMessage,
  onSnackbarClose,
  displayedError,
  onErrorClose,
  hasRetry,
  onRetry,
}) => (
  <>
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={onSnackbarClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={onSnackbarClose} severity="success" sx={{ width: '100%' }}>
        {snackbarMessage}
      </Alert>
    </Snackbar>
    <Snackbar
      open={Boolean(displayedError)}
      autoHideDuration={null}
      onClose={onErrorClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
    >
      <Alert
        onClose={onErrorClose}
        severity="error"
        sx={{ width: '100%' }}
        action={
          hasRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              再送
            </Button>
          ) : undefined
        }
      >
        {String(displayedError ?? '')}
      </Alert>
    </Snackbar>
  </>
);

export default TbsSnackbarFeedback;
