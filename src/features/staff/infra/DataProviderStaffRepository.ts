import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  sanitizeEnvValue,
  washRow,
  washRows
} from '@/lib/sp/helpers';
import { emitDriftRecord, type DriftResolutionType, type DriftType } from '@/features/diagnostics/drift/domain/driftLogic';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import {
  STAFF_MASTER_CANDIDATES,
  type StaffRow,
} from '@/sharepoint/fields/staffFields';
import { auditLog } from '@/lib/debugLogger';
import { readEnv } from '@/lib/env';
import type { Staff } from '@/types';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { StaffRepository, StaffRepositoryListParams } from '../domain/StaffRepository';

const DEFAULT_STAFF_LIST_TITLE = 'Staff_Master';

/**
 * DataProviderStaffRepository
 * 
 * IDataProvider based StaffRepository implementation.
 * Supports Dynamic Schema Resolution to prevent 400 Bad Request.
 */
export class DataProviderStaffRepository implements StaffRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly defaultTop: number = 500;

  private resolvedFields: Record<string, string | undefined> | null = null;
  private fieldStatus: Record<string, unknown> | null = null;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
    defaultTop?: number;
  }) {
    this.provider = options.provider;
    this.listTitle = options.listTitle || (sanitizeEnvValue(readEnv('VITE_SP_LIST_STAFF', '')) || DEFAULT_STAFF_LIST_TITLE);
    this.defaultTop = options.defaultTop ?? 500;
  }

  private resolvingPromise: Promise<Record<string, string | undefined> | null> | null = null;

  private async resolveFields(): Promise<Record<string, string | undefined> | null> {
    if (this.resolvedFields) return this.resolvedFields;
    if (this.resolvingPromise) return this.resolvingPromise;

    this.resolvingPromise = (async () => {
      try {
        const fieldDetails = await this.provider.getFieldDetails(this.listTitle);
        const available = new Set(fieldDetails.keys());
        
        const { resolved, fieldStatus } = resolveInternalNamesDetailed(
          available,
          STAFF_MASTER_CANDIDATES as unknown as Record<string, string[]>,
          {
            onDrift: (fieldName, resolutionType, driftType) => {
              emitDriftRecord(this.listTitle, fieldName, resolutionType as DriftResolutionType, driftType as DriftType);
            }
          }
        );

        // Attach resolved type information and detect type mismatches
        const multiChoiceKeys = ['workDays', 'baseWorkingDays', 'certifications'];
        const detailedStatus: Record<string, { resolvedName?: string; resolvedType?: string; candidates: string[]; isSilent?: boolean }> = {};
        let hasTypeMismatch = false;

        for (const [key, status] of Object.entries(fieldStatus)) {
          const actualType = status.resolvedName ? fieldDetails.get(status.resolvedName)?.TypeAsString : undefined;
          detailedStatus[key] = {
            ...status,
            resolvedType: actualType
          };

          // Check for MultiChoice mismatch (if we expect MultiChoice but got Text/Note)
          if (multiChoiceKeys.includes(key) && status.resolvedName && actualType && actualType !== 'MultiChoice') {
            hasTypeMismatch = true;
            auditLog.warn('staff', `Type mismatch detected for ${key}. Expected MultiChoice, got ${actualType}`, { 
              field: status.resolvedName 
            });
          }
        }

        const essentials: string[] = ['id', 'staffId', 'fullName', 'isActive'];
        const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);

        reportResourceResolution({
          resourceName: 'Staff_Master',
          resolvedTitle: this.listTitle,
          fieldStatus: detailedStatus,
          essentials: essentials,
          statusOverride: hasTypeMismatch ? 'schema_mismatch' : undefined
        });

        this.resolvedFields = resolved as Record<string, string | undefined>;
        this.fieldStatus = fieldStatus;

        if (!isHealthy) {
          auditLog.warn('staff', 'Essential fields missing for Staff_Master.', { 
            list: this.listTitle, 
            resolved 
          });
        }

        return this.resolvedFields;
      } catch (err) {
        auditLog.error('staff', 'Field resolution failed:', err);
        return null;
      }
    })();

    return this.resolvingPromise;
  }

  public async getAll(params?: StaffRepositoryListParams): Promise<Staff[]> {
    const top = params?.top ?? this.defaultTop;
    const fields = await this.resolveFields();
    if (!fields) return [];

    const selectFields = [
      'Id', 'Title', 'Modified', 'Created',
      ...Object.values(fields).filter((f): f is string => !!f)
    ].filter((v, i, a) => a.indexOf(v) === i);

    try {
      const items = await this.provider.listItems<StaffRow>(this.listTitle, {
        select: selectFields,
        top: top > 0 ? top : undefined,
      });

      const candidates = STAFF_MASTER_CANDIDATES as unknown as Record<string, string[]>;
      const washed = washRows(items as unknown as Record<string, unknown>[], candidates, fields as Record<string, string | undefined>);

      return washed.map(item => this.toDomain(item as unknown as StaffRow));
    } catch (e) {
      auditLog.error('staff', 'DataProviderStaffRepository.getAll_failed', { error: String(e) });
      return [];
    }
  }

  public async getById(id: number | string, options?: { signal?: AbortSignal }): Promise<Staff | null> {
    const numericId = Number(id);
    const fields = await this.resolveFields();
    if (!fields) return null;

    const selectFields = [
      'Id', 'Title', 'Modified', 'Created',
      ...Object.values(fields).filter((f): f is string => !!f)
    ].filter((v, i, a) => a.indexOf(v) === i);

    try {
      const row = await this.provider.getItemById<StaffRow>(this.listTitle, numericId, {
        select: selectFields,
        signal: options?.signal,
      });

      const candidates = STAFF_MASTER_CANDIDATES as unknown as Record<string, string[]>;
      const washed = washRow(row as unknown as Record<string, unknown>, candidates, fields as Record<string, string | undefined>);

      return this.toDomain(washed as unknown as StaffRow);
    } catch (e) {
      auditLog.error('staff', 'DataProviderStaffRepository.getById_failed', { id, error: String(e) });
      return null;
    }
  }

  public async create(payload: Partial<Staff>): Promise<Staff> {
    const request = await this.toRequest(payload);
    const created = await this.provider.createItem<StaffRow>(this.listTitle, request);
    return this.toDomain(created);
  }

  public async update(id: number | string, payload: Partial<Staff>): Promise<Staff> {
    const numericId = Number(id);
    const request = await this.toRequest(payload);
    await this.provider.updateItem<StaffRow>(this.listTitle, numericId, request);
    const updated = await this.getById(numericId);
    if (!updated) throw new Error('Failed to reload staff after update');
    return updated;
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = Number(id);
    await this.provider.deleteItem(this.listTitle, numericId);
  }

  private toDomain(raw: StaffRow): Staff {
    const record = raw as unknown as Record<string, unknown>;
    
    const get = (key: string): unknown => {
      // washRow will have moved the value to the primary key (logical name)
      return record[key];
    };

    const parseArray = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === 'string') {
        if (val.startsWith('[')) {
          try { return JSON.parse(val); } catch { /* ignore */ }
        }
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    return {
      id: Number(get('id') ?? raw.Id),
      staffId: (get('staffId') as string) || '',
      name: (get('fullName') as string) || '',
      furigana: (get('furigana') as string) || '',
      nameKana: (get('fullNameKana') as string) || '',
      jobTitle: (get('jobTitle') as string) || '',
      employmentType: (get('employmentType') as string) || '',
      rbacRole: (get('rbacRole') as string) || '',
      email: (get('email') as string) || '',
      phone: (get('phone') as string) || '',
      role: (get('role') as string) || '',
      department: (get('department') as string) || '',
      active: (get('isActive') as boolean) ?? true,
      hireDate: (get('hireDate') as string) || undefined,
      resignDate: (get('resignDate') as string) || undefined,
      certifications: parseArray(get('certifications')),
      workDays: parseArray(get('workDays') || get('workDaysText')),
      baseShiftStartTime: (get('baseShiftStartTime') as string) || '',
      baseShiftEndTime: (get('baseShiftEndTime') as string) || '',
      baseWorkingDays: parseArray(get('baseWorkingDays')),
      modified: (get('modified') || raw.Modified) as string,
      created: (get('created') || raw.Created) as string,
    };
  }

  private async toRequest(payload: Partial<Staff>): Promise<Record<string, unknown>> {
    const fields = await this.resolveFields();
    if (!fields) throw new Error('Cannot write without schema resolution');

    const req: Record<string, unknown> = {};
    const map: Record<string, string | undefined> = {
      staffId: fields.staffId,
      name: fields.fullName,
      furigana: fields.furigana,
      nameKana: fields.fullNameKana,
      jobTitle: fields.jobTitle,
      employmentType: fields.employmentType,
      rbacRole: fields.rbacRole,
      email: fields.email,
      phone: fields.phone,
      role: fields.role,
      department: fields.department,
      active: fields.isActive,
      hireDate: fields.hireDate,
      resignDate: fields.resignDate,
      baseShiftStartTime: fields.baseShiftStartTime,
      baseShiftEndTime: fields.baseShiftEndTime,
    };

    // 1. Process standard fields
    for (const [key, field] of Object.entries(map)) {
      if (field && (payload as Record<string, unknown>)[key] !== undefined) {
        req[field] = (payload as Record<string, unknown>)[key];
      }
    }

    // 2. Forced hardening for MultiChoice fields (Issue: Ensure [] even if missing/null/empty)
    const multiChoiceSpec = [
      { key: 'workDays', field: fields.workDays || fields.workDaysText },
      { key: 'baseWorkingDays', field: fields.baseWorkingDays },
      { key: 'certifications', field: fields.certifications },
    ];

    for (const spec of multiChoiceSpec) {
      if (spec.field) {
        const val = (payload as Record<string, unknown>)[spec.key];
        // Ensure [] at minimum, even if the key is missing from payload
        req[spec.field] = val ?? [];
      }
    }

    return req;
  }
}
