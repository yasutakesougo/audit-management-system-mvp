import { SpTelemetryMetrics } from './telemetry';

export type TelemetrySummary = {
  total: number;
  slowCount: number;
  errorCount: number;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  byWarningCode: Record<string, number>;
};

const SLOW_QUERY_THRESHOLD_MS = 500; // Define locally or from config, using 500ms as generic threshold

export function computeTelemetrySummary(entries: SpTelemetryMetrics[]): TelemetrySummary {
  const summary: TelemetrySummary = {
    total: entries.length,
    slowCount: 0,
    errorCount: 0,
    lowCount: 0,
    mediumCount: 0,
    highCount: 0,
    byWarningCode: {},
  };

  for (const entry of entries) {
    if (entry.durationMs > SLOW_QUERY_THRESHOLD_MS) summary.slowCount++;
    if (entry.isError) summary.errorCount++;

    if (entry.riskLevel === 'high') summary.highCount++;
    else if (entry.riskLevel === 'medium') summary.mediumCount++;
    else summary.lowCount++;

    for (const code of entry.warningCodes) {
      summary.byWarningCode[code] = (summary.byWarningCode[code] || 0) + 1;
    }
  }

  // Optionally sort byWarningCode here or leave as Record. Returning Record is fine.
  return summary;
}
