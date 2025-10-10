/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { getAuditLogs, clearAudit, retainAuditWhere } from '../../lib/audit';
import { useSP } from '../../lib/spClient';
import { getAppConfig } from '../../lib/env';
import { buildBatchInsertBody, parseBatchInsertResponse } from './batchUtil';
import { auditLog } from '../../lib/debugLogger';
import { canonicalJSONStringify, computeEntryHash } from '../../lib/hashUtil';
import { AuditInsertItemDTO } from './types';

// SharePoint リスト名 (既存 EnsureList で Title: Audit_Events を作成想定)
const AUDIT_LIST_NAME = 'Audit_Events';

// Batch の 1 チャンクサイズ（将来的に env で可変化可能）
const DEFAULT_CHUNK_SIZE = 100;

interface SyncResult {
  total: number;
  success: number;       // 成功 (新規 + 重複) 件数
  failed?: number;       // 失敗件数
  duplicates?: number;   // 重複（409）件数
  errors?: { contentId: number; status: number; statusText: string }[];
  durationMs?: number;   // 全体処理時間
  categories?: Record<string, number>; // 失敗カテゴリ集計
}

export interface AuditBatchMetrics {
  success: number;
  duplicates: number;
  failed: number;
  total: number;
  parserFallbackCount?: number;
}


// Helper types / functions extracted for testability
export interface BatchItemStatus { id: string; status: number; }
export interface BatchSummary { success: number; duplicate: number; failed: number; total: number; }

export function summarizeBatchStatuses(items: BatchItemStatus[]): BatchSummary {
  let success = 0, duplicate = 0, failed = 0;
  for (const it of items) {
    if (it.status >= 200 && it.status < 300) success++;
    else if (it.status === 409) { success++; duplicate++; }
    else failed++;
  }
  return { success, duplicate, failed, total: items.length };
}

export function selectForRetry(items: BatchItemStatus[]): string[] {
  return items.filter(it => !(it.status >= 200 && it.status < 300) && it.status !== 409).map(it => it.id);
}

export const useAuditSyncBatch = () => {
  const { postBatch } = useSP();

  const syncAllBatch = useCallback(async (chunkSize?: number): Promise<SyncResult> => {
    const start = performance.now();
    // 環境変数優先 (1-500 clamp)
    const batchConfig = getAppConfig();
    const envSizeRaw = batchConfig.VITE_AUDIT_BATCH_SIZE;
    let effective = chunkSize ?? (envSizeRaw ? parseInt(envSizeRaw, 10) : DEFAULT_CHUNK_SIZE);
    if (isNaN(effective) || effective <= 0) effective = DEFAULT_CHUNK_SIZE;
    if (effective > 500) effective = 500;
    const logs = getAuditLogs();
    if (!logs.length) return { total: 0, success: 0 };

    // ローカル構造 -> ListItem DTO
    const dtoList: AuditInsertItemDTO[] = await Promise.all(logs.map(async ev => {
      const after_json = ev.after ? canonicalJSONStringify(ev.after) : null;
      const insert: Omit<AuditInsertItemDTO, 'entry_hash'> = {
        Title: `${ev.action} ${ev.entity}${ev.entity_id ? ' #' + ev.entity_id : ''}`,
        ts: new Date(ev.ts).toISOString(),
        actor: ev.actor,
        action: ev.action,
        entity: ev.entity,
        entity_id: ev.entity_id ?? null,
        channel: ev.channel,
        after_json
      };
      const entry_hash = await computeEntryHash({
        ts: insert.ts,
        actor: insert.actor,
        action: insert.action,
        entity: insert.entity,
        entity_id: insert.entity_id,
        after_json: insert.after_json
      });
      return { ...insert, entry_hash };
    }));

    // チャンク分割
    const chunks: AuditInsertItemDTO[][] = [];
    for (let i = 0; i < dtoList.length; i += effective) {
      chunks.push(dtoList.slice(i, i + effective));
    }

    let success = 0;
    let failed = 0;
    let duplicates = 0;
    const errorAgg: { contentId: number; status: number; statusText: string }[] = [];
    const categoryAgg: Record<string, number> = {};

    const transientStatus = (s: number) => s === 429 || s === 503 || s === 504;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const envRetry = batchConfig.VITE_AUDIT_RETRY_MAX ? parseInt(batchConfig.VITE_AUDIT_RETRY_MAX, 10) : NaN;
    const MAX_RETRY = (!isNaN(envRetry) && envRetry > 0 && envRetry <= 5) ? envRetry : 3;
    const backoffBaseRaw = batchConfig.VITE_AUDIT_RETRY_BASE ? parseInt(batchConfig.VITE_AUDIT_RETRY_BASE, 10) : NaN;
    const backoffBase = (!isNaN(backoffBaseRaw) && backoffBaseRaw > 0) ? backoffBaseRaw : 200;

    // Keep original logs for retention mapping
    let processedOffset = 0; // offset in original logs for current chunk start
    const failedOriginalIndexes: number[] = [];
    for (const chunk of chunks) {
      let attempt = 0;
      let done = false;
  // _lastParse: retained for potential future diagnostics (unused currently)
  let _lastParse: Awaited<ReturnType<typeof parseBatchInsertResponse>> | null = null;
      while (!done && attempt < MAX_RETRY) {
        const { body, boundary } = buildBatchInsertBody(AUDIT_LIST_NAME, chunk);
        try {
            let parsed: Awaited<ReturnType<typeof parseBatchInsertResponse>> | null = null;
            if (typeof window !== 'undefined' && (window as any).__E2E_FORCE_BATCH__) {
              // Test hook supplies a synthetic multipart body + status objects
              const synthetic = await (window as any).__E2E_FORCE_BATCH__(chunk);
              if (synthetic && typeof synthetic.body === 'string') {
                const blob = new Blob([synthetic.body], { type: 'multipart/mixed' });
                const fakeRes = new Response(blob, { status: 202, headers: { 'Content-Type': 'multipart/mixed; boundary=e2e_forced' } });
                parsed = await parseBatchInsertResponse(fakeRes);
              }
            }
            if (!parsed) {
              const res = await postBatch(body, boundary);
              parsed = await parseBatchInsertResponse(res.clone());
            }
              const resParsed = parsed;
            if (typeof window !== 'undefined') {
                (window as any).__E2E_LAST_PARSED__ = resParsed;
            }
              _lastParse = resParsed;
            // 失敗の中にトランジェント（429/503/504）が含まれるか簡易判定（errors の status 走査）
              const transientErrors = resParsed.errors.filter(e => transientStatus(e.status));
            if (transientErrors.length && attempt < MAX_RETRY - 1) {
              // リトライ対象: 全体を再送 (細粒度リトライは将来拡張)
              attempt++;
              const backoff = (backoffBase * Math.pow(2, attempt)) + Math.floor(Math.random() * 50);
              auditLog.debug('retry', { attempt, backoff, transientErrors: transientErrors.length });
              await sleep(backoff);
              continue;
            }
            // 成果を集約
              success += resParsed.success;
              failed += resParsed.failed;
            // Collect failed original indices via Content-ID mapping
              if (resParsed.failed && resParsed.errors.length) {
                for (const err of resParsed.errors) {
                if (!isNaN(err.contentId)) {
                  const localIdx = (err.contentId - 1); // within chunk
                  const originalIdx = processedOffset + localIdx;
                  failedOriginalIndexes.push(originalIdx);
                }
              }
            }
              duplicates += resParsed.duplicates || 0;
              if (resParsed.categories) {
                for (const [k, v] of Object.entries(resParsed.categories)) {
                categoryAgg[k] = (categoryAgg[k] || 0) + v;
              }
            }
              if (resParsed.errors.length) {
                errorAgg.push(...resParsed.errors.map(e => ({ contentId: e.contentId, status: e.status, statusText: e.statusText })));
            }
              auditLog.debug('chunk', { size: chunk.length, boundary, parsed: resParsed, attempt });
            done = true;
        } catch (e) {
          if (attempt < MAX_RETRY - 1) {
            attempt++;
            const backoff = ((backoffBase + 100) * Math.pow(2, attempt)) + Math.floor(Math.random() * 80);
            auditLog.debug('retry', { attempt, backoff });
            await sleep(backoff);
            continue;
          } else {
            auditLog.error('fatal', 'Batch post failed permanently (chunk all failed)', e);
            failed += chunk.length;
            done = true;
          }
        }
      }
      processedOffset += chunk.length;
    }

      // Test-only hook: signal completion for E2E polling if present
      if (typeof window !== 'undefined' && (window as any).__TEST_BATCH_DONE__) {
        try { (window as any).__TEST_BATCH_DONE__(); } catch {}
      }

    if (success === logs.length) {
      clearAudit();
    } else if (failed > 0) {
      const failedSet = new Set(failedOriginalIndexes);
      retainAuditWhere((_, idx) => failedSet.has(idx));
    }
    const durationMs = Math.round(performance.now() - start);
    // Debug metrics exposure (DEV only)
    if (auditLog.enabled) {
      window.__AUDIT_BATCH_METRICS__ = {
        total: logs.length,
        success,
        duplicates,
        newItems: success - duplicates,
        failed,
        retryMax: MAX_RETRY,
        categories: categoryAgg,
        durationMs,
        timestamp: new Date().toISOString(),
        parserFallbackCount: window.__AUDIT_BATCH_METRICS__?.parserFallbackCount
      };
    }
    return { total: logs.length, success, failed: failed || undefined, duplicates: duplicates || undefined, errors: errorAgg.length ? errorAgg : undefined, durationMs, categories: Object.keys(categoryAgg).length ? categoryAgg : undefined };
  }, [postBatch]);

  return { syncAllBatch };
};

  // DEV/E2E helper to inject a one-off sync call without going through component button (optional)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__E2E_INVOKE_SYNC_BATCH__ = async (size?: number) => {
      try {
        const mod = await import('./useAuditSyncBatch');
        // This indirect import re-runs factory each call; acceptable for test hook.
        const hook = (mod as any).useAuditSyncBatch?.();
        if (hook?.syncAllBatch) {
          return await hook.syncAllBatch(size);
        }
      } catch (e) {
        return { error: String(e) };
      }
    };
  }
