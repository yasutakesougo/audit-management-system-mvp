import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { StatusChip } from "./StatusChip";
import { spTelemetryStore } from "@/lib/telemetry/spTelemetryStore";
import React from "react";

/**
 * 🌐 SP通信状態パネル
 *
 * spTelemetryStore を 2 秒間隔でポーリングし、
 * Throttled / Retry / Failed / Duration / Top Endpoints を表示する。
 */
export function SpTelemetryPanel() {
  const [spSnapshot, setSpSnapshot] = React.useState(() => spTelemetryStore.getSnapshot());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSpSnapshot(spTelemetryStore.getSnapshot());
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">🌐 SP通信状態</Typography>
        <StatusChip
          status={
            spSnapshot.summary.failedCount > 5
              ? "fail"
              : spSnapshot.summary.throttledCount > 20
              ? "warn"
              : "pass"
          }
        />
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {`Throttled: ${spSnapshot.summary.throttledCount} / Retry: ${spSnapshot.summary.retryCount} / Failed: ${spSnapshot.summary.failedCount}`}
        <br />{`Avg Duration: ${spSnapshot.summary.avgDurationMs}ms / P95: ${spSnapshot.summary.p95DurationMs}ms`}
        <br />{`Avg Queue: ${spSnapshot.summary.avgQueuedMs}ms / Max Queue: ${spSnapshot.summary.maxQueuedMs}ms`}
      </Typography>
      {spSnapshot.topEndpoints.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Top Failing Endpoints:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2, typography: "body2" }}>
            {spSnapshot.topEndpoints.map(
              (ep: { endpoint: string; failures: number; retries: number }, i: number) => (
                <li key={i}>
                  <code>{ep.endpoint}</code> (Fail: {ep.failures}, Retry: {ep.retries})
                </li>
              ),
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
