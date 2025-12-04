import type { SpScheduleItem } from '@/types';
import { normalizeOrgFilter, type OrgFilterKey } from './orgFilters';

const SERVICE_TYPE_TO_ORG: Record<string, OrgFilterKey> = {
  normal: 'main',
  transport: 'main',
  nursing: 'main',
  absence: 'main',
  late: 'main',
  earlyleave: 'main',
  other: 'main',
  '通常利用': 'main',
  '送迎': 'main',
  '日中活動': 'main',
  '欠席・休み': 'main',
  '看護': 'main',
  '面談': 'main',
  '会議': 'main',
  '研修': 'main',
  'イベント': 'main',
  '来客': 'main',
  'その他': 'main',
  shortstay: 'shortstay',
  'ショートステイ': 'shortstay',
  '短期入所': 'shortstay',
  '一時ケア・短期': 'shortstay',
  respite: 'respite',
  '一時ケア': 'respite',
} as const;

const SERVICE_TYPE_HINTS: Array<{ pattern: RegExp; code: OrgFilterKey }> = [
  { pattern: /short|短期|ｼｮｰﾄ/i, code: 'shortstay' },
  { pattern: /respite|一時|ｲｯﾁｼﾞ/i, code: 'respite' },
];

const RESOURCE_HINTS: Array<{ pattern: RegExp; code: OrgFilterKey }> = [
  { pattern: /short|短期|ss/i, code: 'shortstay' },
  { pattern: /respite|一時/i, code: 'respite' },
  { pattern: /main|本体|生活介護/i, code: 'main' },
];

const normalizeString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const lookupExact = (value: string, map: Record<string, OrgFilterKey>): OrgFilterKey | undefined => {
  if (!value) return undefined;
  return map[value] ?? map[value.toLowerCase()];
};

const matchHints = (value: string, hints: Array<{ pattern: RegExp; code: OrgFilterKey }>): OrgFilterKey | undefined => {
  if (!value) return undefined;
  return hints.find(({ pattern }) => pattern.test(value))?.code;
};

const flattenResourceHint = (value: unknown): string => {
  if (!value) {
    return '';
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = flattenResourceHint(entry);
      if (resolved) {
        return resolved;
      }
    }
    return '';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) {
      return flattenResourceHint(record.results);
    }
    if (typeof record.Title === 'string') {
      return record.Title.trim();
    }
    if (typeof record.Name === 'string') {
      return record.Name.trim();
    }
  }
  return normalizeString(value);
};

export const mapOrgCodeFromServiceType = (serviceType?: string | null): OrgFilterKey | undefined => {
  const normalized = normalizeString(serviceType);
  if (!normalized) return undefined;
  return lookupExact(normalized, SERVICE_TYPE_TO_ORG) ?? matchHints(normalized, SERVICE_TYPE_HINTS);
};

export const mapOrgCodeFromResource = (resourceValue: unknown): OrgFilterKey | undefined => {
  const normalized = flattenResourceHint(resourceValue).toLowerCase();
  if (!normalized) return undefined;
  return matchHints(normalized, RESOURCE_HINTS);
};

export const inferOrgCodeFromSpItem = (item: SpScheduleItem): OrgFilterKey | undefined => {
  return (
    mapOrgCodeFromResource(item.cr014_resourceId ?? item.RelatedResourceId ?? item.RelatedResource) ??
    mapOrgCodeFromServiceType(item.ServiceType ?? item.cr014_serviceType)
  );
};

export const normalizeOrgCodeCandidate = (value: string | null | undefined): OrgFilterKey | undefined => {
  if (!value) return undefined;
  const normalized = normalizeOrgFilter(value);
  return normalized === 'all' ? undefined : normalized;
};
