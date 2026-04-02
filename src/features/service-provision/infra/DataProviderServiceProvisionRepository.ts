import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { 
  SERVICE_PROVISION_CANDIDATES,
} from '@/sharepoint/fields/serviceProvisionFields';
import { buildEq, buildGe, buildLe, joinAnd } from '@/sharepoint/query/builders';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';

import type { ServiceProvisionRepository } from '../domain/ServiceProvisionRepository';
import type { 
  ServiceProvisionRecord, 
  UpsertProvisionInput,
  ServiceProvisionStatus,
  ProvisionSource
} from '../domain/types';
import { makeEntryKey } from '../domain/types';

/**
 * DataProviderServiceProvisionRepository
 * 
 * SharePoint (IDataProvider) をバックエンドとする サービス提供実績レポジトリ。
 * Dynamic Schema Resolution により、列名の表記揺れやサフィックス（Drift）に対応します。
 */
export class DataProviderServiceProvisionRepository implements ServiceProvisionRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private resolvedFields: Record<string, string | undefined> | null = null;
  private resolvingPromise: Promise<Record<string, string | undefined> | null> | null = null;

  constructor(options: { provider: IDataProvider; listTitle?: string }) {
    this.provider = options.provider;
    this.listTitle = options.listTitle || 'ServiceProvisionRecords';
  }

  private async resolveFields(): Promise<Record<string, string | undefined> | null> {
    if (this.resolvedFields) return this.resolvedFields;
    if (this.resolvingPromise) return this.resolvingPromise;

    this.resolvingPromise = (async () => {
      try {
        const available = await this.provider.getFieldInternalNames(this.listTitle);
        const { resolved, fieldStatus } = resolveInternalNamesDetailed(
          available,
          SERVICE_PROVISION_CANDIDATES
        );

        const essentials = ['entryKey', 'userCode', 'recordDate'];
        const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);

        reportResourceResolution({
          resourceName: 'ServiceProvisionRecords',
          resolvedTitle: this.listTitle,
          fieldStatus,
          essentials,
        });

        if (!isHealthy) {
          auditLog.warn('service-provision', 'Essential fields missing for ServiceProvisionRecords', { 
            list: this.listTitle, 
            resolved 
          });
        }

        this.resolvedFields = resolved as Record<string, string | undefined>;
        return this.resolvedFields;
      } catch (err) {
        auditLog.error('service-provision', 'Field resolution failed', { error: String(err) });
        return null;
      }
    })();

    return this.resolvingPromise;
  }

  async getByEntryKey(entryKey: string): Promise<ServiceProvisionRecord | null> {
    const fields = await this.resolveFields();
    if (!fields || !fields.entryKey) return null;

    try {
      const items = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        filter: buildEq(fields.entryKey, entryKey),
        top: 1,
        select: this.getSelectFields(fields),
      });

      if (items.length === 0) return null;
      return this.mapFromSp(items[0], fields);
    } catch (e) {
      auditLog.error('service-provision', 'getByEntryKey_failed', { entryKey, error: String(e) });
      return null;
    }
  }

  async listByDate(recordDateISO: string): Promise<ServiceProvisionRecord[]> {
    const fields = await this.resolveFields();
    if (!fields || !fields.recordDate) return [];

    try {
      const items = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        filter: buildEq(fields.recordDate, recordDateISO),
        top: SP_QUERY_LIMITS.default,
        select: this.getSelectFields(fields),
      });

      return items.map(item => this.mapFromSp(item, fields));
    } catch (e) {
      auditLog.error('service-provision', 'listByDate_failed', { recordDateISO, error: String(e) });
      return [];
    }
  }

  async listByMonth(monthISO: string): Promise<ServiceProvisionRecord[]> {
    const fields = await this.resolveFields();
    if (!fields || !fields.recordDate) return [];

    try {
      const start = `${monthISO}-01`;
      const nextMonth = new Date(monthISO);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const end = nextMonth.toISOString().slice(0, 10);

      const items = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        filter: joinAnd([
          buildGe(fields.recordDate, start),
          buildLe(fields.recordDate, end),
        ]),
        top: 2000,
        select: this.getSelectFields(fields),
      });

      return items.map(item => this.mapFromSp(item, fields)).filter(it => it.recordDateISO.startsWith(monthISO));
    } catch (e) {
      auditLog.error('service-provision', 'listByMonth_failed', { monthISO, error: String(e) });
      return [];
    }
  }

  async upsertByEntryKey(input: UpsertProvisionInput): Promise<ServiceProvisionRecord> {
    const fields = await this.resolveFields();
    if (!fields) throw new Error('Cannot write without schema resolution');

    const entryKey = makeEntryKey(input.userCode, input.recordDateISO);
    const existing = await this.getByEntryKey(entryKey);

    const spData = this.mapToSp(input, fields);

    if (existing) {
      await this.provider.updateItem(this.listTitle, existing.id, spData);
      return { ...existing, ...input };
    } else {
      const payload = {
        ...spData,
        [fields.entryKey as string]: entryKey,
        Title: entryKey, // fallback title
      };
      const created = await this.provider.createItem<Record<string, unknown>>(this.listTitle, payload);
      return this.mapFromSp(created, fields);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private getSelectFields(fields: Record<string, string | undefined>): string[] {
    return [
      'Id', 'Title', 'Modified', 'Created',
      ...Object.values(fields).filter((f): f is string => !!f)
    ].filter((v, i, a) => a.indexOf(v) === i);
  }

  private mapFromSp(item: Record<string, unknown>, fields: Record<string, string | undefined>): ServiceProvisionRecord {
    const get = (key: string) => item[fields[key] || ''] ?? item[key];
    
    return {
      id: Number(item.Id),
      etag: String(item['odata.etag'] || ''),
      entryKey: String(get('entryKey') || ''),
      userCode: String(get('userCode') || ''),
      recordDateISO: this.normalizeDate(get('recordDate')),
      status: (get('status') as ServiceProvisionStatus) || '提供',
      startHHMM: this.parseHHMM(get('startHHMM')),
      endHHMM: this.parseHHMM(get('endHHMM')),
      hasTransport: !!get('hasTransport'),
      hasTransportPickup: !!get('hasTransportPickup'),
      hasTransportDropoff: !!get('hasTransportDropoff'),
      hasMeal: !!get('hasMeal'),
      hasBath: !!get('hasBath'),
      hasExtended: !!get('hasExtended'),
      hasAbsentSupport: !!get('hasAbsentSupport'),
      note: String(get('note') || ''),
      source: (get('source') as ProvisionSource) || 'Unified',
      updatedByUPN: String(get('updatedByUPN') || ''),
    };
  }

  private mapToSp(input: UpsertProvisionInput, fields: Record<string, string | undefined>): Record<string, unknown> {
    const req: Record<string, unknown> = {};
    const mapping: Record<string, unknown> = {
      userCode: input.userCode,
      recordDate: input.recordDateISO,
      status: input.status,
      startHHMM: this.formatHHMM(input.startHHMM),
      endHHMM: this.formatHHMM(input.endHHMM),
      hasTransport: !!input.hasTransport,
      hasTransportPickup: !!input.hasTransportPickup,
      hasTransportDropoff: !!input.hasTransportDropoff,
      hasMeal: !!input.hasMeal,
      hasBath: !!input.hasBath,
      hasExtended: !!input.hasExtended,
      hasAbsentSupport: !!input.hasAbsentSupport,
      note: input.note || '',
      source: input.source || 'Unified',
      updatedByUPN: input.updatedByUPN || '',
    };

    for (const [key, value] of Object.entries(mapping)) {
      const physicalName = fields[key];
      if (physicalName) {
        req[physicalName] = value;
      }
    }
    return req;
  }

  private normalizeDate(val: unknown): string {
    if (typeof val === 'string') return val.slice(0, 10);
    return '';
  }

  private parseHHMM(val: unknown): number | null {
    if (typeof val === 'string') {
      const n = parseInt(val, 10);
      return isNaN(n) ? null : n;
    }
    if (typeof val === 'number') return val;
    return null;
  }

  private formatHHMM(val: number | null | undefined): string | null {
    if (val == null) return null;
    return val.toString().padStart(4, '0');
  }
}
