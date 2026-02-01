// src/features/auth/diagnostics/AuthDiagnosticsPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import { authDiagnostics, type AuthDiagnosticEvent } from './collector';

type AuthDiagnosticsPanelProps = {
  /** 表示する最大件数 */
  limit?: number;
  /** ポーリング間隔（ミリ秒） */
  pollInterval?: number;
};

const formatTimestamp = (iso: string): string => {
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  } catch {
    return iso;
  }
};

const OutcomeBadge = ({ outcome }: { outcome: AuthDiagnosticEvent['outcome'] }) => {
  const colorMap = {
    blocked: 'error',
    recovered: 'success',
    'manual-fix': 'warning',
  } as const;
  const labelMap = {
    blocked: 'ブロック',
    recovered: '回復',
    'manual-fix': '手動対応',
  } as const;
  return <Chip label={labelMap[outcome]} color={colorMap[outcome]} size="small" />;
};

export default function AuthDiagnosticsPanel({ limit = 10, pollInterval = 2000 }: AuthDiagnosticsPanelProps) {
  const [events, setEvents] = useState<AuthDiagnosticEvent[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof authDiagnostics.snapshot> | null>(null);

  const refresh = useCallback(() => {
    setEvents(authDiagnostics.getRecent(limit));
    setStats(authDiagnostics.snapshot());
  }, [limit]);

  useEffect(() => {
    // Subscribe to new events
    const unsubscribe = authDiagnostics.subscribe(() => {
      refresh();
    });

    // Initial load
    refresh();

    // Poll as fallback (in case listener updates are delayed)
    const timer = setInterval(refresh, pollInterval);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [refresh, pollInterval]);

  const handleClear = () => {
    authDiagnostics.clear();
    refresh();
  };

  if (!stats) return null;

  const topReasons = Object.entries(stats.byReason)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const recoveryPercent = (stats.recoveryRate * 100).toFixed(1);

  return (
    <Paper variant="outlined" sx={{ p: 2, maxWidth: 800, mx: 'auto', mt: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={600}>
            Auth Diagnostics (Dev)
          </Typography>
          <Button size="small" variant="outlined" onClick={handleClear}>
            クリア
          </Button>
        </Stack>

        <Divider />

        {/* Stats */}
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">
              合計
            </Typography>
            <Typography variant="h6">{stats.total}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              ブロック
            </Typography>
            <Typography variant="h6" color="error.main">
              {stats.byOutcome.blocked}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              回復
            </Typography>
            <Typography variant="h6" color="success.main">
              {stats.byOutcome.recovered}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              手動対応
            </Typography>
            <Typography variant="h6" color="warning.main">
              {stats.byOutcome['manual-fix']}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              回復率
            </Typography>
            <Typography variant="h6" color="success.main">
              {recoveryPercent}%
            </Typography>
          </Box>
        </Stack>

        <Divider />

        {/* Top Reasons */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Top Reasons
          </Typography>
          <Stack spacing={0.5}>
            {topReasons.map(([reason, count]) => (
              <Stack key={reason} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" fontFamily="monospace">
                  {reason}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Divider />

        {/* Recent Events */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Recent Events (新しい順)
          </Typography>
          <Stack spacing={1}>
            {events.map((evt, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    {formatTimestamp(evt.timestamp)}
                  </Typography>
                  <OutcomeBadge outcome={evt.outcome} />
                  <Typography variant="body2" fontFamily="monospace">
                    {evt.reason}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {evt.route || '/'}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
