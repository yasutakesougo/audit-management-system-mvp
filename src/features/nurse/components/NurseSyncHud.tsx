import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import * as React from 'react';

import { minuteLabel } from '@/features/nurse/sp/minuteWindow';
import { useLastSync } from '@/features/nurse/state/useLastSync';
import { TESTIDS } from '@/testids';

type Props = {
  minuteBasis?: 'utc' | 'local';
  compact?: boolean;
  showWhen?: 'always' | 'not-pending'; // not-pending = success/partial/errorだけ
};

const statusColor = (s: string) =>
  s === 'success' ? 'success'
  : s === 'partial' ? 'warning'
  : s === 'error' ? 'error'
  : 'default' as const;

export const NurseSyncHud: React.FC<Props> = ({ minuteBasis, compact = false, showWhen = 'not-pending' }) => {
  const lastSync = useLastSync();
  const { status, summary } = lastSync;

  if (!summary) return null;
  if (showWhen === 'not-pending' && status === 'pending') return null;

  const { source, totalCount = 0, okCount = 0, errorCount = 0, partialCount = 0, entries = [] } = summary;

  // Create a representative ISO timestamp for minute labeling
  const now = new Date().toISOString();
  const label = minuteLabel(now, minuteBasis);

  return (
    <Box
      data-testid={TESTIDS.NURSE_SYNC_HUD}
      role="status"
      aria-live="off"
      sx={(t) => ({
        border: `1px solid ${alpha(t.palette.divider, 0.8)}`,
        bgcolor: alpha(t.palette.background.paper, 0.9),
        backdropFilter: 'blur(6px)',
        p: 1.5,
        borderRadius: 1.5,
        fontSize: 12,
      })}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
        <Chip size="small" label={`status: ${status}`} color={statusColor(status)} />
        <Chip size="small" label={`source: ${source ?? 'null'}`} variant="outlined" />
        <Chip size="small" label={`total: ${totalCount}`} variant="outlined" />
        <Chip size="small" label={`ok: ${okCount}`} variant="outlined" />
        <Chip size="small" label={`partial: ${partialCount}`} variant="outlined" />
        <Chip size="small" label={`error: ${errorCount}`} variant="outlined" />
        <Chip size="small" label={label} variant="outlined" data-testid={TESTIDS.NURSE_SYNC_MINUTE_LABEL} />
      </Stack>

      {!compact && entries?.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7 }}>
              entries
            </Typography>
            <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2 }}>
              {entries.map((e, i) => (
                <li key={`${e.userId}-${i}`} data-status={e.status}>
                  <Typography variant="caption">
                    {e.userId} — {e.status}
                  </Typography>
                </li>
              ))}
            </Stack>
          </Stack>
        </>
      )}
    </Box>
  );
};

export default NurseSyncHud;