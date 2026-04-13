import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  washRow,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import type { 
  PlanningSheetRepository, 
  PlanningSheetCreateInput, 
  PlanningSheetUpdateInput 
} from '@/domain/isp/port';
import type { 
  SupportPlanningSheet, 
  PlanningSheetListItem 
} from '@/domain/isp/schema';
import { 
  PLANNING_SHEET_LIST_TITLE, 
  PLANNING_SHEET_CANDIDATES, 
  PLANNING_SHEET_ESSENTIALS,
  type SpPlanningSheetRow
} from '@/sharepoint/fields/ispThreeLayerFields';
import { 
  mapPlanningSheetRowToDomain, 
  mapPlanningSheetRowToListItem, 
  mapPlanningSheetCreateInputToPayload, 
  mapPlanningSheetUpdateInputToPayload,
  extractSpId
} from '@/data/isp/mapper';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

/**
 * DataProviderPlanningSheetRepository — 第2層 SupportPlanningSheet_Master
 */
export class DataProviderPlanningSheetRepository implements PlanningSheetRepository {
  private resolution: { 
    title: string; 
    fields: Record<string, string | undefined>;
    candidates: Record<string, string[]>;
  } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = PLANNING_SHEET_LIST_TITLE
  ) {}

  private async resolveSource() {
    if (this.resolution) return this.resolution;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const candidates = PLANNING_SHEET_CANDIDATES as unknown as Record<string, string[]>;
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, candidates);

      const isHealthy = areEssentialFieldsResolved(resolved, PLANNING_SHEET_ESSENTIALS as unknown as string[]);
      
      reportResourceResolution({
        resourceName: 'PlanningSheet',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: PLANNING_SHEET_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy) {
        console.warn(`[DataProviderPlanningSheetRepository] Essential fields missing in ${this.listTitle}.`);
      }

      this.resolution = { 
        title: this.listTitle, 
        fields: resolved as Record<string, string | undefined>,
        candidates
      };
      return this.resolution;
    } catch (error) {
      reportResourceResolution({
        resourceName: 'PlanningSheet',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: PLANNING_SHEET_ESSENTIALS as unknown as string[],
        error: String(error)
      });
      throw error;
    }
  }

  async getById(id: string): Promise<SupportPlanningSheet | null> {
    const numericId = extractSpId(id);
    if (numericId === null) return null;

    const { title, fields, candidates } = await this.resolveSource();
    try {
      const row = await this.provider.getItemById<SpPlanningSheetRow>(title, numericId);
      if (!row) return null;
      
      const washed = washRow(row as unknown as Record<string, unknown>, candidates, fields) as unknown as SpPlanningSheetRow;
      return mapPlanningSheetRowToDomain(washed);
    } catch (error) {
      console.error(`[DataProviderPlanningSheetRepository] Failed to getById: ${id}`, error);
      return null;
    }
  }

  async listByIsp(ispId: string): Promise<PlanningSheetListItem[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const ispField = fields.ispId || 'ISPId';
    
    // OData 文字列のエスケープ処理
    const escapedIspId = ispId.replace(/'/g, "''");

    const rows = await this.provider.listItems<SpPlanningSheetRow>(title, {
      filter: `${ispField} eq '${escapedIspId}'`,
      orderby: 'Created desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpPlanningSheetRow[];
    return washed.map(mapPlanningSheetRowToListItem);
  }

  async listByUser(userId: string): Promise<PlanningSheetListItem[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';

    const escapedUserId = userId.replace(/'/g, "''");

    const rows = await this.provider.listItems<SpPlanningSheetRow>(title, {
      filter: `${userField} eq '${escapedUserId}'`,
      orderby: 'Created desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpPlanningSheetRow[];
    return washed.map(mapPlanningSheetRowToListItem);
  }

  async listCurrentByUser(userId: string): Promise<PlanningSheetListItem[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    const isCurrentField = fields.isCurrent || 'IsCurrent';

    const rows = await this.provider.listItems<SpPlanningSheetRow>(title, {
      filter: `${userField} eq '${userId}' and ${isCurrentField} eq true`,
      orderby: 'Created desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpPlanningSheetRow[];
    return washed.map(mapPlanningSheetRowToListItem);
  }

  async listBySeries(userId: string, ispId: string): Promise<SupportPlanningSheet[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    const ispField = fields.ispId || 'ISPId';

    const escapedUserId = userId.replace(/'/g, "''");
    const escapedIspId = ispId.replace(/'/g, "''");

    const rows = await this.provider.listItems<SpPlanningSheetRow>(title, {
      filter: `${userField} eq '${escapedUserId}' and ${ispField} eq '${escapedIspId}'`,
      orderby: 'Created desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpPlanningSheetRow[];
    return washed.map(mapPlanningSheetRowToDomain);
  }

  async create(input: PlanningSheetCreateInput): Promise<SupportPlanningSheet> {
    const { title } = await this.resolveSource();
    const payload = mapPlanningSheetCreateInputToPayload(input);
    
    const created = await this.provider.createItem<SpPlanningSheetRow>(title, payload as unknown as Record<string, unknown>);
    
    const refreshed = await this.getById(`sp-${created.Id}`);
    if (!refreshed) throw new Error('[PlanningSheetRepository] Failed to reload created item');
    return refreshed;
  }

  async update(id: string, input: PlanningSheetUpdateInput): Promise<SupportPlanningSheet> {
    const numericId = extractSpId(id);
    if (numericId === null) throw new Error(`Invalid ID: ${id}`);

    const { title } = await this.resolveSource();
    const payload = mapPlanningSheetUpdateInputToPayload(input);

    await this.provider.updateItem(title, numericId, payload as unknown as Record<string, unknown>);
    
    const updated = await this.getById(id);
    if (!updated) throw new Error(`[PlanningSheetRepository] Failed to reload updated item: ${id}`);
    return updated;
  }
}
