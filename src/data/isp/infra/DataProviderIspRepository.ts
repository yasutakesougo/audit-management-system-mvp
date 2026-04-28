import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  washRow,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution, useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { summarizeSpError } from '@/lib/errors';
import { auditLog } from '@/lib/debugLogger';
import type { 
  IspRepository, 
  IspCreateInput, 
  IspUpdateInput 
} from '@/domain/isp/port';
import type { 
  IndividualSupportPlan, 
  IspListItem 
} from '@/domain/isp/schema';
import { 
  ISP_MASTER_LIST_TITLE, 
  ISP_MASTER_CANDIDATES, 
  ISP_MASTER_ESSENTIALS,
  type SpIspMasterRow
} from '@/sharepoint/fields/ispThreeLayerFields';
import { 
  mapIspRowToDomain, 
  mapIspRowToListItem, 
  mapIspCreateInputToPayload, 
  mapIspUpdateInputToPayload,
  extractSpId
} from '@/data/isp/mapper';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

const warnedEssentialMissing = new Set<string>();

/** @internal - For testing only */
export function __resetIspWarningCache(): void {
  warnedEssentialMissing.clear();
}

/**
 * DataProviderIspRepository — 第1層 ISP_Master
 * 
 * IDataProvider を使用した ISP Repository 実装。
 * 動的フィールド解決と SharePoint 互換の query 行を行います。
 */
export class DataProviderIspRepository implements IspRepository {
  private resolution: { 
    title: string; 
    fields: Record<string, string | undefined>;
    candidates: Record<string, string[]>;
  } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = ISP_MASTER_LIST_TITLE
  ) {}

  private async resolveSource() {
    if (this.resolution) return this.resolution;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const candidates = ISP_MASTER_CANDIDATES as unknown as Record<string, string[]>;
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, candidates);

      const isHealthy = areEssentialFieldsResolved(resolved, ISP_MASTER_ESSENTIALS as unknown as string[]);
      
      // Observability Store に報告
      reportResourceResolution({
        resourceName: 'ISP_Master',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: ISP_MASTER_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy && !warnedEssentialMissing.has(this.listTitle)) {
        warnedEssentialMissing.add(this.listTitle);
        console.warn(`[DataProviderIspRepository] Essential fields missing in ${this.listTitle}.`);
      }

      this.resolution = { 
        title: this.listTitle, 
        fields: resolved as Record<string, string | undefined>,
        candidates
      };
      return this.resolution;
    } catch (error) {
      const { message, httpStatus } = summarizeSpError(error);
      const currentUser = useDataProviderObservabilityStore.getState().currentUser ?? undefined;

      reportResourceResolution({
        resourceName: 'ISP_Master',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: ISP_MASTER_ESSENTIALS as unknown as string[],
        error: message,
        httpStatus,
      });

      auditLog.warn('sp', 'list_read_failed', {
        listKey: 'isp_master',
        resourceName: 'ISP_Master',
        httpStatus,
        currentUser,
      });

      throw error;
    }
  }

  async getById(id: string): Promise<IndividualSupportPlan | null> {
    const numericId = extractSpId(id);
    if (numericId === null) return null;

    const { title, fields, candidates } = await this.resolveSource();
    try {
      const row = await this.provider.getItemById<SpIspMasterRow>(title, numericId);
      if (!row) return null;
      
      // ドリフト対策: row を洗浄してから map する
      const washed = washRow(row as unknown as Record<string, unknown>, candidates, fields) as unknown as SpIspMasterRow;
      return mapIspRowToDomain(washed);
    } catch (error) {
      console.error(`[DataProviderIspRepository] Failed to getById: ${id}`, error);
      return null;
    }
  }

  async listByUser(userId: string): Promise<IspListItem[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    
    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${userField} eq '${userId}'`,
      orderby: 'Modified desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpIspMasterRow[];
    return washed.map(mapIspRowToListItem);
  }

  async listFullByUser(userId: string): Promise<IndividualSupportPlan[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    
    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${userField} eq '${userId}'`,
      orderby: 'Modified desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpIspMasterRow[];
    return washed.map(mapIspRowToDomain);
  }

  async getCurrentByUser(userId: string): Promise<IndividualSupportPlan | null> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    const isCurrentField = fields.isCurrent || 'IsCurrent';

    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${userField} eq '${userId}' and ${isCurrentField} eq true`,
      top: 1,
    });

    if (!rows[0]) return null;
    const washed = washRow(rows[0] as unknown as Record<string, unknown>, candidates, fields) as unknown as SpIspMasterRow;
    return mapIspRowToDomain(washed);
  }

  async listAllCurrent(): Promise<IndividualSupportPlan[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const isCurrentField = fields.isCurrent || 'IsCurrent';

    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${isCurrentField} eq true`,
      top: SP_QUERY_LIMITS.recommended,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpIspMasterRow[];
    return washed.map(mapIspRowToDomain);
  }

  async create(input: IspCreateInput): Promise<IndividualSupportPlan> {
    const { title } = await this.resolveSource();
    const payload = mapIspCreateInputToPayload(input);
    
    const created = await this.provider.createItem<SpIspMasterRow>(title, payload as unknown as Record<string, unknown>);
    return this.getById(`sp-${created.Id}`) as Promise<IndividualSupportPlan>;
  }

  async update(id: string, input: IspUpdateInput): Promise<IndividualSupportPlan> {
    const numericId = extractSpId(id);
    if (numericId === null) throw new Error(`Invalid ID: ${id}`);

    const { title } = await this.resolveSource();
    const payload = mapIspUpdateInputToPayload(input);

    await this.provider.updateItem(title, numericId, payload as unknown as Record<string, unknown>);
    
    const updated = await this.getById(id);
    if (!updated) throw new Error(`Failed to reload updated item: ${id}`);
    return updated;
  }
}
