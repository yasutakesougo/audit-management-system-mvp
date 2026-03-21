import type {
  SuggestionTelemetryByRule,
  SuggestionTelemetrySummary,
} from './summarizeSuggestionTelemetry';

export type SuggestionLifecycleAnomalyType =
  | 'zero'
  | 'drop'
  | 'disappearance';

export type SuggestionLifecycleAnomalySeverity = 'warning' | 'critical';

export type SuggestionLifecycleAnomaly = {
  id: string;
  type: SuggestionLifecycleAnomalyType;
  severity: SuggestionLifecycleAnomalySeverity;
  title: string;
  message: string;
  currentShown: number;
  previousShown: number;
  dropRate: number;
  ruleId?: string;
};

export type SuggestionLifecycleAnomalyThresholds = {
  minPreviousShownForTotal: number;
  dropRateThreshold: number;
  minPreviousShownPerRule: number;
  maxRuleDisappearances: number;
};

export const DEFAULT_SUGGESTION_LIFECYCLE_ANOMALY_THRESHOLDS: SuggestionLifecycleAnomalyThresholds = {
  minPreviousShownForTotal: 20,
  dropRateThreshold: 0.5,
  minPreviousShownPerRule: 3,
  maxRuleDisappearances: 5,
};

export type DetectSuggestionLifecycleAnomaliesInput = {
  currentSummary: SuggestionTelemetrySummary;
  previousSummary: SuggestionTelemetrySummary;
  currentByRule: SuggestionTelemetryByRule[];
  previousByRule: SuggestionTelemetryByRule[];
  thresholds?: Partial<SuggestionLifecycleAnomalyThresholds>;
};

function computeDropRate(currentShown: number, previousShown: number): number {
  if (previousShown <= 0) return 0;
  const ratio = (previousShown - currentShown) / previousShown;
  return Math.max(0, ratio);
}

/**
 * suggestion lifecycle の急変を検出する。
 * - zero: 前期間に十分な shown があるのに現期間が 0
 * - drop: 前期間比で shown が急減
 * - disappearance: rule 単位で shown が消失
 */
export function detectSuggestionLifecycleAnomalies(
  input: DetectSuggestionLifecycleAnomaliesInput,
): SuggestionLifecycleAnomaly[] {
  const {
    currentSummary,
    previousSummary,
    currentByRule,
    previousByRule,
    thresholds,
  } = input;
  const config: SuggestionLifecycleAnomalyThresholds = {
    ...DEFAULT_SUGGESTION_LIFECYCLE_ANOMALY_THRESHOLDS,
    ...thresholds,
  };

  const currentShown = currentSummary.shown;
  const previousShown = previousSummary.shown;
  const anomalies: SuggestionLifecycleAnomaly[] = [];

  if (previousShown >= config.minPreviousShownForTotal) {
    if (currentShown === 0) {
      anomalies.push({
        id: 'lifecycle-zero-shown',
        type: 'zero',
        severity: 'critical',
        title: 'shown が 0 件',
        message: `前期間は shown ${previousShown} 件でしたが、現期間は 0 件です。計測停止または表示導線不具合の可能性があります。`,
        currentShown,
        previousShown,
        dropRate: 1,
      });
    } else {
      const dropRate = computeDropRate(currentShown, previousShown);
      if (dropRate >= config.dropRateThreshold) {
        anomalies.push({
          id: 'lifecycle-drop-shown',
          type: 'drop',
          severity: 'warning',
          title: 'shown が急減',
          message: `shown が前期間 ${previousShown} 件から現期間 ${currentShown} 件へ減少しました（-${Math.round(dropRate * 100)}%）。`,
          currentShown,
          previousShown,
          dropRate,
        });
      }
    }
  }

  const currentRuleMap = new Map<string, number>();
  for (const row of currentByRule) {
    currentRuleMap.set(row.ruleId, row.shown);
  }

  const disappearedRules = previousByRule
    .filter((row) => {
      if (row.shown < config.minPreviousShownPerRule) return false;
      return (currentRuleMap.get(row.ruleId) ?? 0) === 0;
    })
    .sort((a, b) => {
      if (b.shown !== a.shown) return b.shown - a.shown;
      return a.ruleId.localeCompare(b.ruleId);
    })
    .slice(0, config.maxRuleDisappearances);

  for (const row of disappearedRules) {
    anomalies.push({
      id: `lifecycle-rule-disappearance:${row.ruleId}`,
      type: 'disappearance',
      severity: 'warning',
      title: 'rule が消失',
      message: `rule "${row.ruleId}" は前期間 shown ${row.shown} 件でしたが、現期間は 0 件です。`,
      currentShown: 0,
      previousShown: row.shown,
      dropRate: 1,
      ruleId: row.ruleId,
    });
  }

  return anomalies;
}

