import { SpTelemetryMetrics } from './telemetry';

export type IndexCandidateSummary = {
  listName: string;
  field: string;
  score: number;
  count: number;
  reasons: string[];
};

export type TelemetrySummary = {
  total: number;
  slowCount: number;
  errorCount: number;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  byWarningCode: Record<string, number>;
  topIndexCandidates: IndexCandidateSummary[];
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
    topIndexCandidates: [],
  };

  const idcMap: Record<string, { listName: string; field: string; score: number; count: number; reasons: Set<string> }> = {};

  for (const entry of entries) {
    const isSlow = entry.durationMs > SLOW_QUERY_THRESHOLD_MS;
    if (isSlow) summary.slowCount++;
    if (entry.isError) summary.errorCount++;

    if (entry.riskLevel === 'high') summary.highCount++;
    else if (entry.riskLevel === 'medium') summary.mediumCount++;
    else summary.lowCount++;

    for (const code of entry.warningCodes) {
      summary.byWarningCode[code] = (summary.byWarningCode[code] || 0) + 1;
    }

    if (entry.indexCandidates && entry.indexCandidates.length > 0) {
      let weight = 1;
      if (entry.riskLevel === 'medium') weight += 2;
      if (isSlow) weight += 3;
      if (entry.isError || entry.riskLevel === 'high') weight += 4;

      const lName = entry.listName || 'Unknown';
      for (const idx of entry.indexCandidates) {
        const key = `${lName}::${idx.field}`;
        if (!idcMap[key]) {
          idcMap[key] = { listName: lName, field: idx.field, score: 0, count: 0, reasons: new Set() };
        }
        idcMap[key].score += weight;
        idcMap[key].count += 1;
        idcMap[key].reasons.add(idx.reason);
      }
    }
  }

  summary.topIndexCandidates = Object.values(idcMap)
    .map(c => ({
      ...c,
      reasons: Array.from(c.reasons)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Return Top 5 candidates across all

  return summary;
}
