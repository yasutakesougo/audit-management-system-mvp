// Public API for schedule feature
export type { ScheduleEvent } from './api/schedulesClient';
export { ScheduleConflictGuideDialog } from './components/ScheduleConflictGuideDialog';
export type { SuggestionAction } from './components/ScheduleConflictGuideDialog';
export { buildConflictIndex } from './conflictChecker';
export { FOCUS_GUARD_MS } from './focusGuard';
export { useAnchoredPeriod } from './hooks/useAnchoredPeriod';
export { useApplyScheduleSuggestion } from './hooks/useApplyScheduleSuggestion';
export type { BaseSchedule, Category } from './types';
export { normalizeToDayStart, pickDateParam } from './dateQuery';
