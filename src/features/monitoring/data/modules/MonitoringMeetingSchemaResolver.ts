import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { areEssentialFieldsResolved, resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ESSENTIALS,
  type MonitoringMeetingCandidateKey,
  type MonitoringMeetingFieldMapping,
} from '@/sharepoint/fields/monitoringMeetingFields';

type ResolvedMonitoringMeetingSchema = {
  listTitle: string;
  mapping: MonitoringMeetingFieldMapping;
  select: readonly string[];
};

const MONITORING_MEETING_LIST_FALLBACKS = [
  'MonitoringMeetings',
  'MonitoringMeeting',
  'Monitoring_Meetings',
  'Monitoring_Meeting',
  'モニタリング会議',
  'モニタリング会議記録',
] as const;

const MONITORING_MEETING_SUGGESTION_TOKENS = [
  'monitoring',
  'meeting',
  'モニタリング',
  '会議',
  '記録',
] as const;

const normalizeListKey = (value: string): string =>
  value.toLowerCase().replace(/[\s_\-\u3000]+/gu, '');

const buildListTitleCandidates = (primary: string): string[] => {
  const values = [primary, ...MONITORING_MEETING_LIST_FALLBACKS]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
};

const suggestListTitles = (titles: string[], requested: string, tried: string[]): string[] => {
  const triedSet = new Set(tried.map(normalizeListKey));
  const requestedKey = normalizeListKey(requested);

  return titles
    .filter((title) => !triedSet.has(normalizeListKey(title)))
    .map((title) => {
      const titleKey = normalizeListKey(title);
      let score = 0;

      if (requestedKey && (titleKey.includes(requestedKey) || requestedKey.includes(titleKey))) {
        score += 6;
      }
      for (const token of MONITORING_MEETING_SUGGESTION_TOKENS) {
        if (title.includes(token) || title.toLowerCase().includes(token)) {
          score += 2;
        }
      }
      return { title, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8)
    .map((entry) => entry.title);
};

export class MonitoringMeetingSchemaResolver {
  private resolvedListTitle: string | null = null;
  private resolvedMapping: MonitoringMeetingFieldMapping | null = null;
  private resolvedSelect: readonly string[] | null = null;
  private resolutionFailed = false;
  private resolvingPromise: Promise<ResolvedMonitoringMeetingSchema | null> | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string,
  ) {}

  public reset(): void {
    this.resolvedListTitle = null;
    this.resolvedMapping = null;
    this.resolvedSelect = null;
    this.resolutionFailed = false;
    this.resolvingPromise = null;
  }

  public async resolve(): Promise<ResolvedMonitoringMeetingSchema | null> {
    if (this.resolvedListTitle && this.resolvedMapping && this.resolvedSelect) {
      return { listTitle: this.resolvedListTitle, mapping: this.resolvedMapping, select: this.resolvedSelect };
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

  private async resolveInternal(): Promise<ResolvedMonitoringMeetingSchema | null> {
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

        const schemaProbe = await this.probeSchema(matched);
        if (!schemaProbe.mapping) {
          schemaMismatches.push({ title: matched, missingFields: schemaProbe.missingFields });
          continue;
        }

        this.resolvedListTitle = matched;
        this.resolvedMapping = schemaProbe.mapping;
        this.resolvedSelect = schemaProbe.select;
        return { listTitle: matched, mapping: schemaProbe.mapping, select: schemaProbe.select };
      }

      this.resolutionFailed = true;
      auditLog.warn('monitoring', 'MonitoringMeeting list not found in catalog or essentials are missing', {
        requested: this.listTitle,
        tried: candidates,
        suggestions: suggestListTitles(availableTitles, this.listTitle, candidates),
        schemaMismatches: schemaMismatches.slice(0, 8),
      });
      return null;
    }

    // Fallback: direct probe when catalog API is unavailable.
    for (const candidate of candidates) {
      const schemaProbe = await this.probeSchema(candidate);
      if (!schemaProbe.mapping) continue;

      this.resolvedListTitle = candidate;
      this.resolvedMapping = schemaProbe.mapping;
      this.resolvedSelect = schemaProbe.select;
      return { listTitle: candidate, mapping: schemaProbe.mapping, select: schemaProbe.select };
    }

    this.resolutionFailed = true;
    return null;
  }

  private async getAvailableListTitles(): Promise<string[] | null> {
    if (!this.provider.getResourceNames) return null;

    try {
      const raw = await this.provider.getResourceNames();
      const normalized = raw
        .map((title) => title.trim())
        .filter((title) => title.length > 0);
      return [...new Set(normalized)];
    } catch (error) {
      auditLog.warn('monitoring', 'MonitoringMeeting catalog resolution failed. Falling back to direct probes.', {
        error: String(error),
      });
      return null;
    }
  }

  private async getListFieldNames(listTitle: string): Promise<Set<string> | null> {
    try {
      const names = await this.provider.getFieldInternalNames(listTitle);
      return names;
    } catch (error) {
      auditLog.debug('monitoring', 'MonitoringMeeting field probe skipped', {
        listTitle,
        error: String(error),
      });
      return null;
    }
  }

  private buildBestEffortMapping(resolved: Record<string, string | undefined>): MonitoringMeetingFieldMapping {
    const mapping: MonitoringMeetingFieldMapping = {};
    const entries = Object.entries(MONITORING_MEETING_CANDIDATES) as Array<[MonitoringMeetingCandidateKey, readonly string[]]>;
    for (const [key, cands] of entries) {
      mapping[key] = resolved[key] ?? cands[0];
    }
    return mapping;
  }

  private async probeSchema(
    listTitle: string,
  ): Promise<{ mapping: MonitoringMeetingFieldMapping | null; missingFields: string[]; select: readonly string[] }> {
    const names = await this.getListFieldNames(listTitle);
    if (!names) return { mapping: null, missingFields: [], select: [] };

    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      names,
      MONITORING_MEETING_CANDIDATES as unknown as Record<string, string[]>,
    );

    const essentials = MONITORING_MEETING_ESSENTIALS as unknown as string[];
    const isHealthy = areEssentialFieldsResolved(
      resolved as Record<string, string | undefined>,
      essentials,
    );
    if (!isHealthy) {
      return { mapping: null, missingFields: missing, select: [] };
    }

    const optionalMissing = missing.filter((field) => !essentials.includes(field));
    if (optionalMissing.length > 0) {
      auditLog.warn('monitoring', 'MonitoringMeeting optional fields are missing (WARN)', {
        listTitle,
        missing: optionalMissing,
      });
    }

    const drifted = Object.entries(fieldStatus)
      .filter(([, status]) => status.isDrifted)
      .map(([field, status]) => `${field}:${status.resolvedName ?? 'unknown'}`);
    if (drifted.length > 0) {
      auditLog.warn('monitoring', 'MonitoringMeeting field drift detected', {
        listTitle,
        drifted,
      });
    }

    return {
      mapping: this.buildBestEffortMapping(resolved as Record<string, string | undefined>),
      missingFields: missing,
      select: Array.from(
        new Set([
          'Id',
          'Title',
          ...Object.values(resolved).filter((name): name is string => Boolean(name)),
        ]),
      ),
    };
  }
}
