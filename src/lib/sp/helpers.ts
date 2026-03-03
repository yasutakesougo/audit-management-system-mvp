/**
 * SharePoint Path & Error Helpers
 *
 * spClient.ts から抽出。リストパス構築、エラーレスポンス解析。
 */
import { getAppConfig } from '@/lib/env';
import { trimGuidBraces } from '@/lib/sp/types';

// ─── GUID / Path helpers ─────────────────────────────────────────

export const normalizeGuidCandidate = (value: string): string =>
  trimGuidBraces(value.replace(/^guid:/i, ''));

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const buildListItemsPath = (listTitle: string, select: string[], top: number): string => {
  const queryParts: string[] = [];
  if (select.length) queryParts.push(`$select=${select.join(',')}`);
  if (Number.isFinite(top) && top > 0) queryParts.push(`$top=${top}`);
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const guidCandidate = normalizeGuidCandidate(listTitle);
  if (GUID_REGEX.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')/items${query}`;
  }
  return `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items${query}`;
};

export const resolveListPath = (identifier: string): string => {
  const raw = (identifier ?? '').trim();
  if (!raw) {
    throw new Error('SharePoint list identifier is required');
  }
  if (/^\//.test(raw)) {
    return raw;
  }
  if (/^(lists|web)\//i.test(raw) || /^lists\(/i.test(raw)) {
    return `/${raw}`;
  }
  const guidCandidate = normalizeGuidCandidate(raw);
  if (GUID_REGEX.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')`;
  }
  return `/lists/getbytitle('${encodeURIComponent(raw)}')`;
};

export const buildItemPath = (identifier: string, id?: number, select?: string[]): string => {
  const base = resolveListPath(identifier);
  const suffix = typeof id === 'number' ? `/items(${id})` : '/items';
  const params = new URLSearchParams();
  if (select?.length) {
    params.append('$select', select.join(','));
  }
  const query = params.toString();
  return query ? `${base}${suffix}?${query}` : `${base}${suffix}`;
};

// ─── Error response parsing ──────────────────────────────────────

export const readErrorPayload = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: { value?: string } };
      'odata.error'?: { message?: { value?: string } };
      message?: { value?: string };
    };
    return (
      data.error?.message?.value ??
      data['odata.error']?.message?.value ??
      data.message?.value ??
      text
    );
  } catch {
    return text;
  }
};

export const raiseHttpError = async (
  res: Response,
  ctx?: { url?: string; method?: string }
): Promise<never> => {
  const detail = await readErrorPayload(res);
  const AUDIT_DEBUG = getAppConfig().VITE_AUDIT_DEBUG;

  // 必ず1行はエラーとして残す（詳細なし）
  console.error('[SP ERROR]', {
    status: res.status,
    statusText: res.statusText,
    method: ctx?.method,
    url: ctx?.url ? ctx.url.split('?')[0] : undefined,
  });

  // 詳細は AUDIT_DEBUG 時のみ
  if (AUDIT_DEBUG) {
    console.error('[SP ERROR][detail]', {
      status: res.status,
      statusText: res.statusText,
      method: ctx?.method,
      url: ctx?.url,
      detailPreview: typeof detail === 'string' ? detail.slice(0, 800) : detail,
    });
  }

  const base = `APIリクエストに失敗しました (${res.status} ${res.statusText ?? ''})`;
  const error: Error & { status?: number; statusText?: string } = new Error(detail || base);
  error.status = res.status;
  if (res.statusText) {
    error.statusText = res.statusText;
  }
  throw error;
};
