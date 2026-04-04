import type { SpFetchFn } from '@/lib/sp/spLists';
import { ACTIVITY_DIARY_CANDIDATES, ACTIVITY_DIARY_ESSENTIALS } from '@/sharepoint/fields/activityDiaryFields';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { auditLog } from '@/lib/debugLogger';
import {
  buildListPath,
  buildListTitleCandidates,
  getHttpStatus,
  normalizeListKey,
  suggestListTitles,
} from '../../utils/Helpers';
import type { ADFieldKey, ADMapping } from '../constants';

export class ActivityDiarySchemaResolver {
  private resolvedListPath: string | null = null;
  private resolvedMapping: ADMapping | null = null;
  private resolutionFailed = false;
  private resolvingPromise: Promise<{ listPath: string; mapping: ADMapping } | null> | null = null;

  constructor(
    private readonly spFetch: SpFetchFn,
    private readonly listTitle: string,
  ) {}

  public async resolve(): Promise<{ listPath: string; mapping: ADMapping } | null> {
    if (this.resolvedListPath && this.resolvedMapping) {
      return { listPath: this.resolvedListPath, mapping: this.resolvedMapping };
    }
    if (this.resolutionFailed) return null;
    if (this.resolvingPromise) return this.resolvingPromise;

    this.resolvingPromise = this.resolveInternal();
    try {
      return await this.resolvingPromise;
    } finally {
      this.resolvingPromise = null;
    }
  }

  private async resolveInternal(): Promise<{ listPath: string; mapping: ADMapping } | null> {
    const candidates = buildListTitleCandidates(this.listTitle);
    const availableTitles = await this.getAvailableListTitles();

    if (availableTitles) {
      const titleLookup = new Map<string, string>();
      const schemaMismatches: Array<{ title: string; missingFields: string[] }> = [];

      for (const title of availableTitles) {
        titleLookup.set(title.toLowerCase(), title);
        titleLookup.set(normalizeListKey(title), title);
      }

      for (const candidate of candidates) {
        const matched = titleLookup.get(candidate.toLowerCase()) ?? titleLookup.get(normalizeListKey(candidate));
        if (!matched) continue;

        const listPath = buildListPath(matched);
        const schemaProbe = await this.probeSchema(listPath);
        if (!schemaProbe.mapping) {
          schemaMismatches.push({ title: matched, missingFields: schemaProbe.missingFields });
          continue;
        }

        this.resolvedListPath = listPath;
        this.resolvedMapping = schemaProbe.mapping;
        return { listPath, mapping: schemaProbe.mapping };
      }

      this.resolutionFailed = true;
      auditLog.warn('daily', 'ActivityDiary list not found in list catalog or essential fields are missing', {
        requested: this.listTitle,
        tried: candidates,
        suggestions: suggestListTitles(availableTitles, this.listTitle, candidates),
        schemaMismatches: schemaMismatches.slice(0, 8),
      });
      return null;
    }

    // Fallback: direct probing when list catalog retrieval fails.
    for (const candidate of candidates) {
      const listPath = buildListPath(candidate);
      try {
        const schemaProbe = await this.probeSchema(listPath);
        if (schemaProbe.mapping) {
          this.resolvedListPath = listPath;
          this.resolvedMapping = schemaProbe.mapping;
          return { listPath, mapping: schemaProbe.mapping };
        }
      } catch (error) {
        if (getHttpStatus(error) === 404) continue;
        throw error;
      }
    }

    this.resolutionFailed = true;
    return null;
  }

  private async getAvailableListTitles(): Promise<string[] | null> {
    try {
      const response = await this.spFetch('lists?$select=Title&$top=5000');
      const payload = (await response.json()) as { value?: Array<{ Title?: string }> };
      return (payload.value ?? [])
        .map((item) => item.Title?.trim())
        .filter((title): title is string => Boolean(title));
    } catch (error) {
      if (getHttpStatus(error) === 404) return null;
      throw error;
    }
  }

  private async getListFieldNames(listPath: string): Promise<Set<string> | null> {
    try {
      const response = await this.spFetch(`${listPath}/fields?$select=InternalName&$top=500`);
      const payload = (await response.json()) as { value?: Array<{ InternalName?: string }> };
      return new Set(
        (payload.value ?? [])
          .map((field) => field.InternalName?.trim())
          .filter((name): name is string => Boolean(name)),
      );
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 400 || status === 403 || status === 404) return null;
      throw error;
    }
  }

  private probeBestEffortMapping(resolved: Record<string, string | undefined>): ADMapping {
    const mapping: ADMapping = {};
    const entries = Object.entries(ACTIVITY_DIARY_CANDIDATES) as Array<[ADFieldKey, readonly string[]]>;
    for (const [key, cands] of entries) {
      mapping[key] = resolved[key] ?? cands[0];
    }
    return mapping;
  }

  private async probeSchema(listPath: string): Promise<{ mapping: ADMapping | null; missingFields: string[] }> {
    const names = await this.getListFieldNames(listPath);
    if (!names) return { mapping: null, missingFields: [] };

    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      names,
      ACTIVITY_DIARY_CANDIDATES as unknown as Record<string, string[]>,
    );

    const essentials = ACTIVITY_DIARY_ESSENTIALS as unknown as string[];
    const isHealthy = areEssentialFieldsResolved(
      resolved as Record<string, string | undefined>,
      essentials,
    );
    if (!isHealthy) {
      return { mapping: null, missingFields: missing };
    }

    const drifted = Object.entries(fieldStatus)
      .filter(([, status]) => status.isDrifted)
      .map(([field, status]) => `${field}:${status.resolvedName ?? 'unknown'}`);
    if (drifted.length > 0) {
      auditLog.warn('daily', 'ActivityDiary field drift detected', {
        listPath,
        drifted,
      });
    }

    return {
      mapping: this.probeBestEffortMapping(resolved as Record<string, string | undefined>),
      missingFields: missing,
    };
  }
}
