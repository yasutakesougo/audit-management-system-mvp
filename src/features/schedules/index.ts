// Public API for schedules feature

// Domain layer (types + interfaces)
export * from './domain';

// Repository layer
export {
    getCurrentScheduleRepositoryKind, getScheduleRepository, overrideScheduleRepository,
    resetScheduleRepository, useScheduleRepository, type ScheduleRepositoryFactoryOptions, type ScheduleRepositoryKind
} from './repositoryFactory';
export {
    getAssignmentRepository, useAssignmentRepository, overrideAssignmentRepository, resetAssignmentRepository
} from './assignmentRepositoryFactory';

// Routes
export { default as DayView } from './routes/DayView';
export { default as DevScheduleCreateDialogPage } from './routes/DevScheduleCreateDialogPage';
export { default as MonthPage } from './routes/MonthPage';
export { default as ScheduleCreateDialog } from './components/dialogs/ScheduleCreateDialog';
export { default as WeekPage } from './routes/WeekPage';
export { default as WeekView } from './routes/WeekView';

// Hooks
export { useSchedules } from './hooks/legacy/useSchedules';
export { useScheduleUserOptions } from './hooks/useScheduleUserOptions';
export { useWeekPageRouteState } from './hooks/view-models/useWeekPageRouteState';

// Components
export { ScheduleEmptyHint } from './components/ScheduleEmptyHint';
export { SchedulesHeader } from './components/sections/SchedulesHeader';

// Domain types (SSOT)
export type { CreateScheduleEventInput, InlineScheduleDraft, SchedItem } from './domain';

// Form utilities
export {
    createInitialScheduleFormState, toCreateScheduleInput, validateScheduleForm, type ScheduleFormState,
    type ScheduleUserOption
} from './domain/scheduleFormState';
