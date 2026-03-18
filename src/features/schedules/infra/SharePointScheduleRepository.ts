import { isE2E } from '@/env';
import {
    createSchedule,
    removeSchedule,
    updateSchedule,
    type CreateScheduleInput as RepoCreateInput,
    type RepoSchedule,
    type UpdateScheduleInput as RepoUpdateInput,
} from '@/infra/sharepoint/repos/schedulesRepo';
import { AuthRequiredError, toSafeError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import type { SpFetchFn } from '@/lib/sp';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { mapSpRowToSchedule, parseSpScheduleRows } from '../data/spRowSchema';
import { buildSchedulesRelativeListPath, getSchedulesListTitle } from '../data/spSchema';
import { SCHEDULES_DEBUG } from '../debug';
import type { CreateScheduleInput, DateRange, ScheduleItem, ScheduleRepository, ScheduleRepositoryListParams, ScheduleRepositoryMutationParams, UpdateScheduleInput } from '../domain/ScheduleRepository';
import type { ScheduleCategory, ScheduleServiceType, ScheduleStatus } from '../domain/types';

import { DEFAULT_SP_QUERY_LIMIT, MAX_SP_QUERY_LIMIT } from '@/shared/api/spQueryLimits';

import {
    buildRangeFilter,
    buildSelectSets,
    dayKeyInTz,
    generateRowKey,
    getHttpStatus,
    isMissingFieldError,
    monthKeyInTz,
    sortByStart,
    type ScheduleFieldNames,
    type SharePointResponse,
} from './scheduleSpUtils';

// Re-export timezone helpers for backward compatibility
export { dayKeyInTz, monthKeyInTz } from './scheduleSpUtils';

/**
 * Helper: Map repo schedule to domain ScheduleItem
 */
const mapRepoScheduleToScheduleItem = (repo: RepoSchedule): ScheduleItem | null => {
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
      status: repo.status as ScheduleStatus | undefined,
      serviceType: repo.serviceType,
      notes: repo.note,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      source: 'sharepoint' as const,
    };
  } catch (err) {
    console.error('[SharePointScheduleRepository] Failed to map:', err, repo);
    return null;
  }
};

export type SharePointScheduleRepositoryOptions = {
  acquireToken?: () => Promise<string | null>;
  spFetch?: SpFetchFn;
  listTitle?: string;
  currentOwnerUserId?: string; // For visibility filtering
};

/**
 * SharePoint Schedule Repository
 *
 * Implements ScheduleRepository interface for SharePoint backend.
 * Centralizes all SharePoint communication logic previously scattered
 * across sharePointAdapter.ts and useSchedules.ts.
 *
 * spFetch is injected via constructor for direct REST calls (fetchRange).
 * High-level mutations (create/update/remove) use getClient() for typed operations.
 */
export class SharePointScheduleRepository implements ScheduleRepository {
  private readonly acquireToken: () => Promise<string | null>;
  private readonly spFetch: SpFetchFn;
  private readonly listTitle: string;
  private readonly currentOwnerUserId?: string;
  private client: ReturnType<typeof createSpClient> | null = null;

  constructor(options: SharePointScheduleRepositoryOptions = {}) {
    this.acquireToken = options.acquireToken ?? (async () => null);
    this.listTitle = options.listTitle ?? getSchedulesListTitle();
    this.currentOwnerUserId = options.currentOwnerUserId;

    // spFetch is required for fetchRange (list operations).
    // If not provided, fall back to creating a client internally.
    if (options.spFetch) {
      this.spFetch = options.spFetch;
    } else {
      const { baseUrl } = ensureConfig();
      const fallbackClient = createSpClient(this.acquireToken, baseUrl);
      this.spFetch = fallbackClient.spFetch;
    }
  }

  /**
   * Get or create SPClient (lazy initialization)
   * Used for high-level typed operations (create/update/remove).
   */
  private getClient(): ReturnType<typeof createSpClient> {
    if (!this.client) {
      const { baseUrl } = ensureConfig();
      this.client = createSpClient(this.acquireToken, baseUrl);
    }
    return this.client;
  }

  /**
   * Check if schedules list exists in SharePoint
   * Used for one-time verification at app startup
   */
  async checkListExists(): Promise<boolean> {
    try {
      const spConfig = ensureConfig();
      const baseUrl = spConfig.baseUrl;
      if (!baseUrl) {
        if (SCHEDULES_DEBUG) {
          // eslint-disable-next-line no-console
          console.log('[schedules] [SharePointScheduleRepository] baseUrl is empty (bypass mode), assuming list exists');
        }
        return true;
      }

      const client = this.getClient();
      const metadata = await client.tryGetListMetadata(this.listTitle);
      if (SCHEDULES_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[schedules] [SharePointScheduleRepository] checkListExists metadata:', metadata);
      }
      return Boolean(metadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const is404 = /\b404\b/.test(message) || /Not Found/i.test(message) || /does not exist/i.test(message);

      if (!is404) {
        console.warn('[schedules] [SharePointScheduleRepository] checkListExists encountered non-404 error, propagating:', error);
        throw error;
      }

      console.warn('[schedules] [SharePointScheduleRepository] List existence check confirmed 404:', error);
      return false;
    }
  }

  /**
   * Fetch schedules within date range with fallback queries
   * Uses spFetch (DI) with relative paths.
   */
  private async fetchRange(
    range: DateRange,
    select: readonly string[],
    fields: ScheduleFieldNames,
    options?: { includeOrderby?: boolean; includeFilter?: boolean; top?: number; signal?: AbortSignal }
  ): Promise<ReturnType<typeof parseSpScheduleRows>> {
    if (options?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    const rawTop = options?.top ?? DEFAULT_SP_QUERY_LIMIT;
    const safeTop = Math.min(Math.max(1, rawTop), MAX_SP_QUERY_LIMIT);

    const listPath = buildSchedulesRelativeListPath();
    const params = new URLSearchParams();
    params.set('$top', String(safeTop));
    if (options?.includeOrderby ?? true) {
      params.set('$orderby', `${fields.start} asc,Id asc`);
    }
    if (options?.includeFilter ?? true) {
      params.set('$filter', buildRangeFilter(range, fields));
    }
    params.set('$select', select.join(','));

    const url = `${listPath}?${params.toString()}`;
    // spFetch throws on non-2xx (throwOnError: true by default)
    const response = await this.spFetch(url);

    const payload = (await response.json()) as SharePointResponse<unknown>;
    try {
      return parseSpScheduleRows(payload.value ?? []);
    } catch (parseError) {
      console.error('[SharePointScheduleRepository] Parse failed', {
        url,
        payloadPreview: JSON.stringify(payload).slice(0, 2000),
      });
      throw parseError;
    }
  }

  /**
   * List schedules within date range
   * Implements multi-stage fallback for field compatibility
   */
  async list(params: ScheduleRepositoryListParams & { limit?: number }): Promise<ScheduleItem[]> {
    const { range, signal, limit } = params;

    try {
      const listTitle = this.listTitle.trim().toLowerCase();
      if (listTitle === 'dailyopssignals') {
        if (SCHEDULES_DEBUG) {
          console.warn('[SharePointScheduleRepository] DailyOpsSignals is not a schedules list; skipping fetch.');
        }
        return [];
      }

      const isEventList = listTitle === 'scheduleevents';
      const { fields, eventSafe, required, selectVariants } = buildSelectSets();
      const selectFull = isEventList ? eventSafe : selectVariants[0];
      const selectLite = isEventList ? eventSafe : selectVariants[1];
      const selectMin = isEventList ? required : selectVariants[2];

      const stages = [
        { name: 'full', select: selectFull, keepOrderby: true, keepFilter: true, top: limit ?? DEFAULT_SP_QUERY_LIMIT },
        { name: 'selectLite', select: selectLite, keepOrderby: true, keepFilter: true, top: limit ?? DEFAULT_SP_QUERY_LIMIT },
        { name: 'noOrderby', select: selectLite, keepOrderby: false, keepFilter: true, top: limit ?? DEFAULT_SP_QUERY_LIMIT },
        { name: 'noFilter', select: selectMin, keepOrderby: false, keepFilter: false, top: 1 },
      ] as const;

      const diagnostics: Array<{ stage: string; url: string; status?: number; body?: string }> = [];

      for (const stage of stages) {
        try {
          const rows = await this.fetchRange(range, stage.select, fields, {
            includeOrderby: stage.keepOrderby,
            includeFilter: stage.keepFilter,
            top: stage.top,
            signal,
          });
          if (SCHEDULES_DEBUG) {
            // eslint-disable-next-line no-console
            console.info(`[SharePointScheduleRepository] ✅ stage=${stage.name} succeeded`);
          }

          const allItems = sortByStart(rows.map(mapSpRowToSchedule).filter((item): item is ScheduleItem => Boolean(item)));

          // Visibility filtering
          if (!this.currentOwnerUserId) {
            return allItems.filter(item => !item.visibility || item.visibility === 'org');
          }
          return allItems.filter(item => {
            const visibility = item.visibility ?? 'org';
            if (visibility === 'org') return true;
            if (visibility === 'team') return true;
            if (visibility === 'private') {
              return item.ownerUserId === this.currentOwnerUserId;
            }
            return true;
          });
        } catch (error) {
          const status = getHttpStatus(error);
          const url = (error as { url?: string }).url ?? '';
          const rawBody = (error as { body?: unknown }).body;
          const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody, null, 2);
          diagnostics.push({ stage: stage.name, url, status, body });

          const shouldFallback = isMissingFieldError(error) || status === 400;
          if (!shouldFallback) {
            throw error;
          }
          if (SCHEDULES_DEBUG) {
            console.warn('[SharePointScheduleRepository] Fallback stage failed, retrying with alternate query.', stage, error);
          }
        }
      }

      const detail = diagnostics
        .map((d) => `--- stage=${d.stage} status=${d.status ?? 'unknown'}\nurl=${d.url}\nbody=${d.body ?? ''}`)
        .join('\n');
      throw new Error(`[SharePointScheduleRepository] 400 persisted across fallback stages.\n${detail}`);
    } catch (error) {
      const safe = toSafeError(error instanceof Error ? error : new Error(String(error)));
      const isAuthError = error instanceof AuthRequiredError || safe.code === 'AUTH_REQUIRED' || safe.name === 'AuthRequiredError';
      const userMessage = isAuthError
        ? 'サインインが必要です。右上の「サインイン」からログインしてください。'
        : '予定の取得に失敗しました。時間をおいて再試行してください。';
      throw withUserMessage(safe, userMessage);
    }
  }

  /**
   * Create new schedule
   */
  async create(input: CreateScheduleInput, params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    if (params?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    try {
      const { baseUrl } = ensureConfig();
      // Bypass mutation if baseUrl is missing AND we are not in E2E mode.
      // In E2E, we want to proceed so Playwright can intercept/mock the network layer.
      if (!baseUrl && !isE2E) {
        return {
          id: String(Date.now()),
          etag: '"1"',
          title: input.title,
          start: input.startLocal || new Date().toISOString(),
          end: input.endLocal || new Date(Date.now() + 3600000).toISOString(),
          category: input.category,
          userId: input.userId || undefined,
          userName: input.userName,
          assignedStaffId: input.assignedStaffId,
          status: input.status,
          serviceType: input.serviceType as string,
          notes: input.notes,
          source: 'sharepoint',
        };
      }
      const client = this.getClient();

      const startIso = input.startLocal || new Date().toISOString();
      const endIso = input.endLocal || new Date(Date.now() + 3600000).toISOString();
      const startDate = new Date(startIso);
      const dayKey = dayKeyInTz(startDate);
      const monthKey = monthKeyInTz(startDate);
      const fiscalYear = String(startDate.getFullYear());

      const createPayload: RepoCreateInput = {
        title: input.title,
        start: startIso,
        end: endIso,
        status: input.status,
        serviceType: input.serviceType as ScheduleServiceType | string,
        visibility: input.visibility,
        personType: input.category as 'User' | 'Staff' | 'Org',
        personId: input.userId || '',
        personName: input.userName,
        assignedStaffId: input.assignedStaffId,
        targetUserId: input.targetUserId,
        rowKey: generateRowKey(),
        dayKey,
        monthKey,
        fiscalYear,
        orgAudience: input.orgAudience,
        notes: input.notes,
      };

      const created = await createSchedule(client, createPayload);
      const item = mapRepoScheduleToScheduleItem(created);

      if (!item) {
        throw new Error('Failed to map created schedule');
      }

      return item;
    } catch (e) {
      // Detect 412 Precondition Failed (ETag conflict)
      const status = getHttpStatus(e);
      if (status === 412) {
        const conflictError = new Error('Schedule update conflict (412 Precondition Failed)');
        (conflictError as { status?: number }).status = 412;
        throw conflictError;
      }

      const safeErr = toSafeError(e instanceof Error ? e : new Error(String(e)));
      throw withUserMessage(
        safeErr,
        '予定の作成に失敗しました。時間をおいて再試行してください。'
      );
    }
  }

  /**
   * Update existing schedule
   * Handles 412 Precondition Failed (ETag conflict)
   */
  async update(input: UpdateScheduleInput, params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    if (params?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    try {
      const { baseUrl } = ensureConfig();
      // Bypass mutation if baseUrl is missing AND we are not in E2E mode.
      // In E2E, we want to proceed so Playwright can intercept/mock the network layer.
      if (!baseUrl && !isE2E) {
        return {
          id: input.id,
          etag: '"' + (parseInt(input.etag?.replace(/"/g, '') || '0') + 1) + '"',
          title: input.title,
          start: input.startLocal || new Date().toISOString(),
          end: input.endLocal || new Date(Date.now() + 3600000).toISOString(),
          category: input.category,
          userId: input.userId || undefined,
          userName: input.userName,
          serviceType: input.serviceType as string,
          notes: input.notes,
          status: input.status,
          source: 'sharepoint',
        };
      }
      const client = this.getClient();

      const idNum = Number(input.id);
      if (!Number.isFinite(idNum)) {
        throw new Error(`Invalid schedule ID: ${input.id}`);
      }

      const etag = input.etag;
      if (!etag) {
        throw new Error('Missing etag for update');
      }

      const startDate = new Date(input.startLocal || new Date());
      const dayKey = dayKeyInTz(startDate);
      const monthKey = monthKeyInTz(startDate);

      const updatePayload: RepoUpdateInput = {
        title: input.title,
        start: input.startLocal,
        end: input.endLocal,
        status: input.status,
        serviceType: input.serviceType as ScheduleServiceType | string,
        personType: input.category as 'User' | 'Staff' | 'Org',
        personId: input.userId,
        personName: input.userName,
        assignedStaffId: input.assignedStaffId,
        targetUserId: input.targetUserId,
        dayKey,
        monthKey,
        fiscalYear: String(startDate.getFullYear()),
        orgAudience: input.orgAudience,
        notes: input.notes,
      };

      const updated = await updateSchedule(client, idNum, etag, updatePayload);
      const item = mapRepoScheduleToScheduleItem(updated);

      if (!item) {
        throw new Error('Failed to map updated schedule');
      }

      return item;
    } catch (e) {
      // Detect 412 Precondition Failed (ETag conflict)
      const status = getHttpStatus(e);
      if (status === 412) {
        const conflictError = new Error('Schedule was modified by another user (412 Precondition Failed)');
        (conflictError as { status?: number }).status = 412;
        (conflictError as { id?: string }).id = input.id;
        throw conflictError;
      }

      const safeErr = toSafeError(e instanceof Error ? e : new Error(String(e)));
      throw withUserMessage(
        safeErr,
        '予定の更新に失敗しました。時間をおいて再試行してください。'
      );
    }
  }

  /**
   * Remove schedule by id
   */
  async remove(id: string, params?: ScheduleRepositoryMutationParams): Promise<void> {
    if (params?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    try {
      const { baseUrl } = ensureConfig();
      // Bypass mutation if baseUrl is missing AND we are not in E2E mode.
      if (!baseUrl && !isE2E) {
        return;
      }
      const client = this.getClient();

      const idNum = Number(id);
      if (!Number.isFinite(idNum)) {
        throw new Error(`Invalid schedule ID for delete: ${id}`);
      }

      await removeSchedule(client, idNum);
    } catch (error) {
      // Detect 412
      const status = getHttpStatus(error);
      if (status === 412) {
        const conflictError = new Error('Schedule removal conflict (412 Precondition Failed)');
        (conflictError as { status?: number }).status = 412;
        (conflictError as { id?: string }).id = id;
        throw conflictError;
      }

      throw withUserMessage(
        toSafeError(error instanceof Error ? error : new Error(String(error))),
        '予定の削除に失敗しました。時間をおいて再試行してください。'
      );
    }
  }
}
