export const ORG_FILTER_OPTIONS = [
  { value: 'all', label: '全事業所（統合ビュー）' },
  { value: 'main', label: '生活介護（本体）' },
  { value: 'shortstay', label: '短期入所' },
  { value: 'respite', label: '一時ケア' },
  { value: 'other', label: 'その他（将来拡張）' },
] as const;

export type OrgFilterKey = (typeof ORG_FILTER_OPTIONS)[number]['value'];

export const DEFAULT_ORG_FILTER: OrgFilterKey = 'all';

const OPTION_LOOKUP = new Map(ORG_FILTER_OPTIONS.map((opt) => [opt.value, opt.label] as const));

export function isOrgFilterKey(value: unknown): value is OrgFilterKey {
  return typeof value === 'string' && OPTION_LOOKUP.has(value as OrgFilterKey);
}

export function normalizeOrgFilter(value: string | null | undefined): OrgFilterKey {
  if (!value) return DEFAULT_ORG_FILTER;
  const trimmed = value.trim().toLowerCase();
  if (isOrgFilterKey(trimmed)) {
    return trimmed;
  }
  return DEFAULT_ORG_FILTER;
}

export function getOrgFilterLabel(value: OrgFilterKey): string {
  return OPTION_LOOKUP.get(value) ?? OPTION_LOOKUP.get(DEFAULT_ORG_FILTER) ?? '全事業所';
}

export function matchesOrgFilter(orgCode: OrgFilterKey | null | undefined, filter: OrgFilterKey): boolean {
  if (filter === DEFAULT_ORG_FILTER) {
    return true;
  }
  return (orgCode ?? DEFAULT_ORG_FILTER) === filter;
}
