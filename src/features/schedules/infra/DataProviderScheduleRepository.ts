import { toSafeError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import {
  SCHEDULE_EVENTS_CANDIDATES,
  SCHEDULE_EVENTS_ESSENTIALS,
  SCHEDULE_EXTENSIONS,
} from '@/sharepoint/fields/scheduleFields';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  washRow,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution, useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { summarizeSpError } from '@/lib/errors';
import { mapSpRowToSchedule, type SpScheduleRow } from '../data/spRowSchema';
import { getSchedulesListTitle } from '../data/spSchema';
import type { 
  CreateScheduleInput, 
  ScheduleItem, 
  ScheduleRepository, 
  ScheduleRepositoryListParams, 
  ScheduleRepositoryMutationParams, 
  UpdateScheduleInput 
} from '../domain/ScheduleRepository';

import { BaseRepository } from '@/lib/data/BaseRepository';
import {
    buildRangeFilter,
    dayKeyInTz,
    generateRowKey,
    getHttpStatus,
    monthKeyInTz,
    sortByStart,
} from './scheduleSpUtils';

type ScheduleCandidateKeys = keyof typeof SCHEDULE_EVENTS_CANDIDATES;
type ScheduleExtensionKeys = keyof typeof SCHEDULE_EXTENSIONS;
type AllScheduleKeys = ScheduleCandidateKeys | ScheduleExtensionKeys;

interface ResolvedScheduleFields extends Record<AllScheduleKeys, string | undefined> {
  title: string;
  start: string;
  end: string;
}

/**
 * DataProviderScheduleRepository
 * 
 * IDataProvider ベースの ScheduleRepository 実装。
 * SharePoint / InMemory / Dataverse などのバックエンド差異を IDataProvider で吸収しつつ、
 * 従来の柔軟なフィールド解決（Self-Healing/Dynamic Schema）を維持する。
 */
export class DataProviderScheduleRepository extends BaseRepository implements ScheduleRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly currentOwnerUserId?: string;
  
  private resolvedFields: ResolvedScheduleFields | null = null;
  private allCandidates: Record<string, string[]> = { ...SCHEDULE_EVENTS_CANDIDATES, ...SCHEDULE_EXTENSIONS } as unknown as Record<string, string[]>;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
    currentOwnerUserId?: string;
  }) {
    super();
    this.provider = options.provider;
    this.listTitle = options.listTitle ?? getSchedulesListTitle();
    this.currentOwnerUserId = options.currentOwnerUserId;
  }

  /**
   * フィールド解決（Dynamic Schema Resolution）
   */
  private async resolveFields(): Promise<ResolvedScheduleFields | null> {
    if (this.resolvedFields) return this.resolvedFields;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);

      // 基本候補 + 拡張（Visibility等）を合体して解決
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        this.allCandidates
      );

      // 健康診断は SCHEDULE_EVENTS_CANDIDATES 分のみで行う
      const isHealthy = areEssentialFieldsResolved(resolved, [...SCHEDULE_EVENTS_ESSENTIALS] as string[]);
      
      // Observability への報告（バナーのトリガー）から拡張分を除去し、バナーをクリアする
      const essentialsSet = new Set(SCHEDULE_EVENTS_ESSENTIALS as string[]);
      const stableFieldStatus = Object.fromEntries(
        (Object.keys(SCHEDULE_EVENTS_CANDIDATES) as ScheduleCandidateKeys[]).map(k => [
          k, 
          { 
            ...fieldStatus[k], 
            isSilent: !essentialsSet.has(k) 
          }
        ])
      );

      reportResourceResolution({
        resourceName: 'Schedule',
        resolvedTitle: this.listTitle,
        fieldStatus: stableFieldStatus as Record<string, { resolvedName?: string; candidates: string[]; isSilent: boolean }>,
        essentials: [...SCHEDULE_EVENTS_ESSENTIALS] as string[],
      });

      if (isHealthy) {
        this.resolvedFields = {
          ...resolved,
          title: resolved.title!,
          start: resolved.start!,
          end: resolved.end!,
        } as ResolvedScheduleFields;
        return this.resolvedFields;
      }

      auditLog.warn('schedule:repo', 'Essential fields missing for schedules list.', { 
        list: this.listTitle, 
        resolved 
      });
      return null;
    } catch (err) {
      const { message, httpStatus, sprequestguid } = summarizeSpError(err);
      const currentUser = useDataProviderObservabilityStore.getState().currentUser ?? undefined;

      reportResourceResolution({
        resourceName: 'Schedule',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: [...SCHEDULE_EVENTS_ESSENTIALS] as string[],
        error: message,
        httpStatus,
      });

      auditLog.warn('sp', 'list_read_failed', {
        listKey: 'schedule_events',
        resourceName: 'Schedule',
        httpStatus,
        sprequestguid: sprequestguid ?? undefined,
        currentUser,
      });

      auditLog.error('schedule:repo', 'Field resolution failed:', { error: err, sprequestguid });
      return null;
    }
  }

  /**
   * 予定一覧取得
   */
  async list(params: ScheduleRepositoryListParams): Promise<ScheduleItem[]> {
    const { range, signal } = params;

    let fields: ResolvedScheduleFields | null = null;
    try {
      fields = await this.resolveFields();
      if (!fields) return [];

      // 動的 $select 生成
      const selectFields = [
        'Id', 'Created', 'Modified',
        ...Object.values(fields).filter((f): f is string => typeof f === 'string')
      ].filter((v, i, a) => a.indexOf(v) === i);

      // 動的 $filter 追加 (日付範囲)
      const rangeFilter = buildRangeFilter(range, {
        start: fields.start,
        end: fields.end
      });

      const items = await this.provider.listItems<SpScheduleRow>(this.listTitle, {
        select: selectFields,
        filter: rangeFilter,
        top: 5000, 
        orderby: `${fields.start} asc,Id asc`,
        signal
      });

      // ドリフト対策: row を洗浄してから map する
      const washed = washRows(
        items as unknown as Record<string, unknown>[], 
        this.allCandidates, 
        fields as unknown as Record<string, string | undefined>
      ) as unknown as SpScheduleRow[];
      const mapped = washed.map(row => mapSpRowToSchedule(row)).filter((item): item is ScheduleItem => !!item);
      const allItems = sortByStart(mapped);

      // Domain filtering (Visibility)
      return this.applyVisibilityFilter(allItems);
    } catch (err) {
      return this.handleError(err, '予定の取得に失敗しました。', fields);
    }
  }

  async getById(id: string): Promise<ScheduleItem | null> {
    let fields: ResolvedScheduleFields | null = null;
    try {
      fields = await this.resolveFields();
      if (!fields) return null;

      const row = await this.provider.getItemById<SpScheduleRow>(this.listTitle, id);
      if (!row) return null;

      const washed = washRow(
        row as unknown as Record<string, unknown>, 
        this.allCandidates, 
        fields as unknown as Record<string, string | undefined>
      ) as unknown as SpScheduleRow;
      return mapSpRowToSchedule(washed);
    } catch (err) {
      return this.handleError(err, '予定の取得に失敗しました。', fields);
    }
  }

  private applyVisibilityFilter(items: ScheduleItem[]): ScheduleItem[] {
    if (!this.currentOwnerUserId) {
      return items.filter(item => !item.visibility || item.visibility === 'org');
    }
    return items.filter(item => {
      const v = item.visibility ?? 'org';
      if (v === 'org' || v === 'team') return true;
      if (v === 'private') return item.ownerUserId === this.currentOwnerUserId;
      return true;
    });
  }

  /**
   * 予定作成
   */
  async create(input: CreateScheduleInput, _params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    let fields: ResolvedScheduleFields | null = null;
    try {
      fields = await this.resolveFields();
      if (!fields) throw new Error('Cannot resolve fields for creation');

      // ペイロード構築 (共通ビルダーを使用)
      const payload = this.buildPayload(input, fields);

      // インフラ管理用固有フィールド (作成時のみ)
      if (fields.rowKey) payload[fields.rowKey] = generateRowKey();

      const created = await this.provider.createItem<SpScheduleRow>(this.listTitle, payload);
      const item = mapSpRowToSchedule(created);
      if (!item) throw new Error('Mapping failed after creation');
      
      return item;
    } catch (err) {
      return this.handleError(err, '予定の作成に失敗しました。', fields);
    }
  }

  /**
   * 予定更新
   */
  async update(input: UpdateScheduleInput, _params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    let fields: ResolvedScheduleFields | null = null;
    try {
      fields = await this.resolveFields();
      if (!fields) throw new Error('Cannot resolve fields for update');

      // ペイロード構築 (共通ビルダーを使用)
      const payload = this.buildPayload(input, fields);

      // No-op Guard: 変更がない場合は通信せずに現在の値を返す
      if (Object.keys(payload).length === 0) {
        auditLog.info('schedule:repo', 'No changes detected for update, skipping API call.', { id: input.id });
        const existing = await this.getById(input.id);
        if (!existing) throw new Error('Item not found for no-op return');
        return existing;
      }

      const updated = await this.provider.updateItem<SpScheduleRow>(this.listTitle, input.id, payload, {
        etag: input.etag,
      });
      
      const item = mapSpRowToSchedule(updated);
      if (!item) throw new Error('Mapping failed after update');
      
      return item;
    } catch (err) {
      const status = getHttpStatus(err);
      if (status === 412) {
        throw new Error('予定が別のユーザーによって更新されました (conflict)。最新の情報に更新してから再度お試しください。');
      }
      return this.handleError(err, '予定の更新に失敗しました。', fields);
    }
  }

  /**
   * 予定削除
   */
  async remove(id: string, _params?: ScheduleRepositoryMutationParams): Promise<void> {
    try {
      await this.provider.deleteItem(this.listTitle, id);
    } catch (err) {
      return this.handleError(err, '予定の削除に失敗しました。');
    }
  }

  /**
   * SharePoint 向けの共通ペイロードビルダー
   */
  private buildPayload(
    input: CreateScheduleInput | UpdateScheduleInput,
    fields: ResolvedScheduleFields
  ): Record<string, unknown> {
    // 1. 基本プロパティのマッピング（契約に基づく一括処理）
    // buildMappedPayload は内部で getCaseInsensitiveValue と normalizeClearableValue を使用する
    const payload = this.buildMappedPayload({ 
      input: input as unknown as Record<string, unknown>, 
      mapping: fields as any 
    });
    
    // 2. 特殊ロジックが必要なフィールドの個別処理
    // Title, StartLocal, EndLocal は DTO 名がマッピング定義の論理名と異なる可能性がある、
    // または日付計算が必要なため個別で補完する
    if (input.title !== undefined && fields.title) payload[fields.title] = input.title;
    if (input.startLocal !== undefined && fields.start) payload[fields.start] = input.startLocal;
    if (input.endLocal !== undefined && fields.end) payload[fields.end] = input.endLocal;

    // Auto-calculated Infrastructure Fields (Day/Month keys)
    // Only update if startLocal is provided
    if (input.startLocal) {
      const startDate = new Date(input.startLocal);
      if (!isNaN(startDate.getTime())) {
        if (fields.dayKey) payload[fields.dayKey] = dayKeyInTz(startDate);
        if (fields.monthKey) payload[fields.monthKey] = monthKeyInTz(startDate);
        if (fields.fiscalYear) payload[fields.fiscalYear] = String(startDate.getFullYear());
      }
    }

    return payload;
  }

  private handleError(err: unknown, userMessage: string, fields?: ResolvedScheduleFields | null): never {
    const error = toSafeError(err);
    const { httpStatus, message: spMessage, sprequestguid } = summarizeSpError(err);

    // Silently throw AbortError to avoid noise in logs during navigation/unmount
    const isAbort = error.name === 'AbortError' || 
                   (err as { code?: number | string })?.code === 20 || 
                   (err as { code?: number | string })?.code === 'ABORT_ERR';
    if (isAbort) {
      throw error;
    }
    
    const guid = sprequestguid ? ` [Request ID: ${sprequestguid}]` : '';
    const isThreshold = httpStatus === 500 && (
      spMessage.includes('しきい値') || 
      spMessage.toLowerCase().includes('threshold') ||
      spMessage.includes('5000')
    );

    let enrichedMessage = `${userMessage} (${error.message})${guid}`;
    if (isThreshold) {
      const fieldInfo = fields?.start ? ` (対象列: ${fields.start})` : '';
      enrichedMessage = `${userMessage} (SharePoint リストのしきい値制限 [5000件] に抵触しました${fieldInfo}。インデックス化を確認してください)${guid}`;
    }

    auditLog.error('schedule:repo', enrichedMessage, { 
      error,
      status: httpStatus,
      sprequestguid,
      originalMessage: spMessage,
      listTitle: this.listTitle
    });

    const finalError = new Error(enrichedMessage) as Error & { status?: number; sprequestguid?: string };
    if (httpStatus) finalError.status = httpStatus;
    if (sprequestguid) finalError.sprequestguid = sprequestguid;
    
    throw finalError;
  }
}

