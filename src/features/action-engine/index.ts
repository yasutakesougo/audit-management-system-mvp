// ---------------------------------------------------------------------------
// Action Engine — Public API
// ---------------------------------------------------------------------------

// Domain types
export type {
  ActionSuggestion,
  SuggestionType,
  SuggestionPriority,
  SuggestionEvidence,
  SuggestionCTA,
  CorrectiveActionInput,
  TrendSummary,
  ExecutionSummary,
  HeatmapPeak,
  HighIntensityEvent,
  ActionSuggestionState,
  SuggestionStatus,
} from './domain/types';

// Domain utilities
export {
  buildStableId,
  toWeekBucket,
  dedupeKey,
  MAX_SUGGESTIONS_PER_USER,
  isSuggestionVisible,
} from './domain/types';
export {
  computeSnoozeUntil,
  SNOOZE_PRESET_LABELS,
} from './domain/computeSnoozeUntil';
export type { SnoozePreset } from './domain/computeSnoozeUntil';

// Evidence summary
export { summarizeEvidence } from './domain/summarizeEvidence';

// Pure function
export { buildCorrectiveActions } from './domain/buildCorrectiveActions';

// React hook
export {
  useActionSuggestions,
  buildTrendSummary,
  buildHeatmapPeak,
  extractHighIntensityEvents,
  getLastRecordDate,
} from './hooks/useActionSuggestions';
export type {
  UseActionSuggestionsOptions,
  UseActionSuggestionsReturn,
} from './hooks/useActionSuggestions';

// State store
export { useSuggestionStateStore } from './hooks/useSuggestionStateStore';
export type { SuggestionStateStore, SuggestionStateMeta } from './hooks/useSuggestionStateStore';

// Telemetry
export {
  buildSuggestionTelemetryEvent,
  SUGGESTION_TELEMETRY_EVENTS,
} from './telemetry/buildSuggestionTelemetryEvent';
export type {
  SuggestionTelemetryEvent,
  SuggestionTelemetryEventName,
  SuggestionTelemetrySourceScreen,
  BuildSuggestionTelemetryEventInput,
} from './telemetry/buildSuggestionTelemetryEvent';
export {
  recordSuggestionTelemetry,
  _resetSuggestionTelemetryGuard,
} from './telemetry/recordSuggestionTelemetry';
export { useSuggestionVisibilityTelemetry } from './telemetry/useSuggestionVisibilityTelemetry';
export type { UseSuggestionVisibilityTelemetryOptions } from './telemetry/useSuggestionVisibilityTelemetry';
export {
  resolveSuggestionTelemetryWindow,
  summarizeSuggestionTelemetry,
  groupSuggestionTelemetryByRule,
  groupSuggestionTelemetryByScreen,
  groupSuggestionTelemetryByPriority,
} from './telemetry/summarizeSuggestionTelemetry';
export type {
  SuggestionTelemetryRecord,
  SuggestionTelemetryWindow,
  ResolvedSuggestionTelemetryWindow,
  SuggestionTelemetryCounts,
  SuggestionTelemetryRates,
  SuggestionTelemetrySummary,
  SuggestionTelemetryByRule,
  SuggestionTelemetryByScreen,
  SuggestionTelemetryByPriority,
} from './telemetry/summarizeSuggestionTelemetry';
export {
  useSuggestionLifecycleEvents,
} from './telemetry/useSuggestionLifecycleEvents';
export type {
  UseSuggestionLifecycleEventsOptions,
  UseSuggestionLifecycleEventsResult,
} from './telemetry/useSuggestionLifecycleEvents';
export { useSuggestionTelemetrySummary } from './telemetry/useSuggestionTelemetrySummary';
export type {
  UseSuggestionTelemetrySummaryOptions,
  UseSuggestionTelemetrySummaryResult,
} from './telemetry/useSuggestionTelemetrySummary';
export {
  detectSuggestionLifecycleAnomalies,
  DEFAULT_SUGGESTION_LIFECYCLE_ANOMALY_THRESHOLDS,
} from './telemetry/detectSuggestionLifecycleAnomalies';
export type {
  SuggestionLifecycleAnomaly,
  SuggestionLifecycleAnomalyType,
  SuggestionLifecycleAnomalySeverity,
  SuggestionLifecycleAnomalyThresholds,
  DetectSuggestionLifecycleAnomaliesInput,
} from './telemetry/detectSuggestionLifecycleAnomalies';
