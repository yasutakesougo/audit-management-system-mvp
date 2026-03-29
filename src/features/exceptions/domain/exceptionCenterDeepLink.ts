import type { ExceptionCategory } from './exceptionLogic';

const CATEGORY_VALUES: ReadonlySet<ExceptionCategory> = new Set([
  'missing-record',
  'overdue-plan',
  'critical-handoff',
  'attention-user',
  'corrective-action',
  'transport-alert',
]);

export type ExceptionCenterDeepLinkFilters = {
  category: ExceptionCategory | 'all';
  userId: string | null;
  source: string | null;
};

export type BuildExceptionCenterDeepLinkInput = {
  category?: ExceptionCategory | 'all';
  userId?: string | null;
  source?: string | null;
};

function parseCategory(value: string | null): ExceptionCategory | 'all' {
  if (!value) return 'all';
  return CATEGORY_VALUES.has(value as ExceptionCategory)
    ? (value as ExceptionCategory)
    : 'all';
}

export function parseExceptionCenterDeepLinkParams(
  params: URLSearchParams,
): ExceptionCenterDeepLinkFilters {
  const rawUserId = params.get('userId')?.trim();
  const rawSource = params.get('source')?.trim();
  return {
    category: parseCategory(params.get('category')),
    userId: rawUserId ? rawUserId : null,
    source: rawSource ? rawSource : null,
  };
}

export function buildExceptionCenterDeepLinkPath(
  input: BuildExceptionCenterDeepLinkInput = {},
): string {
  const params = new URLSearchParams();
  if (input.category && input.category !== 'all') {
    params.set('category', input.category);
  }
  if (input.userId && input.userId.trim() !== '') {
    params.set('userId', input.userId.trim());
  }
  if (input.source && input.source.trim() !== '') {
    params.set('source', input.source.trim());
  }
  const query = params.toString();
  return query ? `/admin/exception-center?${query}` : '/admin/exception-center';
}
