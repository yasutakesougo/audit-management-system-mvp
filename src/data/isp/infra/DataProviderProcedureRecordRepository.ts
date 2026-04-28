import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  washRow,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import type { 
  ProcedureRecordRepository, 
  ProcedureRecordCreateInput, 
  ProcedureRecordUpdateInput 
} from '@/domain/isp/port';
import type { 
  SupportProcedureRecord, 
  ProcedureRecordListItem 
} from '@/domain/isp/schema';
import { 
  PROCEDURE_RECORD_LIST_TITLE, 
  PROCEDURE_RECORD_CANDIDATES, 
  PROCEDURE_RECORD_ESSENTIALS,
  type SpProcedureRecordRow
} from '@/sharepoint/fields/ispThreeLayerFields';
import { 
  mapProcedureRecordRowToDomain, 
  mapProcedureRecordRowToListItem, 
  mapProcedureRecordCreateInputToPayload, 
  mapProcedureRecordUpdateInputToPayload,
  extractSpId
} from '@/data/isp/mapper';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

const warnedEssentialMissing = new Set<string>();

/** @internal - For testing only */
export function __resetProcedureRecordWarningCache(): void {
  warnedEssentialMissing.clear();
}

/**
 * DataProviderProcedureRecordRepository — 第3層 SupportProcedureRecord_Daily
 */
export class DataProviderProcedureRecordRepository implements ProcedureRecordRepository {
  private resolution: { 
    title: string; 
    fields: Record<string, string | undefined>;
    candidates: Record<string, string[]>;
  } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = PROCEDURE_RECORD_LIST_TITLE
  ) {}

  private async resolveSource() {
    if (this.resolution) return this.resolution;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const candidates = PROCEDURE_RECORD_CANDIDATES as unknown as Record<string, string[]>;
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, candidates);

      const isHealthy = areEssentialFieldsResolved(resolved, PROCEDURE_RECORD_ESSENTIALS as unknown as string[]);
      
      reportResourceResolution({
        resourceName: 'ProcedureRecord',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: PROCEDURE_RECORD_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy && !warnedEssentialMissing.has(this.listTitle)) {
        warnedEssentialMissing.add(this.listTitle);
        console.warn(`[DataProviderProcedureRecordRepository] Essential fields missing in ${this.listTitle}.`);
      }

      this.resolution = { 
        title: this.listTitle, 
        fields: resolved as Record<string, string | undefined>,
        candidates
      };
      return this.resolution;
    } catch (error) {
      reportResourceResolution({
        resourceName: 'ProcedureRecord',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: PROCEDURE_RECORD_ESSENTIALS as unknown as string[],
        error: String(error)
      });
      throw error;
    }
  }

  async getById(id: string): Promise<SupportProcedureRecord | null> {
    const numericId = extractSpId(id);
    if (numericId === null) return null;

    const { title, fields, candidates } = await this.resolveSource();
    try {
      const row = await this.provider.getItemById<SpProcedureRecordRow>(title, numericId);
      if (!row) return null;

      const washed = washRow(row as unknown as Record<string, unknown>, candidates, fields) as unknown as SpProcedureRecordRow;
      return mapProcedureRecordRowToDomain(washed);
    } catch (error) {
      console.error(`[DataProviderProcedureRecordRepository] Failed to getById: ${id}`, error);
      return null;
    }
  }

  async listByPlanningSheet(planningSheetId: string): Promise<ProcedureRecordListItem[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const sheetField = fields.planningSheetId || 'PlanningSheetId';
    
    // OData 文字列のエスケープ処理
    const escapedSheetId = planningSheetId.replace(/'/g, "''");

    const rows = await this.provider.listItems<SpProcedureRecordRow>(title, {
      filter: `${sheetField} eq '${escapedSheetId}'`,
      orderby: 'RecordDate desc, ID desc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpProcedureRecordRow[];
    return washed.map(mapProcedureRecordRowToListItem);
  }

  async listByUserAndDate(userId: string, recordDate: string): Promise<ProcedureRecordListItem[]> {
    const { title, fields, candidates } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    const dateField = fields.recordDate || 'RecordDate';

    const rows = await this.provider.listItems<SpProcedureRecordRow>(title, {
      filter: `${userField} eq '${userId}' and ${dateField} eq '${recordDate}'`,
      orderby: 'TimeSlot asc',
      top: SP_QUERY_LIMITS.default,
    });

    const washed = washRows(rows as unknown as Record<string, unknown>[], candidates, fields) as unknown as SpProcedureRecordRow[];
    return washed.map(mapProcedureRecordRowToListItem);
  }

  async create(input: ProcedureRecordCreateInput): Promise<SupportProcedureRecord> {
    const { title } = await this.resolveSource();
    const payload = mapProcedureRecordCreateInputToPayload(input);
    
    const created = await this.provider.createItem<SpProcedureRecordRow>(title, payload as unknown as Record<string, unknown>);
    
    const refreshed = await this.getById(`sp-${created.Id}`);
    if (!refreshed) throw new Error('[ProcedureRecordRepository] Failed to reload created item');
    return refreshed;
  }

  async update(id: string, input: ProcedureRecordUpdateInput): Promise<SupportProcedureRecord> {
    const numericId = extractSpId(id);
    if (numericId === null) throw new Error(`Invalid ID: ${id}`);

    const { title } = await this.resolveSource();
    const payload = mapProcedureRecordUpdateInputToPayload(input);

    await this.provider.updateItem(title, numericId, payload as unknown as Record<string, unknown>);
    
    const updated = await this.getById(id);
    if (!updated) throw new Error(`[ProcedureRecordRepository] Failed to reload updated item: ${id}`);
    return updated;
  }
}
