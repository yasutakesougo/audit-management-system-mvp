declare module '@/utils/formatCount' {
  export function formatCount(total: number, filtered?: number): string;
}

declare module '@/ui/components/RecurrenceChip' {
  import type { FC } from 'react';
  export type RecurrenceMeta = { rrule?: string | null; text?: string | null };
  export const RecurrenceChip: FC<{ meta?: RecurrenceMeta | null }>;
  export default RecurrenceChip;
}

declare module '@/features/schedule/AllDayChip' {
  import type { FC } from 'react';
  export const AllDayChip: FC<{ allDay?: boolean }>;
  export default AllDayChip;
}

declare module '@/features/schedule/write' {
  import type { UseSP } from '@/lib/spClient';
  export type UpdateScheduleRequest = {
    id: number;
    etag?: string;
    patch: Record<string, unknown>;
  };
  export async function updateSchedule(sp: UseSP, request: UpdateScheduleRequest): Promise<void>;
}

declare module '@/hooks/useFiltersSync' {
  import type { MutableRefObject } from 'react';
  export type UseFiltersSyncOptions<T> = {
    filters: T;
    debouncedFilters?: T;
    setFilters: (updater: T | ((prev: T) => T)) => void;
    parseFilters?: (params: URLSearchParams, prev: T) => T;
    buildSearchParams?: (filters: T) => URLSearchParams;
    normalizeFilters?: (filters: T) => T;
  };
  export function useFiltersSync<T>(options: UseFiltersSyncOptions<T>): {
    hydratingRef: MutableRefObject<boolean>;
  };
}

declare module '@/utils/filters' {
  export function buildSearchParams<T extends Record<string, unknown>>(input: T): URLSearchParams;
  export function normalizeFilters<T>(input: T): T;
}

declare module '@/utils/range' {
  export function normalizeRange(from?: string | null, to?: string | null): { from: string; to: string };
}


declare module '@/features/schedule/views/UserTab' {
  import type { FC } from 'react';
  const UserTab: FC<Record<string, unknown>>;
  export default UserTab;
}

declare module '@/features/schedule/views/OrgTab' {
  import type { FC } from 'react';
  const OrgTab: FC<Record<string, unknown>>;
  export default OrgTab;
}

declare module '@/features/schedule/views/StaffTab' {
  import type { FC } from 'react';
  const StaffTab: FC<Record<string, unknown>>;
  export default StaffTab;
}

declare module '@/features/schedule/components/BriefingPanel' {
  import type { FC } from 'react';
  const BriefingPanel: FC<Record<string, unknown>>;
  export default BriefingPanel;
}

declare module '@/features/schedule/dateutils.local' {
  export function getLocalDateKey(input: Date | string, timeZone?: string): string;
  export function getLocalDateMonthKey(input: Date | string, timeZone?: string): string;
  export function startOfDay(input: Date | string, timeZone?: string): Date;
  export function endOfDay(input: Date | string, timeZone?: string): Date;
  export function startOfDayUtc(input: Date | string, timeZone?: string): Date;
  export function endOfDayUtc(input: Date | string, timeZone?: string): Date;
  export function startOfWeekUtc(input: Date | string, timeZone?: string, weekStartsOn?: number): Date;
  export function endOfWeekUtc(input: Date | string, timeZone?: string, weekStartsOn?: number): Date;
  export function assignLocalDateKey<T extends {
    start?: string | null;
    end?: string | null;
    startLocal?: string | null;
    endLocal?: string | null;
  }>(item: T, timeZone?: string): T & {
    localDateKey: string;
  };
}

declare module '@/features/schedule/move' {
  import type { Schedule } from '@/features/schedule/types';
  export function moveScheduleToDay(schedule: Schedule, day: string): Schedule;
}

declare module '@/features/schedule/workPattern' {
  import type { BaseShiftWarning } from '@/features/schedule/types';
  import type { Schedule } from '@/features/schedule/types';
  import type { Staff } from '@/types';
  export type StaffPatternIndex = Record<string, {
    staffId: string;
    staffName?: string;
    workDays?: string[];
    baseWorkingDays?: string[];
  }>;
  export function summarizeBaseShiftWarnings(warnings?: BaseShiftWarning[]): string;
  export function collectBaseShiftWarnings(schedule: Schedule, index?: StaffPatternIndex | null): BaseShiftWarning[];
  export function buildStaffPatternIndex(staff: Staff[] | null | undefined): StaffPatternIndex | null;
}

declare module '@/features/schedule/presenters/format' {
  type ScheduleLike = {
    start?: string | null;
    end?: string | null;
    startLocal?: string | null;
    endLocal?: string | null;
    startUtc?: string | null;
    endUtc?: string | null;
    audience?: string[] | null;
    targetUserNames?: string[] | null;
    location?: string | null;
  };
  export function formatOrgSubtitle(schedule: ScheduleLike): string;
}

declare module '../dateutils.local' {
  export * from '@/features/schedule/dateutils.local';
}

declare module '../workPattern' {
  export * from '@/features/schedule/workPattern';
}

declare module '../presenters/format' {
  export * from '@/features/schedule/presenters/format';
}

declare module '@/features/users/attendance' {
  export function normalizeAttendanceDays(input: unknown): string[];
}

declare module '@/lib/msalMock' {
  export function initMsalMock(app?: unknown): void;
  export function resetMsalMockSignal(): void;
}

declare module '@/e2e/hooks' {
  export function publishMsalMock(app?: unknown): void;
}

declare module '../auth/msalMock' {
  export function initMsalMock(): void;
  export function resetMsalMockSignal(): void;
}

declare module '../e2e/hooks' {
  export function publishMsalMock(app?: unknown): void;
}

declare module '@fluentui/react' {
  import type { FC, ReactNode } from 'react';
  export enum MessageBarType {
    info = 0,
    warning = 1,
    error = 2,
    severeWarning = 3,
    success = 4,
  }
  export const MessageBar: FC<{
    messageBarType?: MessageBarType;
    children?: ReactNode;
    isMultiline?: boolean;
    styles?: { root?: Record<string, unknown> };
    role?: string;
  }>;
}
