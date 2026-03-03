/**
 * SharePoint $batch payload builder and response parser.
 * Extracted from spClient.ts for single-responsibility.
 */

import type { SharePointBatchOperation, SharePointBatchResult } from './types';

/**
 * Build a multipart/mixed batch request body from operations.
 * @param normalizePath - the path normalizer injected from createSpClient
 * @param buildItemPath - item path builder injected from createSpClient
 */
export const buildBatchPayload = (
  operations: SharePointBatchOperation[],
  boundary: string,
  normalizePath: (path: string) => string,
  buildItemPath: (listIdentifier: string, id?: number, select?: string[]) => string,
): string => {
  const lines: string[] = [];
  for (const operation of operations) {
    const method = operation.kind === 'create'
      ? 'POST'
      : operation.kind === 'update'
        ? (operation.method ?? 'PATCH')
        : 'DELETE';
    const targetPath = normalizePath(
      operation.kind === 'create'
        ? buildItemPath(operation.list)
        : buildItemPath(operation.list, operation.id),
    );
    const headers: Record<string, string> = {
      Accept: 'application/json;odata=nometadata',
      ...(operation.headers ?? {}),
    };
    if (method === 'POST' || method === 'PATCH' || method === 'MERGE') {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json;odata=nometadata';
    }
    if ((operation.kind === 'update' || operation.kind === 'delete') && !headers['If-Match']) {
      headers['If-Match'] = operation.etag ?? '*';
    }

    lines.push(`--${boundary}`);
    lines.push('Content-Type: application/http');
    lines.push('Content-Transfer-Encoding: binary');
    lines.push('');
    lines.push(`${method} ${targetPath} HTTP/1.1`);
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`${key}: ${value}`);
    }
    lines.push('');
    if (operation.kind === 'create' || operation.kind === 'update') {
      lines.push(JSON.stringify(operation.body ?? {}));
      lines.push('');
    }
  }
  lines.push(`--${boundary}--`);
  lines.push('');
  return lines.join('\r\n');
};

/**
 * Parse a multipart/mixed batch response body into structured results.
 */
export const parseBatchResponse = (payload: string, boundary: string): SharePointBatchResult[] => {
  const results: SharePointBatchResult[] = [];
  const segments = payload.split(`--${boundary}`);
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '--') continue;
    const httpIndex = trimmed.indexOf('HTTP/1.1');
    if (httpIndex === -1) continue;
    const httpPayload = trimmed.slice(httpIndex);
    const [statusLine] = httpPayload.split('\r\n');
    const statusMatch = /HTTP\/1\.1\s+(\d{3})/i.exec(statusLine ?? '');
    if (!statusMatch) continue;
    const status = Number(statusMatch[1]);
    const bodyIndex = httpPayload.indexOf('\r\n\r\n');
    const rawBody = bodyIndex >= 0 ? httpPayload.slice(bodyIndex + 4).trim() : '';
    let data: unknown;
    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        data = rawBody;
      }
    }
    results.push({ ok: status >= 200 && status < 300, status, data });
  }
  return results;
};
