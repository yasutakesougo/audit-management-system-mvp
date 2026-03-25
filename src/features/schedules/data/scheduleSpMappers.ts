/**
 * Schedule SharePoint Types and Mappers
 *
 * Contains type definitions for SharePoint schedule data shapes and
 * pure mapper functions for converting between SP and domain representations.
 *
 * @module features/schedules/data/scheduleSpMappers
 */

import type { ScheduleCategory, ScheduleStatus } from '@/features/schedules/domain/types';
import type { RepoSchedule } from '@/infra/sharepoint/repos/schedulesRepo';

import type { SchedItem, SchedulesPort } from './port';
import { getSchedulesListTitle, SCHEDULES_FIELDS } from './spSchema';

// ============================================================================
// Type Definitions
// ============================================================================

export type ListRangeFn = (range: import('./port').DateRange) => Promise<SchedItem[]>;

export type SharePointSchedulesPortOptions = {
  acquireToken?: () => Promise<string | null>;
  listRange?: ListRangeFn;
  create?: SchedulesPort['create'];
  update?: SchedulesPort['update'];
  remove?: SchedulesPort['remove'];
  // Phase 1: Current user's ownerUserId for visibility filtering
  currentOwnerUserId?: string;
};

export type SharePointResponse<T> = {
  value?: T[];
};

export type ScheduleFieldNames = {
  title: string;
  start: string;
  end: string;
  serviceType?: string;
  locationName?: string;
};

export type ListFieldMeta = {
  internalName: string;
  type: string;
  required: boolean;
  choices?: string[];
};

// ============================================================================
// Field Resolution
// ============================================================================

export const resolveScheduleFieldNames = (): ScheduleFieldNames => {
  const listTitle = getSchedulesListTitle().trim().toLowerCase();
  if (listTitle === 'dailyopssignals') {
    return {
      title: 'Title',
      start: 'date',
      end: 'date',
    };
  }

  return {
    title: SCHEDULES_FIELDS.title,
    start: SCHEDULES_FIELDS.start,
    end: SCHEDULES_FIELDS.end,
    serviceType: SCHEDULES_FIELDS.serviceType,
    locationName: SCHEDULES_FIELDS.locationName,
  };
};

export const compact = (values: Array<string | undefined>): string[] =>
  values.filter((value): value is string => Boolean(value));

export const buildSelectSets = () => {
  const fields = resolveScheduleFieldNames();
  const required = compact(['Id', fields.title, fields.start, fields.end]);
  // ScheduleEvents (BaseTemplate=106) only has basic event fields
  const optional = compact([
    fields.serviceType,
    fields.locationName,
    'AssignedStaff',
    'AssignedStaffId',
    'Vehicle',
    'VehicleId',
    'Created',
    'Modified',
  ]);
  const eventSafe = compact([
    'Id',
    fields.title,
    fields.start,
    fields.end,
    fields.locationName,
    fields.serviceType,
    'AssignedStaff',
    'AssignedStaffId',
    'Vehicle',
    'VehicleId',
  ]);
  const mergeSelectFields = (fallbackOnly: boolean): readonly string[] =>
    fallbackOnly ? [...required] : [...new Set([...required, ...optional])];
  const essentialService = compact([...required, fields.serviceType]);
  const selectVariants = [mergeSelectFields(false), essentialService, mergeSelectFields(true)] as const;

  return {
    fields,
    required,
    eventSafe,
    selectVariants,
  };
};

// ============================================================================
// Mappers
// ============================================================================

/**
 * Helper: Map RepoSchedule → SchedItem
 * Bridges repo layer (internal names) to port layer (domain types)
 */
export const mapRepoScheduleToSchedItem = (repo: RepoSchedule): SchedItem | null => {
  try {
    return {
      id: String(repo.id),
      etag: repo.etag ?? '',
      title: repo.title,
      start: repo.eventDate,
      end: repo.endDate,
      category: repo.personType as ScheduleCategory,
      userId: repo.personId || undefined,
      userName: repo.personName,
      assignedStaffId: repo.assignedStaffId,
      vehicleId: repo.vehicleId,
      status: repo.status as ScheduleStatus | undefined,
      serviceType: repo.serviceType,
      notes: repo.note,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      source: 'sharepoint' as const,
    };
  } catch (err) {
    console.error('[mapRepoScheduleToSchedItem] Failed to map:', err, repo);
    return null;
  }
};

/**
 * Helper: Generate rowKey for new schedule
 * Format: YYYYMMDD-HHMMSS-randomId (or use input-provided rowKey)
 */
export const generateRowKey = (input?: string): string => {
  if (input) return input;
  const now = new Date();
  const date = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}${random}`;
};

// ============================================================================
// Sort Utility
// ============================================================================

export const sortByStart = (items: SchedItem[]): SchedItem[] =>
  [...items].sort((a, b) => a.start.localeCompare(b.start));
