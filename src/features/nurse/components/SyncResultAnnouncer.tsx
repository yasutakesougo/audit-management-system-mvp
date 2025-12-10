import { useLastSync } from '@/features/nurse/state/useLastSync';
import { formatFlushSummaryToast, type SnackbarSeverity } from '@/features/nurse/toast/formatFlushSummaryToast';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import * as React from 'react';

type SyncResultAnnouncerProps = {
  announceOnly?: boolean;
  variant?: 'caption' | 'body2';
};

const srOnly = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  width: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  position: 'absolute' as const,
  whiteSpace: 'nowrap' as const,
};

const fallbackMessage = '同期状態：キューなし';

const SyncResultAnnouncer: React.FC<SyncResultAnnouncerProps> = ({ announceOnly = true, variant = 'caption' }) => {
  const lastSync = useLastSync();
  const summary = lastSync.summary;
  const isPending = lastSync.status === 'pending';

  const payload = summary && !isPending ? formatFlushSummaryToast(summary) : null;
  const [message, setMessage] = React.useState(fallbackMessage);
  const [severity, setSeverity] = React.useState<SnackbarSeverity>('info');

  React.useEffect(() => {
    if (payload?.message) {
      setMessage(payload.message);
      setSeverity(payload.severity);
    }
  }, [payload?.message, payload?.severity]);

  const ariaLive = severity === 'error' ? 'assertive' : 'polite';
  const role = severity === 'error' ? 'alert' : undefined;

  return (
    <>
      <Box
        role={role}
        aria-live={ariaLive}
        aria-atomic="true"
        data-testid={TESTIDS.NURSE_SYNC_ANNOUNCE}
        sx={announceOnly ? srOnly : undefined}
      >
        {message}
      </Box>

      {!announceOnly ? (
        <Typography
          variant={variant}
          color="text.secondary"
          sx={{ mt: 0.5 }}
          data-testid={TESTIDS.NURSE_SYNC_ANNOUNCE_VISIBLE}
        >
          {message}
        </Typography>
      ) : null}
    </>
  );
};

export default SyncResultAnnouncer;
