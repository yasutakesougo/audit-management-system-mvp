import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { areEssentialFieldsResolved, resolveInternalNamesDetailed } from '@/lib/sp/helpers';

type FieldStatus = {
  resolvedName?: string;
  candidates: string[];
  isDrifted: boolean;
  isSilent: boolean;
};

export type AttendanceResolvedSchema<TKey extends string> = {
  listTitle: string;
  mapping: Partial<Record<TKey, string>>;
  select: readonly string[];
  missing: readonly TKey[];
  fieldStatus: Record<TKey, FieldStatus>;
};

type ProbeResult<TKey extends string> = {
  mapping: Partial<Record<TKey, string>> | null;
  missingFields: TKey[];
  select: readonly string[];
  fieldStatus: Record<TKey, FieldStatus>;
};

type AttendanceSchemaResolverParams<TKey extends string> = {
  provider: IDataProvider;
  listTitle: string;
  listTitleFallbacks?: readonly string[];
  candidates: Record<TKey, readonly string[]>;
  essentials: readonly TKey[];
  logCategory: string;
  schemaName: string;
  onDrift?: (listTitle: string, fieldName: TKey, resolutionType: string, driftType: string) => void;
};

const normalizeListKey = (value: string): string =>
  value.toLowerCase().replace(/[\s_\-\u3000]+/gu, '');

const buildListTitleCandidates = (primary: string, fallbacks: readonly string[] = []): string[] => {
  const values = [primary, ...fallbacks]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
};

const tokenizeForSuggestion = (values: readonly string[]): string[] => {
  const tokens = values
    .flatMap((value) => value.split(/[\s_\-\u3000]+/gu))
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 3);
  return [...new Set(tokens)];
};

const suggestListTitles = (titles: string[], requested: string, tried: string[]): string[] => {
  const requestedKey = normalizeListKey(requested);
  const triedKeys = new Set(tried.map(normalizeListKey));
  const tokens = tokenizeForSuggestion([requested, ...tried]);

  return titles
    .filter((title) => !triedKeys.has(normalizeListKey(title)))
    .map((title) => {
      const normalized = normalizeListKey(title);
      let score = 0;

      if (requestedKey && (normalized.includes(requestedKey) || requestedKey.includes(normalized))) {
        score += 6;
      }
      for (const token of tokens) {
        if (title.toLowerCase().includes(token)) score += 2;
      }
      return { title, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8)
    .map((entry) => entry.title);
};

export class AttendanceSchemaResolver<TKey extends string> {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly candidates: Record<TKey, readonly string[]>;
  private readonly essentials: readonly TKey[];
  private readonly listTitleCandidates: string[];
  private readonly logCategory: string;
  private readonly schemaName: string;
  private readonly onDrift?: (listTitle: string, fieldName: TKey, resolutionType: string, driftType: string) => void;

  private resolvedSchema: AttendanceResolvedSchema<TKey> | null = null;
  private resolutionFailed = false;
  private resolvingPromise: Promise<AttendanceResolvedSchema<TKey> | null> | null = null;

  constructor(params: AttendanceSchemaResolverParams<TKey>) {
    this.provider = params.provider;
    this.listTitle = params.listTitle;
    this.candidates = params.candidates;
    this.essentials = params.essentials;
    this.logCategory = params.logCategory;
    this.schemaName = params.schemaName;
    this.onDrift = params.onDrift;
    this.listTitleCandidates = buildListTitleCandidates(params.listTitle, params.listTitleFallbacks);
  }

  public reset(): void {
    this.resolvedSchema = null;
    this.resolutionFailed = false;
    this.resolvingPromise = null;
  }

  public async resolve(): Promise<AttendanceResolvedSchema<TKey> | null> {
    if (this.resolvedSchema) return this.resolvedSchema;
    if (this.resolutionFailed) return null;
    if (this.resolvingPromise) return this.resolvingPromise;

    this.resolvingPromise = this.resolveInternal();
    try {
      return await this.resolvingPromise;
    } finally {
      this.resolvingPromise = null;
    }
  }

  private async resolveInternal(): Promise<AttendanceResolvedSchema<TKey> | null> {
    const availableTitles = await this.getAvailableListTitles();

    if (availableTitles) {
      const titleLookup = new Map<string, string>();
      const schemaMismatches: Array<{ title: string; missingFields: string[] }> = [];

      for (const title of availableTitles) {
        titleLookup.set(title.toLowerCase(), title);
        titleLookup.set(normalizeListKey(title), title);
      }

      for (const candidate of this.listTitleCandidates) {
        const matched =
          titleLookup.get(candidate.toLowerCase()) ?? titleLookup.get(normalizeListKey(candidate));
        if (!matched) continue;

        const probed = await this.probeSchema(matched);
        if (!probed.mapping) {
          schemaMismatches.push({
            title: matched,
            missingFields: probed.missingFields.map(String),
          });
          continue;
        }

        this.resolvedSchema = {
          listTitle: matched,
          mapping: probed.mapping,
          select: probed.select,
          missing: probed.missingFields,
          fieldStatus: probed.fieldStatus,
        };
        return this.resolvedSchema;
      }

      this.resolutionFailed = true;
      auditLog.warn(this.logCategory, `${this.schemaName} list not found in catalog or essentials are missing`, {
        requested: this.listTitle,
        tried: this.listTitleCandidates,
        suggestions: suggestListTitles(availableTitles, this.listTitle, this.listTitleCandidates),
        schemaMismatches: schemaMismatches.slice(0, 8),
      });
      return null;
    }

    // Fallback: direct probe when catalog API is unavailable.
    for (const candidate of this.listTitleCandidates) {
      const probed = await this.probeSchema(candidate);
      if (!probed.mapping) continue;

      this.resolvedSchema = {
        listTitle: candidate,
        mapping: probed.mapping,
        select: probed.select,
        missing: probed.missingFields,
        fieldStatus: probed.fieldStatus,
      };
      return this.resolvedSchema;
    }

    this.resolutionFailed = true;
    return null;
  }

  private async getAvailableListTitles(): Promise<string[] | null> {
    try {
      const raw = await this.provider.getResourceNames();
      const normalized = raw
        .map((title) => title.trim())
        .filter((title) => title.length > 0);
      return [...new Set(normalized)];
    } catch (error) {
      auditLog.warn(this.logCategory, `${this.schemaName} catalog resolution failed. Falling back to direct probes.`, {
        error: String(error),
      });
      return null;
    }
  }

  private async getListFieldNames(listTitle: string): Promise<Set<string> | null> {
    try {
      return await this.provider.getFieldInternalNames(listTitle);
    } catch (error) {
      auditLog.debug(this.logCategory, `${this.schemaName} field probe skipped`, {
        listTitle,
        error: String(error),
      });
      return null;
    }
  }

  private buildBestEffortMapping(resolved: Record<TKey, string | undefined>): Partial<Record<TKey, string>> {
    const mapping: Partial<Record<TKey, string>> = {};
    const entries = Object.entries(this.candidates) as Array<[TKey, readonly string[]]>;
    for (const [key, fieldCandidates] of entries) {
      mapping[key] = resolved[key] ?? fieldCandidates[0];
    }
    return mapping;
  }

  private buildEmptyFieldStatus(): Record<TKey, FieldStatus> {
    const status = {} as Record<TKey, FieldStatus>;
    const entries = Object.entries(this.candidates) as Array<[TKey, readonly string[]]>;
    for (const [key, fieldCandidates] of entries) {
      status[key] = {
        candidates: [...fieldCandidates],
        isDrifted: false,
        isSilent: !this.essentials.includes(key),
      };
    }
    return status;
  }

  private async probeSchema(listTitle: string): Promise<ProbeResult<TKey>> {
    const names = await this.getListFieldNames(listTitle);
    if (!names) {
      return {
        mapping: null,
        missingFields: [],
        select: [],
        fieldStatus: this.buildEmptyFieldStatus(),
      };
    }

    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      names,
      this.candidates as unknown as Record<TKey, string[]>,
      this.onDrift
        ? {
            onDrift: (fieldName, resolutionType, driftType) => {
              this.onDrift?.(listTitle, fieldName as TKey, resolutionType, driftType);
            },
          }
        : undefined,
    );

    const isHealthy = areEssentialFieldsResolved(
      resolved as Record<TKey, string | undefined>,
      [...this.essentials],
    );
    const typedFieldStatus = Object.fromEntries(
      Object.entries(fieldStatus).map(([key, status]) => [
        key,
        {
          ...(status as any),
          isSilent: !this.essentials.includes(key as TKey),
        },
      ]),
    ) as Record<TKey, FieldStatus>;
    if (!isHealthy) {
      return { mapping: null, missingFields: missing, select: [], fieldStatus: typedFieldStatus };
    }

    const optionalMissing = missing.filter((field) => !this.essentials.includes(field));
    if (optionalMissing.length > 0) {
      auditLog.warn(this.logCategory, `${this.schemaName} optional fields are missing (WARN)`, {
        listTitle,
        missing: optionalMissing,
      });
    }

    const drifted = (Object.entries(typedFieldStatus) as Array<[string, FieldStatus]>)
      .filter(([, status]) => status.isDrifted)
      .map(([field, status]) => `${field}:${status.resolvedName ?? 'unknown'}`);
    if (drifted.length > 0) {
      auditLog.warn(this.logCategory, `${this.schemaName} field drift detected`, {
        listTitle,
        drifted,
      });
    }

    return {
      mapping: this.buildBestEffortMapping(resolved as Record<TKey, string | undefined>),
      missingFields: missing,
      select: Array.from(
        new Set([
          'Id',
          ...Object.values(resolved).filter((name): name is string => Boolean(name)),
        ]),
      ),
      fieldStatus: typedFieldStatus,
    };
  }
}
