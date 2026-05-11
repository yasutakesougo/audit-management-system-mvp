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

const warnedEssentialMissing = new Set<string>();

/** @internal - For testing only */
export function __resetPlanningSheetWarningCache(): void {
  warnedEssentialMissing.clear();
}

/**
 * ペイロードキーを物理/ドリフト吸収後の列名に変換し、物理スキーマに存在しない項目をオミットする
 */
function adjustPayloadWithResolvedFields(
  payload: Record<string, unknown>,
  fields: Record<string, string | undefined>
): Record<string, unknown> {
  const adjusted: Record<string, unknown> = {};

  // 論理名と物理名の両方から論理キーへの逆引きマップ
  const toLogicalMap: Record<string, string> = {
    // Physical -> Logical
    Title: 'title',
    UserCode: 'userCode',
    ISPId: 'ispId',
    ISPLookupId: 'ispId',
    TargetScene: 'targetScene',
    Status: 'status',
    VersionNo: 'versionNo',
    IsCurrent: 'isCurrent',
    FormDataJson: 'formDataJson',
    IntakeJson: 'intakeJson',
    AssessmentJson: 'assessmentJson',
    PlanningJson: 'planningJson',
    SupportStartDate: 'supportStartDate',
    MonitoringCycleDays: 'monitoringCycleDays',
    // Logical -> Logical
    title: 'title',
    userCode: 'userCode',
    ispId: 'ispId',
    targetScene: 'targetScene',
    targetDomain: 'targetDomain',
    status: 'status',
    versionNo: 'versionNo',
    isCurrent: 'isCurrent',
    formDataJson: 'formDataJson',
    intakeJson: 'intakeJson',
    assessmentJson: 'assessmentJson',
    planningJson: 'planningJson',
    supportStartDate: 'supportStartDate',
    monitoringCycleDays: 'monitoringCycleDays',
  };

  for (const [key, value] of Object.entries(payload)) {
    const logicalKey = toLogicalMap[key];
    if (logicalKey) {
      const resolvedName = fields[logicalKey];
      if (resolvedName) {
        adjusted[resolvedName] = value;
      } else {
        // 物理スキーマに存在せず、解決もできないフィールドはオミットする
        console.warn(`[DataProviderPlanningSheetRepository] Omit unresolved field from write payload: ${key}`);
      }
    } else {
      // マップされていないフィールドはそのまま通す (Id, Created, または新機能のフィールド)
      adjusted[key] = value;
    }
  }

  return adjusted;
}


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

      if (!isHealthy && !warnedEssentialMissing.has(this.listTitle)) {
        warnedEssentialMissing.add(this.listTitle);
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
    const { title, fields } = await this.resolveSource();
    const payload = mapPlanningSheetCreateInputToPayload(input);
    const adjustedPayload = adjustPayloadWithResolvedFields(payload as unknown as Record<string, unknown>, fields);
    
    const created = await this.provider.createItem<SpPlanningSheetRow>(title, adjustedPayload);
    
    const refreshed = await this.getById(`sp-${created.id}`);
    if (!refreshed) throw new Error('[PlanningSheetRepository] Failed to reload created item');
    return refreshed;
  }

  async update(id: string, input: PlanningSheetUpdateInput): Promise<SupportPlanningSheet> {
    const numericId = extractSpId(id);
    if (numericId === null) throw new Error(`Invalid ID: ${id}`);

    const { title, fields } = await this.resolveSource();
    const payload = mapPlanningSheetUpdateInputToPayload(input);
    const adjustedPayload = adjustPayloadWithResolvedFields(payload as unknown as Record<string, unknown>, fields);

    await this.provider.updateItem(title, numericId, adjustedPayload);
    
    const updated = await this.getById(id);
    if (!updated) throw new Error(`[PlanningSheetRepository] Failed to reload updated item: ${id}`);
    return updated;
  }
}
