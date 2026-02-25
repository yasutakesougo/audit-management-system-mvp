import { toSafeError } from '@/lib/errors';
import { fetchSp } from '@/lib/fetchSp';
import { AuthRequiredError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { SCHEDULES_DEBUG } from '../debug';
import {
  createSchedule,
  updateSchedule,
  removeSchedule,
  type CreateScheduleInput as RepoCreateInput,
  type UpdateScheduleInput as RepoUpdateInput,
} from '@/infra/sharepoint/repos/schedulesRepo';
import type { ScheduleRepository, ScheduleItem, DateRange, CreateScheduleInput, UpdateScheduleInput, ScheduleRepositoryListParams, ScheduleRepositoryMutationParams } from '../domain/ScheduleRepository';
import type { ScheduleCategory, ScheduleStatus, ScheduleServiceType } from '../domain/types';
import { mapSpRowToSchedule, parseSpScheduleRows } from '../data/spRowSchema';
import { getSchedulesListTitle, SCHEDULES_FIELDS, buildSchedulesListPath } from '../data/spSchema';

/**
 * Timezone-aware date key helpers
 * CRITICAL: Always use site timezone (JST) for dayKey/monthKey to prevent UTC offset bugs
 */
const SCHEDULES_TZ = 'Asia/Tokyo';

/**
 * Get date key (YYYY-MM-DD) in site timezone
 */
export function dayKeyInTz(date: Date, timeZone: string = SCHEDULES_TZ): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone }).format(date);
}

/**
 * Get month key (YYYY-MM) in site timezone
 */
export function monthKeyInTz(date: Date, timeZone: string = SCHEDULES_TZ): string {
  const day = dayKeyInTz(date, timeZone);
  return day.slice(0, 7);
}

/**
 * Extract HTTP status code from various error shapes
 * Used for 412 Precondition Failed detection
 */
const getHttpStatus = (e: unknown): number | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = e as any;
  return (
    anyErr?.status ??
    anyErr?.response?.status ??
    anyErr?.response?.statusCode ??
    anyErr?.cause?.status ??
    anyErr?.cause?.response?.status
  );
};

type SharePointResponse<T> = {
  value?: T[];
};

type ScheduleFieldNames = {
  title: string;
  start: string;
  end: string;
  serviceType?: string;
  locationName?: string;
};

const resolveScheduleFieldNames = (): ScheduleFieldNames => {
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

const compact = (values: Array<string | undefined>): string[] =>
  values.filter((value): value is string => Boolean(value));

const buildSelectSets = () => {
  const fields = resolveScheduleFieldNames();
  const required = compact(['Id', fields.title, fields.start, fields.end]);
  const optional = compact([
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

const readSpErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: { value?: string } };
      'odata.error'?: { message?: { value?: string } };
      message?: { value?: string };
    };
    return (
      data.error?.message?.value ??
      data['odata.error']?.message?.value ??
      data.message?.value ??
      ''
    );
  } catch {
    return text.slice(0, 4000);
  }
};

const toIsoWithoutZ = (date: Date): string => {
  const iso = date.toISOString();
  return iso.endsWith('Z') ? iso.slice(0, -1) : iso;
};

const encodeDateLiteral = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date value: ${value}`);
  }
  const iso = new Date(parsed).toISOString();
  const withoutZ = iso.endsWith('Z') ? iso.slice(0, -1) : iso;
  return `datetime'${withoutZ}'`;
};

const buildRangeFilter = (range: DateRange, fields: ScheduleFieldNames): string => {
  // Add ±1 day buffer for timezone/all-day event safety
  const fromBuffer = toIsoWithoutZ(new Date(new Date(range.from).getTime() - 24 * 60 * 60 * 1000));
  const toBuffer = toIsoWithoutZ(new Date(new Date(range.to).getTime() + 24 * 60 * 60 * 1000));
  const fromLiteral = encodeDateLiteral(fromBuffer);
  const toLiteral = encodeDateLiteral(toBuffer);
  return `(${fields.start} lt ${toLiteral}) and (${fields.end} ge ${fromLiteral})`;
};

const isMissingFieldError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? '';
  return /does not exist|cannot find field|存在しません/i.test(message);
};

const sortByStart = (items: ScheduleItem[]): ScheduleItem[] =>
  [...items].sort((a, b) => a.start.localeCompare(b.start));

/**
 * Helper: Map repo schedule to domain ScheduleItem
 */
const mapRepoScheduleToScheduleItem = (repo: {
  id: number;
  etag?: string;
  title: string;
  eventDate: string;
  endDate: string;
  status?: string;
  serviceType?: string;
  personType: string;
  personId: string;
  personName?: string;
  assignedStaffId?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}): ScheduleItem | null => {
  try {
    return {
      id: String(repo.id),
      etag: repo.etag ?? '',
      title: repo.title,
      start: repo.eventDate,
      end: repo.endDate,
      category: repo.personType as ScheduleCategory,
      userId: repo.personId || undefined,
      personName: repo.personName,
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

/**
 * Generate rowKey for new schedule
 */
const generateRowKey = (input?: string): string => {
  if (input) return input;
  const now = new Date();
  const date = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}${random}`;
};

export type SharePointScheduleRepositoryOptions = {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
  currentOwnerUserId?: string; // For visibility filtering
};

/**
 * SharePoint Schedule Repository
 * 
 * Implements ScheduleRepository interface for SharePoint backend.
 * Centralizes all SharePoint communication logic previously scattered
 * across sharePointAdapter.ts and useSchedules.ts.
 */
export class SharePointScheduleRepository implements ScheduleRepository {
  private readonly acquireToken: () => Promise<string | null>;
  private readonly listTitle: string;
  private readonly currentOwnerUserId?: string;
  private client: ReturnType<typeof createSpClient> | null = null;

  constructor(options: SharePointScheduleRepositoryOptions = {}) {
    this.acquireToken = options.acquireToken ?? (async () => null);
    this.listTitle = options.listTitle ?? getSchedulesListTitle();
    this.currentOwnerUserId = options.currentOwnerUserId;
  }

  /**
   * Get or create SPClient (lazy initialization)
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
      if (!baseUrl) return false; // E2E/demo mode

      const client = this.getClient();
      const metadata = await client.tryGetListMetadata(this.listTitle);
      return Boolean(metadata);
    } catch (error) {
      console.error('[SharePointScheduleRepository] List existence check failed:', error);
      return false;
    }
  }

  /**
   * Fetch schedules within date range with fallback queries
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

    const { baseUrl } = ensureConfig();
    const listPath = buildSchedulesListPath(baseUrl);
    const params = new URLSearchParams();
    params.set('$top', String(options?.top ?? 500));
    if (options?.includeOrderby ?? true) {
      params.set('$orderby', `${fields.start} asc,Id asc`);
    }
    if (options?.includeFilter ?? true) {
      params.set('$filter', buildRangeFilter(range, fields));
    }
    params.set('$select', select.join(','));

    const url = `${listPath}?${params.toString()}`;
    const response = await fetchSp(url);
    
    if (!response.ok) {
      const message = await readSpErrorMessage(response);
      console.error('[SharePointScheduleRepository] List query failed', {
        status: response.status,
        listTitle: this.listTitle,
        url,
        message,
      });
      const error = new Error(message || `SharePoint request failed (${response.status})`);
      (error as { status?: number }).status = response.status;
      (error as { url?: string }).url = url;
      (error as { body?: string }).body = message;
      throw error;
    }

    const payload = (await response.json()) as SharePointResponse<unknown>;
    try {
      return parseSpScheduleRows(payload.value ?? []);
    } catch (parseError) {
      console.error('[SharePointScheduleRepository] Parse failed', {
        url,
        status: response.status,
        payloadPreview: JSON.stringify(payload).slice(0, 2000),
      });
      throw parseError;
    }
  }

  /**
   * List schedules within date range
   * Implements multi-stage fallback for field compatibility
   */
  async list(params: ScheduleRepositoryListParams): Promise<ScheduleItem[]> {
    const { range, signal } = params;

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
        { name: 'full', select: selectFull, keepOrderby: true, keepFilter: true, top: 500 },
        { name: 'selectLite', select: selectLite, keepOrderby: true, keepFilter: true, top: 500 },
        { name: 'noOrderby', select: selectLite, keepOrderby: false, keepFilter: true, top: 500 },
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetUserId: (input as any).targetUserId,
        rowKey: generateRowKey(),
        dayKey,
        monthKey,
        fiscalYear,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orgAudience: (input as any).orgAudience,
        notes: input.notes,
      };

      const created = await createSchedule(client, createPayload);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = mapRepoScheduleToScheduleItem(created as any);

      if (!item) {
        throw new Error('Failed to map created schedule');
      }

      return item;
    } catch (e) {
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
      const item = mapRepoScheduleToScheduleItem(updated as any);

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
      const client = this.getClient();
      
      const idNum = Number(id);
      if (!Number.isFinite(idNum)) {
        throw new Error(`Invalid schedule ID for delete: ${id}`);
      }

      await removeSchedule(client, idNum);
    } catch (error) {
      throw withUserMessage(
        toSafeError(error instanceof Error ? error : new Error(String(error))),
        '予定の削除に失敗しました。時間をおいて再試行してください。'
      );
    }
  }
}
