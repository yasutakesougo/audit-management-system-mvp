import { DAILY_RECORD_FIELDS } from '../constants';

/**
 * Build list path for SharePoint API
 */
export const buildListPath = (listTitle: string): string => {
  const escaped = listTitle.replace(/'/g, "''");
  return `lists/getbytitle('${escaped}')`;
};

/**
 * Build OData filter for date range
 */
export const buildDateRangeFilter = (startDate: string, endDate: string): string => {
  return `${DAILY_RECORD_FIELDS.title} ge '${startDate}' and ${DAILY_RECORD_FIELDS.title} le '${endDate}'`;
};

/**
 * Extracts HTTP status from error object
 */
export const getHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const obj = error as Record<string, unknown>;
  if (typeof obj.status === 'number') return obj.status;
  if (obj.cause && typeof obj.cause === 'object') {
    const cause = obj.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') return cause.status;
  }
  return undefined;
};

export const DAILY_RECORD_LIST_FALLBACKS = [
  'SupportRecord_Daily',
  'SupportProcedureRecord_Daily',
  'DailyActivityRecords',
  'TableDailyRecords',
  'TableDailyRecord',
  'DailyRecords',
  '日次記録',
  '支援記録',
] as const;

export const DAILY_RECORD_SUGGESTION_TOKENS = ['daily', 'record', 'table', 'report', '日次', '記録', '支援', 'ケース', '報告'] as const;

export const normalizeListKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s_\-\u3000]+/gu, '');

export const buildListTitleCandidates = (primary: string): string[] => {
  const normalizedPrimary = primary.trim();
  const values = [
    normalizedPrimary,
    ...DAILY_RECORD_LIST_FALLBACKS,
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
};

export const suggestListTitles = (titles: string[], requested: string, tried: string[]): string[] => {
  const triedSet = new Set(tried.map(normalizeListKey));
  const requestedKey = normalizeListKey(requested);

  const scored = titles
    .filter((title) => !triedSet.has(normalizeListKey(title)))
    .map((title) => {
      const titleKey = normalizeListKey(title);
      let score = 0;

      if (requestedKey && (titleKey.includes(requestedKey) || requestedKey.includes(titleKey))) {
        score += 6;
      }
      for (const token of DAILY_RECORD_SUGGESTION_TOKENS) {
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

  return scored;
};
