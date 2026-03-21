import { useMemo, useRef } from 'react';
import {
  groupSuggestionTelemetryByPriority,
  groupSuggestionTelemetryByRule,
  groupSuggestionTelemetryByScreen,
  summarizeSuggestionTelemetry,
  type SuggestionTelemetryByPriority,
  type SuggestionTelemetryByRule,
  type SuggestionTelemetryByScreen,
  type SuggestionTelemetryRecord,
  type SuggestionTelemetrySummary,
  type SuggestionTelemetryWindow,
} from './summarizeSuggestionTelemetry';

export type UseSuggestionTelemetrySummaryOptions = {
  events: SuggestionTelemetryRecord[];
  window?: SuggestionTelemetryWindow;
};

export type UseSuggestionTelemetrySummaryResult = {
  summary: SuggestionTelemetrySummary;
  byRule: SuggestionTelemetryByRule[];
  byScreen: SuggestionTelemetryByScreen[];
  byPriority: SuggestionTelemetryByPriority[];
};

/**
 * 取得済み lifecycle events を pure 集計に接続する hook。
 */
export function useSuggestionTelemetrySummary(
  options: UseSuggestionTelemetrySummaryOptions,
): UseSuggestionTelemetrySummaryResult {
  const { events, window } = options;

  const initialNowRef = useRef<Date>(window?.now ?? new Date());
  const fromMs = window?.from?.getTime();
  const toMs = window?.to?.getTime();
  const nowMs = window?.now
    ? window.now.getTime()
    : initialNowRef.current.getTime();

  const effectiveWindow = useMemo(() => {
    return {
      from: fromMs !== undefined ? new Date(fromMs) : undefined,
      to: toMs !== undefined ? new Date(toMs) : undefined,
      now: new Date(nowMs),
    };
  }, [fromMs, toMs, nowMs]);

  return useMemo(() => {
    return {
      summary: summarizeSuggestionTelemetry(events, effectiveWindow),
      byRule: groupSuggestionTelemetryByRule(events, effectiveWindow),
      byScreen: groupSuggestionTelemetryByScreen(events, effectiveWindow),
      byPriority: groupSuggestionTelemetryByPriority(events, effectiveWindow),
    };
  }, [events, effectiveWindow]);
}
