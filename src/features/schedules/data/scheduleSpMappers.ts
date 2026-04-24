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
import { resolveSchedulesListKind, type SchedulesListKind } from './spSchema';

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

export const resolveScheduleFieldVariants = (): ScheduleFieldNames[] => {
  const listKind = resolveSchedulesListKind();
  if (listKind === 'dailyOpsSignals') {
    return [{
      title: 'Title',
      start: 'date',
      end: 'date',
    }];
  }

  // Standard variants to try for any list.
  // Order matters: most modern/preferred first.
  return [
    {
      title: 'Title',
      start: 'EventDate',
      end: 'EndDate',
      serviceType: 'ServiceType',
      locationName: 'Location',
    },
    {
      title: 'Title',
      start: 'Start',
      end: 'End',
      serviceType: 'Category',
      locationName: 'LocationName',
    },
    {
      title: 'Title',
      start: 'date',
      end: 'date',
    },
    {
      title: 'Subject', // Legacy Outlook-style
      start: 'StartDate',
      end: 'EndDate',
    }
  ];
};

export const resolveScheduleFieldNames = (): ScheduleFieldNames => {
  return resolveScheduleFieldVariants()[0];
};

export const compact = (values: Array<string | undefined>): string[] =>
  values.filter((value): value is string => Boolean(value));

export const buildSelectSets = (
  fieldsInput?: ScheduleFieldNames,
  listKindInput?: SchedulesListKind,
) => {
  const listKind = listKindInput ?? resolveSchedulesListKind();
  const fields = fieldsInput ?? resolveScheduleFieldNames();
  const required = [...new Set(compact(['Id', fields.title, fields.start, fields.end]))];
  // Keep optional fields list-title aware to avoid 400 on tenants with narrow schema.
  const optional = listKind === 'scheduleEvents'
    ? compact([
      fields.serviceType,
      fields.locationName,
      'Created',
      'Modified',
    ])
    : compact([
      fields.serviceType,
      fields.locationName,
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
    'Created',
    'Modified',
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
 * Invariant: Identifier Sanitization
 *
 * 境界（インフラ層）での null/空値漏れを 100% 防止するためのガード関数。
 * ドメイン層（ScheduleFull 等）の identifier フィールド（userId, userName）において
 * null は不変条件に反するため、この境界で undefined へ強制変換する。
 */
const sanitizeIdentifier = (val: string | null | undefined): string | undefined => {
  if (!val) return undefined;
  return val;
};

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
      userId: sanitizeIdentifier(repo.personId),
      userName: sanitizeIdentifier(repo.personName),
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
