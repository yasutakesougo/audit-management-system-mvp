// Public API for schedules feature

// Domain layer (types + interfaces)
export * from './domain';

// Repository layer
export {
  getScheduleRepository,
  useScheduleRepository,
  overrideScheduleRepository,
  resetScheduleRepository,
  getCurrentScheduleRepositoryKind,
  type ScheduleRepositoryKind,
  type ScheduleRepositoryFactoryOptions,
} from './repositoryFactory';

// Routes
export { default as ScheduleCreateDialog } from './routes/ScheduleCreateDialog';
export { default as WeekPage } from './routes/WeekPage';
export { default as MonthPage } from './routes/MonthPage';
export { default as WeekView } from './routes/WeekView';
export { default as DayView } from './routes/DayView';
export { default as DevScheduleCreateDialogPage } from './routes/DevScheduleCreateDialogPage';

// Hooks
export { useSchedules } from './hooks/useSchedules';
export { useScheduleUserOptions } from './hooks/useScheduleUserOptions';
export { useWeekPageRouteState } from './hooks/useWeekPageRouteState';

// Components
export { SchedulesHeader } from './components/SchedulesHeader';
export { ScheduleEmptyHint } from './components/ScheduleEmptyHint';

// Legacy data layer (will be deprecated)
export type { CreateScheduleEventInput } from './data';
export { useSchedulesPort } from './data';
export type { SchedItem } from './data';
export type { InlineScheduleDraft } from './data/inlineScheduleDraft';

// Form utilities
export {
  createInitialScheduleFormState,
  validateScheduleForm,
  toCreateScheduleInput,
  type ScheduleFormState,
  type ScheduleUserOption,
} from './domain/scheduleFormState';
