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
  ActionTask,
  ActionTaskStatus,
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

// Batch hook (Exception Center 向け)
export { useAllCorrectiveActions } from './hooks/useAllCorrectiveActions';
export type {
  AllCorrectiveActionsStatus,
  UseAllCorrectiveActionsReturn,
} from './hooks/useAllCorrectiveActions';

// State stores
export { useSuggestionStateStore } from './hooks/useSuggestionStateStore';
export type { SuggestionStateStore, SuggestionStateMeta } from './hooks/useSuggestionStateStore';
export { useActionTaskStore, actionTaskSelectors } from './hooks/useActionTaskStore';
export type { ActionTaskStore } from './hooks/useActionTaskStore';

// Components
export { ActionTaskList } from './components/ActionTaskList';

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
export {
  computeWeeklyReviewResult,
  WEEKLY_REVIEW_THRESHOLDS,
} from './telemetry/computeWeeklyReviewResult';
export type {
  WeeklyReviewInputMetrics,
  WeeklyReviewMetrics,
  WeeklyReviewResult,
  ComputeWeeklyReviewResultInput,
} from './telemetry/computeWeeklyReviewResult';
export {
  computeAssessmentStaleReviewResult,
  ASSESSMENT_STALE_RULE_ALIASES,
  ASSESSMENT_STALE_REVIEW_MIN_SHOWN,
} from './telemetry/computeAssessmentStaleReviewResult';
export type {
  AssessmentStaleReviewStatus,
  AssessmentStaleLifecycleSnapshot,
  AssessmentStaleReviewResult,
  ComputeAssessmentStaleReviewResultInput,
} from './telemetry/computeAssessmentStaleReviewResult';
export {
  computeBehaviorTrendReviewResult,
  BEHAVIOR_TREND_RULE_ALIASES,
  BEHAVIOR_TREND_REVIEW_MIN_SHOWN,
  BEHAVIOR_TREND_REVIEW_CTA_DELTA_MIN_PT,
} from './telemetry/computeBehaviorTrendReviewResult';
export type {
  BehaviorTrendReviewStatus,
  BehaviorTrendLifecycleSnapshot,
  BehaviorTrendReviewResult,
  ComputeBehaviorTrendReviewResultInput,
} from './telemetry/computeBehaviorTrendReviewResult';
