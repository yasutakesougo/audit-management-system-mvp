import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved 
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
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

/**
 * DataProviderIspRepository — 第1層 ISP_Master
 * 
 * IDataProvider を使用した ISP Repository 実装。
 * 動的フィールド解決と SharePoint 互換の query 行を行います。
 */
export class DataProviderIspRepository implements IspRepository {
  private resolution: { title: string; fields: Record<string, string | undefined> } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = ISP_MASTER_LIST_TITLE
  ) {}

  private async resolveSource() {
    if (this.resolution) return this.resolution;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, ISP_MASTER_CANDIDATES as unknown as Record<string, string[]>);

      const isHealthy = areEssentialFieldsResolved(resolved, ISP_MASTER_ESSENTIALS as unknown as string[]);
      
      // Observability Store に報告
      reportResourceResolution({
        resourceName: 'ISP_Master',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: ISP_MASTER_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy) {
        console.warn(`[DataProviderIspRepository] Essential fields missing in ${this.listTitle}.`);
      }

      this.resolution = { 
        title: this.listTitle, 
        fields: resolved as Record<string, string | undefined> 
      };
      return this.resolution;
    } catch (error) {
      reportResourceResolution({
        resourceName: 'ISP_Master',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: ISP_MASTER_ESSENTIALS as unknown as string[],
        error: String(error)
      });
      throw error;
    }
  }

  async getById(id: string): Promise<IndividualSupportPlan | null> {
    const numericId = extractSpId(id);
    if (numericId === null) return null;

    const { title } = await this.resolveSource();
    try {
      // DataProvider の getItemById を使用
      const row = await this.provider.getItemById<SpIspMasterRow>(title, numericId);
      return row ? mapIspRowToDomain(row) : null;
    } catch (error) {
      console.error(`[DataProviderIspRepository] Failed to getById: ${id}`, error);
      return null;
    }
  }

  async listByUser(userId: string): Promise<IspListItem[]> {
    const { title, fields } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    
    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${userField} eq '${userId}'`,
      orderby: 'Modified desc',
      top: SP_QUERY_LIMITS.default,
    });

    return rows.map(mapIspRowToListItem);
  }

  async getCurrentByUser(userId: string): Promise<IndividualSupportPlan | null> {
    const { title, fields } = await this.resolveSource();
    const userField = fields.userCode || 'UserCode';
    const isCurrentField = fields.isCurrent || 'IsCurrent';

    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${userField} eq '${userId}' and ${isCurrentField} eq true`,
      top: 1,
    });

    return rows[0] ? mapIspRowToDomain(rows[0]) : null;
  }

  async listAllCurrent(): Promise<IndividualSupportPlan[]> {
    const { title, fields } = await this.resolveSource();
    const isCurrentField = fields.isCurrent || 'IsCurrent';

    const rows = await this.provider.listItems<SpIspMasterRow>(title, {
      filter: `${isCurrentField} eq true`,
      top: SP_QUERY_LIMITS.recommended,
    });

    return rows.map(mapIspRowToDomain);
  }

  async create(input: IspCreateInput): Promise<IndividualSupportPlan> {
    const { title } = await this.resolveSource();
    const payload = mapIspCreateInputToPayload(input);
    
    // createItem は作成されたアイテムを返す
    const created = await this.provider.createItem<SpIspMasterRow>(title, payload as unknown as Record<string, unknown>);
    
    // 作成後のリフレッシュ（Id 等の付与を確認するため）
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
