import { useToast } from '@/features/nurse/components/ToastContext';
import { flushNurseQueue } from '@/features/nurse/state/useNurseSync';
import { formatFlushSummaryToast } from '@/features/nurse/toast/formatFlushSummaryToast';
import { usePrefersReducedMotion } from '@/lib/a11y/usePrefersReducedMotion';
import { TESTIDS } from '@/testids';
import CloudSyncRounded from '@mui/icons-material/CloudSyncRounded';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import React, { useState } from 'react';

export type SyncNowButtonProps = {
  runFlush?: typeof flushNurseQueue;
  disabled?: boolean;
};

const SyncNowButton: React.FC<SyncNowButtonProps> = ({ runFlush = flushNurseQueue, disabled = false }) => {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleRun = async () => {
    if (busy || disabled) {
      return;
    }
    setBusy(true);
    try {
      const summary = await runFlush(undefined, { source: 'manual' });
      const payload = formatFlushSummaryToast(summary);
      toast.show(payload.message, payload.severity);
    } catch (error) {
      console.error('Failed to flush nurse queue', error);
      toast.show('同期に失敗しました。通信状況を確認してください。', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="contained"
      onClick={handleRun}
      startIcon={!busy || prefersReducedMotion ? <CloudSyncRounded /> : undefined}
      disabled={busy || disabled}
      data-testid={TESTIDS.NURSE_SYNC_BUTTON}
      aria-busy={busy ? 'true' : undefined}
    >
      {busy
        ? prefersReducedMotion
          ? '同期中...'
          : <CircularProgress size={20} color="inherit" />
        : '同期'}
    </Button>
  );
};

export default SyncNowButton;
