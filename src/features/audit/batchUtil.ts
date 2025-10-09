/* eslint-disable @typescript-eslint/no-explicit-any */
import { safeRandomUUID } from '../../lib/uuid';
import { AuditInsertItemDTO } from './types';
export function buildBatchInsertBody(listTitle: string, items: AuditInsertItemDTO[], apiRelativeSite?: string): { body: string; boundary: string; idMap: number[] } {
  const boundary = 'batch_' + safeRandomUUID();
  const changesetBoundary = 'changeset_' + safeRandomUUID();
  // Attempt to derive /sites/... relative path if not provided
  const apiRel = apiRelativeSite || `/sites${location.pathname.split('/_layouts')[0].split('/sites')[1] || ''}`;

  const idMap: number[] = [];
  const changesetParts = items.map((it, idx) => {
    const contentId = idx + 1;
    idMap.push(contentId);
    return [
    `--${changesetBoundary}`,
    'Content-Type: application/http',
    'Content-Transfer-Encoding: binary',
    `Content-ID: ${contentId}`,
    '',
    `POST ${apiRel}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items HTTP/1.1`,
    'Content-Type: application/json;odata=nometadata',
    '',
    JSON.stringify(it),
    ''
  ].join('\r\n');
}).join('\r\n');

  const body = [
    `--${boundary}`,
    `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
    '',
    changesetParts,
    `--${changesetBoundary}--`,
    `--${boundary}--`,
    ''
  ].join('\r\n');

  return { body, boundary, idMap };
}

// Result interface for parsing $batch insert responses
export interface ParsedBatchInsertResult {
  total: number;
  success: number; // 2xx + treated-as-success duplicates (409)
  failed: number;
  errors: { contentId: number; status: number; statusText: string; bodySnippet?: string }[];
  duplicates?: number; // count of 409 treated as success
  categories?: Record<string, number>; // aggregated error categories counts
}

// Lightweight item shape for internal fallback reuse
interface __FallbackItem { id: string; status: number; statusText?: string; raw?: string }

/**
 * Fallback parser for degraded / malformed $batch responses.
 * Triggers only if the strict multipart parser yields zero total items.
 * Heuristics:
 *  - Normalize newlines to \n
 *  - Detect lines matching HTTP/1.1 <code> <text>
 *  - Look upward up to 6 lines for (case-insensitive) Content-Id header
 *  - Slice snippet until next HTTP line
 */
function parseBatchFallbackRaw(raw: string): __FallbackItem[] {
  const norm = raw.replace(/\r\n/g, '\n');
  const lines = norm.split('\n');
  const items: __FallbackItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^HTTP\/1\.1\s+(\d{3})\s+([^]*)$/.exec(lines[i]);
    if (!m) continue;
    const status = Number(m[1]);
    const statusText = (m[2] || '').trim();
    let contentId: string | null = null;
    for (let up = i - 1; up >= 0 && up >= i - 6; up--) {
      const cid = /^\s*Content-Id\s*:\s*([^\s]+)\s*$/i.exec(lines[up]);
      if (cid) { contentId = cid[1].trim(); break; }
    }
    let j = i + 1;
    while (j < lines.length && !/^HTTP\/1\.1\s+\d{3}\b/.test(lines[j])) j++;
    const snippet = lines.slice(i, j).join('\n').slice(0, 500);
    items.push({ id: contentId ?? String(items.length + 1), status, statusText, raw: snippet });
    i = j - 1;
  }
  if (typeof window !== 'undefined') {
    const w: any = window as any;
    w.__AUDIT_BATCH_METRICS__ = w.__AUDIT_BATCH_METRICS__ || {};
    w.__AUDIT_BATCH_METRICS__.parserFallbackCount = (w.__AUDIT_BATCH_METRICS__.parserFallbackCount || 0) + 1;
  }
  return items;
}

/**
 * Parse a SharePoint REST $batch response (multipart/mixed) for our insert changeset.
 * We assume a single outer batch boundary with one changeset part.
 * Each changeset response segment includes: HTTP/1.1 <status> <text> ... optionally Content-ID header.
 */
export async function parseBatchInsertResponse(response: Response): Promise<ParsedBatchInsertResult> {
  const raw = await response.text();
  // Try to capture the batch boundary from the first line
  const firstBoundaryMatch = raw.match(/^(--batch[_-][A-Za-z0-9-]+)/m);
  if (!firstBoundaryMatch) {
    // Fallback: treat as whole success if 200 OK with no parsing
    return { total: 0, success: 0, failed: 0, errors: [] };
  }

  // Extract all HTTP status lines inside the changeset responses
  // Pattern: HTTP/1.1 <code> <text> possibly CRLF; we also want preceding Content-ID if present
  const parts = raw.split(/\r?\n--changeset[_-][A-Za-z0-9-]+/).filter(p => /HTTP\/1.1\s+\d{3}/.test(p));
  let success = 0;
  let duplicates = 0;
  const categories: Record<string, number> = {};
  const errors: ParsedBatchInsertResult['errors'] = [];
  let total = 0;

  for (const part of parts) {
    const statusLine = part.match(/HTTP\/1.1\s+(\d{3})\s+([A-Za-z ]+)/);
    if (!statusLine) continue;
    const status = parseInt(statusLine[1], 10);
    const statusText = statusLine[2].trim();
    // Content-ID: <n>
    const cidMatch = part.match(/Content-ID:\s*(\d+)/i);
    const contentId = cidMatch ? parseInt(cidMatch[1], 10) : NaN;
    total++;
    if (status >= 200 && status < 300) {
      success++;
    } else if (status === 409) { // unique constraint violation -> treat as success (idempotent duplicate)
      success++;
      duplicates++;
    } else {
      // body snippet after blank line
      const bodyStart = part.indexOf('\n\n');
      let snippet: string | undefined;
      if (bodyStart >= 0) {
        snippet = part.slice(bodyStart + 2, bodyStart + 400).trim();
      }
      errors.push({ contentId, status, statusText, bodySnippet: snippet });
      // categorize
      let cat = 'other';
      if (status === 400) cat = 'bad_request';
      else if (status === 401 || status === 403) cat = 'auth';
      else if (status === 404) cat = 'not_found';
      else if (status === 429) cat = 'throttle';
      else if (status >= 500) cat = 'server';
      categories[cat] = (categories[cat] || 0) + 1;
    }
  }

  const httpCount = (raw.match(/HTTP\/1\.1\s+\d{3}/g) || []).length;
  if (total === 0 || (total <= 1 && httpCount > total)) {
    // Strict path produced nothing -> attempt fallback heuristic parse
    const fbItems = parseBatchFallbackRaw(raw);
    if (fbItems.length) {
      let fbSuccess = 0; let fbDup = 0; const fbErrors: ParsedBatchInsertResult['errors'] = []; const cats: Record<string, number> = {};
      for (const it of fbItems) {
        const st = it.status;
        if (st >= 200 && st < 300) { fbSuccess++; }
        else if (st === 409) { fbSuccess++; fbDup++; }
        else {
          let cat = 'other';
          if (st === 400) cat = 'bad_request'; else if (st === 401 || st === 403) cat = 'auth'; else if (st === 404) cat = 'not_found'; else if (st === 429) cat = 'throttle'; else if (st >= 500) cat = 'server';
          cats[cat] = (cats[cat] || 0) + 1;
          fbErrors.push({ contentId: Number(it.id) || NaN, status: st, statusText: it.statusText || '', bodySnippet: it.raw });
        }
      }
      return { total: fbItems.length, success: fbSuccess, failed: fbItems.length - fbSuccess, errors: fbErrors, duplicates: fbDup || undefined, categories: Object.keys(cats).length ? cats : undefined };
    }
  }
  return { total, success, failed: total - success, errors, duplicates: duplicates || undefined, categories: Object.keys(categories).length ? categories : undefined };
}
