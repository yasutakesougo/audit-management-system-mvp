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
