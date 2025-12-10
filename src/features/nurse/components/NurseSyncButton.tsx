import { flushNurseQueue, type FlushSummary } from '@/features/nurse/state/useNurseSync';
import { usePrefersReducedMotion } from '@/lib/a11y/usePrefersReducedMotion';
import { TESTIDS } from '@/testids';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';

type NurseSyncButtonProps = {
  onResult?: (summary: FlushSummary) => void;
};

const NurseSyncButton: React.FC<NurseSyncButtonProps> = ({ onResult }) => {
  const [busy, setBusy] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleClick = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
  const summary = await flushNurseQueue(undefined, { source: 'manual', suppressToast: true });
  onResult?.(summary);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={!busy || prefersReducedMotion ? <SyncRoundedIcon /> : undefined}
      onClick={handleClick}
      disabled={busy}
      data-testid={TESTIDS.NURSE_SYNC_BUTTON}
      aria-busy={busy ? 'true' : undefined}
    >
      {busy
        ? prefersReducedMotion
          ? '同期中...'
          : <CircularProgress size={16} />
        : '同期'}
    </Button>
  );
};

export default NurseSyncButton;
