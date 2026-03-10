/**
 * Schedule SharePoint Adapter
 *
 * Orchestrates the SchedulesPort implementation by composing helpers from
 * scheduleSpMappers and scheduleSpHelpers. This file only contains the
 * makeSharePointSchedulesPort factory and re-exports.
 *
 * @module features/schedules/data/sharePointAdapter
 */

import type { ScheduleServiceType } from '@/features/schedules/domain/types';
import {
    createSchedule,
    removeSchedule,
    updateSchedule,
    type CreateScheduleInput,
    type UpdateScheduleInput,
} from '@/infra/sharepoint/repos/schedulesRepo';
import { AuthRequiredError, toSafeError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { result } from '@/shared/result';

import type { SchedulesPort } from './port';
import {
    dayKeyInTz,
    defaultListRange,
    getHttpStatus,
    monthKeyInTz,
} from './scheduleSpHelpers';
import {
    generateRowKey,
    mapRepoScheduleToSchedItem,
    type SharePointSchedulesPortOptions,
} from './scheduleSpMappers';

// Re-export public API for backward compatibility
export { dayKeyInTz, getListFieldsMeta, monthKeyInTz } from './scheduleSpHelpers';
export type { ListFieldMeta } from './scheduleSpMappers';

// ============================================================================
// Port Factory
// ============================================================================

export const makeSharePointSchedulesPort = (options?: SharePointSchedulesPortOptions): SchedulesPort => {
  // Create client for mutations if acquireToken is provided
  let client: ReturnType<typeof createSpClient> | null = null;
  if (options?.acquireToken) {
    const { baseUrl } = ensureConfig();
    client = createSpClient(options.acquireToken, baseUrl);
  }

  return {
    async list(range) {
      try {
        // Step 2: Use legacy defaultListRange (already working with SharePoint via fetchSp)
        const allItems = await defaultListRange(range);

        // Phase 1: visibility filtering
        if (!options?.currentOwnerUserId) {
          return allItems.filter(item => !item.visibility || item.visibility === 'org');
        }
        return allItems.filter(item => {
          const visibility = item.visibility ?? 'org';
          if (visibility === 'org') return true;
          if (visibility === 'team') return true; // Phase 1: team = org
          if (visibility === 'private') {
            return item.ownerUserId === options.currentOwnerUserId;
          }
          return true;
        });
      } catch (error) {
        const safe = toSafeError(error instanceof Error ? error : new Error(String(error)));
        const isAuthError = error instanceof AuthRequiredError || safe.code === 'AUTH_REQUIRED' || safe.name === 'AuthRequiredError';
        const userMessage = isAuthError
          ? 'サインインが必要です。右上の「サインイン」からログインしてください。'
          : '予定の取得に失敗しました。時間をおいて再試行してください。';
        throw withUserMessage(safe, userMessage);
      }
    },

    async create(input) {
      if (!client) {
        return result.err({
          kind: 'unknown',
          message: 'SharePoint client not available for create',
        });
      }

      try {
        // Extract start/end ISO strings
        const startIso = input.startLocal || new Date().toISOString();
        const endIso = input.endLocal || new Date(Date.now() + 3600000).toISOString();

        // Parse dates for day/month/fiscal year (use JST timezone to prevent UTC offset bugs)
        const startDate = new Date(startIso);
        const dayKey = dayKeyInTz(startDate); // YYYY-MM-DD in JST
        const monthKey = monthKeyInTz(startDate); // YYYY-MM in JST
        const fiscalYear = String(startDate.getFullYear());

        const createPayload: CreateScheduleInput = {
          title: input.title,
          start: startIso,
          end: endIso,
          status: input.status,
          serviceType: input.serviceType as ScheduleServiceType | string,
          visibility: input.visibility,

          personType: input.category as 'User' | 'Staff' | 'Org',
          personId: input.userId || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personName: (input as any).userName,

          assignedStaffId: input.assignedStaffId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetUserId: (input as any).targetUserId,

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowKey: generateRowKey((input as any).rowKey),
          dayKey,
          monthKey,
          fiscalYear,

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orgAudience: (input as any).orgAudience,
          notes: input.notes,
        };

        const created = await createSchedule(client, createPayload);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = mapRepoScheduleToSchedItem(created as any);

        if (!item) {
          return result.err({ kind: 'unknown', message: 'Failed to map created schedule' });
        }

        return result.ok(item);
      } catch (e) {
        const safeErr = toSafeError(e instanceof Error ? e : new Error(String(e)));
        return result.unknown(safeErr.message || '予定の作成に失敗しました。時間をおいて再試行してください。');
      }
    },

    async update(input) {
      if (!client) {
        return result.err({
          kind: 'unknown',
          message: 'SharePoint client not available for update',
        });
      }

      try {
        const idNum = Number(input.id);
        if (!Number.isFinite(idNum)) {
          return result.err({
            kind: 'unknown',
            message: `Invalid schedule ID: ${input.id}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const etag = (input as any)?.etag;
        if (!etag) {
          return result.validation('Missing etag for update', { field: 'etag' });
        }

        const startDate = new Date(input.startLocal || new Date());
        const dayKey = dayKeyInTz(startDate); // YYYY-MM-DD in JST
        const monthKey = monthKeyInTz(startDate); // YYYY-MM in JST

        const updatePayload: UpdateScheduleInput = {
          title: input.title,
          start: input.startLocal,
          end: input.endLocal,
          status: input.status,
          serviceType: input.serviceType as ScheduleServiceType | string,

          personType: input.category as 'User' | 'Staff' | 'Org',
          personId: input.userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personName: (input as any).userName,

          assignedStaffId: input.assignedStaffId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetUserId: (input as any).targetUserId,

          dayKey,
          monthKey,
          fiscalYear: String(startDate.getFullYear()),

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orgAudience: (input as any).orgAudience,
          notes: input.notes,
        };

        const updated = await updateSchedule(client, idNum, etag, updatePayload);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = mapRepoScheduleToSchedItem(updated as any);

        if (!item) {
          return result.err({ kind: 'unknown', message: 'Failed to map updated schedule' });
        }

        return result.ok(item);
      } catch (e) {
        // Phase 2-2: Detect 412 Precondition Failed (ETag conflict)
        const status = getHttpStatus(e);
        if (status === 412) {
          // Return conflict error for Phase 2-2 UX
          return result.conflict({
            message: 'Schedule was modified by another user (412)',
            op: 'update',
            id: input.id,
          });
        }

        const safeErr = toSafeError(e instanceof Error ? e : new Error(String(e)));
        return result.unknown(safeErr.message || '予定の更新に失敗しました。時間をおいて再試行してください。');
      }
    },

    async remove(eventId: string): Promise<void> {
      if (!client) {
        throw new Error('SharePoint client not available for remove');
      }

      try {
        const idNum = Number(eventId);
        if (!Number.isFinite(idNum)) {
          throw new Error(`Invalid schedule ID for delete: ${eventId}`);
        }

        await removeSchedule(client, idNum);
      } catch (error) {
        throw withUserMessage(
          toSafeError(error instanceof Error ? error : new Error(String(error))),
          '予定の削除に失敗しました。時間をおいて再試行してください。',
        );
      }
    },
  } satisfies SchedulesPort;
};
