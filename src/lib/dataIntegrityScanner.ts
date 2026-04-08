import { z, type ZodType } from 'zod';
import { translateZodIssue } from './zodErrorUtils';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** A single scan target (SharePoint list + Zod schema) */
export interface ScanTarget {
  /** Technical key (e.g. 'users_master', 'schedules') */
  name: string;
  /** Human-readable name (e.g. '利用者マスタ', '勤務予定') */
  displayName?: string;
  /** SharePoint list title */
  listTitle: string;
  /** Zod schema for raw SP items */
  schema: ZodType;
  /** SP $select fields */
  selectFields: readonly string[];
}

/** A single invalid record detected during the scan */
export interface ScanIssue {
  /** Scan target name */
  target: string;
  /** SharePoint item ID */
  recordId: number | string;
  /** Translated error messages */
  messages: string[];
  /** Raw Zod issues for debugging */
  zodIssues: z.ZodIssue[];
}

export interface ScanResult {
  target: string;
  displayName?: string;
  listTitle: string;
  total: number;
  valid: number;
  invalid: number;
  issues: ScanIssue[];
  durationMs: number;
  /** Phase 1 result */
  fetchStatus: 'success' | 'failed' | 'skipped';
  /** Truncation flag (hit MAX_PAGES) */
  isTruncated?: boolean;
  /** Specific fetch error (e.g. 404, 403) */
  fetchError?: string;
  /** Fields excluded from $select due to 400 fallback retries */
  skippedFields?: string[];
}

/** Progress callback payload */
export interface ScanProgress {
  target: string;
  displayName?: string;
  scanned: number;
  total: number;
  phase: 'fetching' | 'validating' | 'done';
  message?: string;
}

export interface TargetData {
  items: unknown[];
  fetchStatus: 'success' | 'failed' | 'skipped';
  fetchError?: string;
  isTruncated?: boolean;
  /** Fields excluded from $select due to 400 fallback retries */
  skippedFields?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Core: validate an array of raw items against a schema
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate an array of raw SharePoint items against a Zod schema.
 * Uses `safeParse` so it collects ALL issues instead of throwing.
 */
export function validateItems(
  items: unknown[],
  schema: ZodType,
  targetName: string,
): { valid: number; invalid: number; issues: ScanIssue[] } {
  let valid = 0;
  let invalid = 0;
  const issues: ScanIssue[] = [];

  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid++;
    } else {
      invalid++;
      const recordId =
        typeof item === 'object' && item !== null && 'Id' in item
          ? (item as Record<string, unknown>).Id as number
          : 'unknown';

      issues.push({
        target: targetName,
        recordId,
        messages: result.error.issues.map(translateZodIssue),
        zodIssues: result.error.issues,
      });
    }
  }

  return { valid, invalid, issues };
}

// ────────────────────────────────────────────────────────────────────────────
// scanAll: validate multiple targets
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate pre-fetched data for multiple scan targets.
 *
 * This function is **pure** — it does NOT fetch from SharePoint.
 * It takes already-fetched raw data and validates it against the schemas.
 * This makes it easily testable without mocking SharePoint.
 *
 * @param targets - Array of scan targets with their schemas
 * @param data - Map of target name → raw items from SharePoint
 * @param onProgress - Optional progress callback
 * @param signal - Optional abort signal
 */
export function scanAll(
  targets: ScanTarget[],
  dataMap: Map<string, TargetData>,
  onProgress?: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): ScanResult[] {
  const results: ScanResult[] = [];

  for (const target of targets) {
    if (signal?.aborted) break;

    const entry = dataMap.get(target.name) || { items: [], fetchStatus: 'skipped' as const };
    const items = entry.items;
    const total = items.length;

    onProgress?.({
      target: target.name,
      displayName: target.displayName,
      scanned: 0,
      total,
      phase: 'validating',
    });

    const start = performance.now();
    const { valid, invalid, issues } = validateItems(items, target.schema, target.name);
    const durationMs = Math.round(performance.now() - start);

    results.push({
      target: target.name,
      displayName: target.displayName,
      listTitle: target.listTitle,
      total,
      valid,
      invalid,
      issues,
      durationMs,
      fetchStatus: entry.fetchStatus,
      fetchError: entry.fetchError,
      isTruncated: entry.isTruncated,
      skippedFields: entry.skippedFields,
    });

    onProgress?.({
      target: target.name,
      displayName: target.displayName,
      scanned: total,
      total,
      phase: 'done',
    });
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Summary helpers
// ────────────────────────────────────────────────────────────────────────────

/** Generate a human-readable summary of scan results */
export function formatScanSummary(results: ScanResult[]): string {
  const lines: string[] = ['--- データ整合性スキャンレポート ---', ''];

  for (const r of results) {
    const fetchSuffix = r.isTruncated ? ' (上限到達)' : '';
    lines.push(`【${r.target}】 ${r.total}件中 ${r.valid}件 OK / ${r.invalid}件 エラー${fetchSuffix} (${r.durationMs}ms)`);
    if (r.fetchStatus === 'failed') {
      lines.push(`  ⚠ 取得エラー: ${r.fetchError}`);
    }
    if (r.skippedFields && r.skippedFields.length > 0) {
      lines.push(`  ⚠ 列スキップ: ${r.skippedFields.join(', ')}`);
    }
    for (const issue of r.issues) {
      lines.push(`  ▸ ID ${issue.recordId}: ${issue.messages.join('; ')}`);
    }
    lines.push('');
  }

  const totalInvalid = results.reduce((sum, r) => sum + r.invalid, 0);
  const fetchFailures = results.filter(r => r.fetchStatus === 'failed').length;
  if (fetchFailures > 0) {
    lines.push(`⚠ ${fetchFailures}件のリストで取得エラーがありました（未検証）。`);
  }
  lines.push(totalInvalid === 0 && fetchFailures === 0
    ? '✅ すべてのデータが正常です。'
    : totalInvalid > 0
      ? `⚠ ${totalInvalid}件の不整合データが見つかりました。`
      : '');

  return lines.join('\n');
}
