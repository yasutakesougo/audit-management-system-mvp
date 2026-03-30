/* eslint-disable @typescript-eslint/no-explicit-any */
import { toSafeError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import {
    SCHEDULE_CANDIDATES,
    SCHEDULE_ESSENTIALS,
} from '@/sharepoint/fields/scheduleFields';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
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

import {
    buildRangeFilter,
    dayKeyInTz,
    generateRowKey,
    getHttpStatus,
    monthKeyInTz,
    sortByStart,
} from './scheduleSpUtils';

type ResolvedScheduleFields = Record<keyof typeof SCHEDULE_CANDIDATES, string | undefined>;

/**
 * DataProviderScheduleRepository
 * 
 * IDataProvider ベースの ScheduleRepository 実装。
 * SharePoint / InMemory / Dataverse などのバックエンド差異を IDataProvider で吸収しつつ、
 * 従来の柔軟なフィールド解決（Self-Healing/Dynamic Schema）を維持する。
 */
export class DataProviderScheduleRepository implements ScheduleRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly currentOwnerUserId?: string;
  
  private resolvedFields: ResolvedScheduleFields | null = null;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
    currentOwnerUserId?: string;
  }) {
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
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        SCHEDULE_CANDIDATES as any
      );

      const isHealthy = areEssentialFieldsResolved(resolved, SCHEDULE_ESSENTIALS as any);
      
      reportResourceResolution({
        resourceName: 'Schedule',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as any,
        essentials: SCHEDULE_ESSENTIALS as any,
      });

      if (isHealthy) {
        this.resolvedFields = resolved as ResolvedScheduleFields;
        return this.resolvedFields;
      }

      auditLog.warn('schedule:repo', 'Essential fields missing for schedules list.', { 
        list: this.listTitle, 
        resolved 
      });
      return null;
    } catch (err) {
      reportResourceResolution({
        resourceName: 'Schedule',
        resolvedTitle: this.listTitle,
        fieldStatus: {} as any,
        essentials: SCHEDULE_ESSENTIALS as any,
        error: String(err)
      });
      auditLog.error('schedule:repo', 'Field resolution failed:', err);
      return null;
    }
  }

  /**
   * 予定一覧取得
   */
  async list(params: ScheduleRepositoryListParams): Promise<ScheduleItem[]> {
    const { range, signal } = params;

    try {
      const fields = await this.resolveFields();
      if (!fields) return [];

      // 動的 $select 生成
      const selectFields = [
        'Id', 'Created', 'Modified',
        ...Object.values(fields).filter((f): f is string => !!f)
      ].filter((v, i, a) => a.indexOf(v) === i);

      // 動的 $filter 追加 (日付範囲)
      const rangeFilter = buildRangeFilter(range, {
        start: fields.start!,
        end: fields.end!
      });

      const items = await this.provider.listItems<SpScheduleRow>(this.listTitle, {
        select: selectFields,
        filter: rangeFilter,
        top: 5000, // Explicitly large for schedules
        orderby: `${fields.start} asc,Id asc`,
        signal
      });

      const allItems = sortByStart(items.map(mapSpRowToSchedule).filter((item): item is ScheduleItem => !!item));

      // Domain filtering (Visibility)
      return this.applyVisibilityFilter(allItems);
    } catch (err) {
      return this.handleError(err, '予定の取得に失敗しました。');
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
    try {
      const fields = await this.resolveFields();
      if (!fields) throw new Error('Cannot resolve fields for creation');

      const startIso = input.startLocal || new Date().toISOString();
      const endIso = input.endLocal || new Date(Date.now() + 3600000).toISOString();
      const startDate = new Date(startIso);

      // ペイロード構築
      const payload: Record<string, unknown> = {
        [fields.title!]: input.title,
        [fields.start!]: startIso,
        [fields.end!]: endIso,
      };

      if (fields.status && input.status) payload[fields.status] = input.status;
      if (fields.serviceType && input.serviceType) payload[fields.serviceType] = input.serviceType;
      if (fields.visibility && input.visibility) payload[fields.visibility] = input.visibility;
      if (fields.userId && input.userId) payload[fields.userId] = input.userId;
      if (fields.userName && input.userName) payload[fields.userName] = input.userName;
      if (fields.assignedStaffId && input.assignedStaffId) payload[fields.assignedStaffId] = input.assignedStaffId;
      if (fields.notes && input.notes) payload[fields.notes] = input.notes;
      if (fields.locationName && input.locationName) payload[fields.locationName] = input.locationName;

      // インフラ管理用フィールド
      if (fields.rowKey) payload[fields.rowKey] = generateRowKey();
      if (fields.dayKey) payload[fields.dayKey] = dayKeyInTz(startDate);
      if (fields.monthKey) payload[fields.monthKey] = monthKeyInTz(startDate);
      if (fields.fiscalYear) payload[fields.fiscalYear] = String(startDate.getFullYear());

      const created = await this.provider.createItem<SpScheduleRow>(this.listTitle, payload);
      const item = mapSpRowToSchedule(created);
      if (!item) throw new Error('Mapping failed after creation');
      
      return item;
    } catch (err) {
      return this.handleError(err, '予定の作成に失敗しました。');
    }
  }

  /**
   * 予定更新
   */
  async update(input: UpdateScheduleInput, _params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    try {
      const fields = await this.resolveFields();
      if (!fields) throw new Error('Cannot resolve fields for update');

      const startDate = new Date(input.startLocal || new Date());

      const payload: Record<string, unknown> = {};
      if (fields.title) payload[fields.title] = input.title;
      if (fields.start) payload[fields.start] = input.startLocal;
      if (fields.end) payload[fields.end] = input.endLocal;
      if (fields.status && input.status) payload[fields.status] = input.status;
      if (fields.serviceType && input.serviceType) payload[fields.serviceType] = input.serviceType;
      if (fields.userId && input.userId) payload[fields.userId] = input.userId;
      if (fields.userName && input.userName) payload[fields.userName] = input.userName;
      if (fields.assignedStaffId && input.assignedStaffId) payload[fields.assignedStaffId] = input.assignedStaffId;
      if (fields.notes && input.notes) payload[fields.notes] = input.notes;
      if (fields.locationName && input.locationName) payload[fields.locationName] = input.locationName;

      if (fields.dayKey) payload[fields.dayKey] = dayKeyInTz(startDate);
      if (fields.monthKey) payload[fields.monthKey] = monthKeyInTz(startDate);
      if (fields.fiscalYear) payload[fields.fiscalYear] = String(startDate.getFullYear());

      const updated = await this.provider.updateItem<SpScheduleRow>(this.listTitle, input.id, payload, {
        etag: input.etag,
      });
      
      const item = mapSpRowToSchedule(updated);
      if (!item) throw new Error('Mapping failed after update');
      
      return item;
    } catch (err) {
      const status = getHttpStatus(err);
      if (status === 412) {
        throw new Error('予定が別のユーザーによって更新されました。再読み込みしてください。');
      }
      return this.handleError(err, '予定の更新に失敗しました。');
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

  private handleError(err: unknown, _userMessage: string): never {
    const safe = toSafeError(err instanceof Error ? err : new Error(String(err)));
    // IDataProvider 自体が 401/403 などの適切なエラークラスを投げることが期待されるが、
    // ここでは従来の try/catch 互換性を重視。
    throw safe;
  }

  async checkListExists(): Promise<boolean> {
    try {
      const meta = await this.provider.getMetadata(this.listTitle);
      return !!meta;
    } catch {
      return false;
    }
  }
}
