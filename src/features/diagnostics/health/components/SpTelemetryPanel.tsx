import { Box, Divider, Paper, Stack, Typography, Chip } from "@mui/material";
import { StatusChip } from "./StatusChip";
import { spTelemetryStore } from "@/lib/telemetry/spTelemetryStore";
import { getSharePointThrottleCircuitBreakerState } from "@/lib/sp";
import React from "react";

/**
 * 🌐 SP通信状態パネル
 *
 * spTelemetryStore と circuit breaker を 1 秒間隔でポーリングし、
 * 通信統計情報とサーキットブレーカーの稼働状況を表示する。
 */
export function SpTelemetryPanel() {
  const [spSnapshot, setSpSnapshot] = React.useState(() => spTelemetryStore.getSnapshot());
  const [breakerState, setBreakerState] = React.useState(() => getSharePointThrottleCircuitBreakerState());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSpSnapshot(spTelemetryStore.getSnapshot());
      setBreakerState(getSharePointThrottleCircuitBreakerState());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "なし";
    try {
      return new Date(timestamp).toLocaleTimeString("ja-JP");
    } catch {
      return "なし";
    }
  };

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

      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ mt: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }} data-testid="sp-telemetry-breaker-section">
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            🛑 サーキットブレーカー:
          </Typography>
          <Chip
            size="small"
            label={breakerState.isOpen ? "動作中 (OPEN)" : "待機中 (CLOSED)"}
            color={breakerState.isOpen ? "error" : "success"}
            data-testid="sp-telemetry-breaker-chip"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {breakerState.isOpen ? (
            <>
              発生時刻: {formatTime(breakerState.openedAt)}
              <br />
              解除までの時間: <strong style={{ color: "#d32f2f" }}>残り {Math.ceil(breakerState.remainingMs / 1000)} 秒</strong>
            </>
          ) : (
            "現在、サーキットブレーカーは動作していません。"
          )}
        </Typography>
      </Box>
    </Paper>
  );
}
