import { z, type ZodType } from 'zod';
import { translateZodIssue } from './zodErrorUtils';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Duplicate-check rule definition */
export interface DuplicateCheckRule {
  /** Rule key used for export and grouping */
  id: string;
  /** Human-readable label for UI/report */
  label: string;
  /** Internal field names that compose one business key */
  fields: readonly string[];
  /** Skip records missing any key component (recommended for noisy data) */
  ignoreMissing?: boolean;
}

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
  /** Duplicate-check rules for business-key duplicate detection */
  duplicateChecks?: readonly DuplicateCheckRule[];
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

/** Duplicate detection issue (one duplicated key group) */
export interface DuplicateIssue {
  target: string;
  /** Rule identifier */
  ruleId: string;
  /** Rule label */
  ruleLabel: string;
  /** Canonical key for display/export */
  key: string;
  /** Raw key components keyed by field names */
  keyValues: Record<string, string>;
  /** Total records in the duplicated group */
  recordCount: number;
  /** Duplicate count = recordCount - 1 */
  duplicateCount: number;
  /** SharePoint IDs in duplicated group */
  recordIds: Array<number | string>;
}

export interface ScanResult {
  target: string;
  displayName?: string;
  listTitle: string;
  total: number;
  valid: number;
  invalid: number;
  issues: ScanIssue[];
  duplicateIssues: DuplicateIssue[];
  duplicateCount: number;
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

const DUPLICATE_KEY_SEPARATOR = '||';
const EMPTY_VALUE_MARK = '<空>';

export const DUPLICATE_REPORT_TEXT = {
  possible: '重複の可能性',
  possibleRecordsMessage: '重複の可能性がある記録があります',
  keyLabel: '重複キー',
  countLabel: '重複件数',
  duplicateTypeLabel: '重複種別',
  duplicateDetailsTitle: '重複キー詳細',
  keyValueLabel: 'キー',
} as const;

function getRecordId(item: unknown): number | string {
  if (typeof item === 'object' && item !== null && 'Id' in item) {
    const id = (item as Record<string, unknown>).Id;
    if (typeof id === 'number' || typeof id === 'string') return id;
  }
  return 'unknown';
}

function normalizeDuplicateValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';

  if (typeof raw === 'boolean') return raw ? 'true' : 'false';

  if (typeof raw === 'number') return String(raw);

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
      return trimmed.replace(/\//g, '-');
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed.substring(0, 10);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime()) && /^\d/.test(trimmed)) {
      return parsed.toISOString().substring(0, 10);
    }

    return trimmed.toLowerCase();
  }

  try {
    return JSON.stringify(raw) ?? '';
  } catch {
    return String(raw);
  }
}

function toObject(item: unknown): Record<string, unknown> | undefined {
  if (item === null || item === undefined) return undefined;
  if (typeof item === 'object') return item as Record<string, unknown>;
  return undefined;
}

function findDuplicateIssues(
  items: unknown[],
  target: string,
  rules: readonly DuplicateCheckRule[] = [],
): DuplicateIssue[] {
  if (rules.length === 0 || items.length === 0) return [];

  const outputs: DuplicateIssue[] = [];

  for (const rule of rules) {
    const groups = new Map<
      string,
      { values: Record<string, string>; count: number; ids: Array<number | string> }
    >();

    for (const item of items) {
      const row = toObject(item);
      if (!row) continue;

      const keyValues = rule.fields.reduce<Record<string, string>>((acc, field) => {
        const normalized = normalizeDuplicateValue(row[field]);
        acc[field] = normalized === '' ? EMPTY_VALUE_MARK : normalized;
        return acc;
      }, {});

      const hasMissing = Object.values(keyValues).some((value) => value === EMPTY_VALUE_MARK);
      if (hasMissing && rule.ignoreMissing !== false) {
        continue;
      }

      const valuesForKey = Object.values(keyValues).map((value) => value.replace(/\|/g, '\\|'));
      const compositeKey = `${rule.id}${DUPLICATE_KEY_SEPARATOR}${valuesForKey.join(DUPLICATE_KEY_SEPARATOR)}`;
      const prev = groups.get(compositeKey);
      const recordId = getRecordId(item);

      if (!prev) {
        groups.set(compositeKey, {
          values: keyValues,
          count: 1,
          ids: [recordId],
        });
      } else {
        prev.count += 1;
        prev.ids.push(recordId);
      }
    }

    for (const [key, group] of groups) {
      if (group.count > 1) {
        outputs.push({
          target,
          ruleId: rule.id,
          ruleLabel: rule.label,
          key,
          keyValues: group.values,
          recordCount: group.count,
          duplicateCount: Math.max(0, group.count - 1),
          recordIds: group.ids,
        });
      }
    }
  }

  return outputs.sort((a, b) => b.recordCount - a.recordCount);
}

// ────────────────────────────────────────────────────────────────────────────
// Core: validate an array of raw items against a schema
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate an array of raw items against a schema.
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
      const recordId = getRecordId(item);

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
    const duplicateIssues = findDuplicateIssues(items, target.name, target.duplicateChecks);
    const duplicateCount = duplicateIssues.reduce((sum, issue) => sum + issue.duplicateCount, 0);
    const durationMs = Math.round(performance.now() - start);

    results.push({
      target: target.name,
      displayName: target.displayName,
      listTitle: target.listTitle,
      total,
      valid,
      invalid,
      issues,
      duplicateIssues,
      duplicateCount,
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
    lines.push(
      `【${r.target}】 ${r.total}件中 ${r.valid}件 OK / ${r.invalid}件 エラー / ${r.duplicateCount}件 ${DUPLICATE_REPORT_TEXT.possible}${fetchSuffix} (${r.durationMs}ms)`,
    );
    if (r.fetchStatus === 'failed') {
      lines.push(`  ⚠ 取得エラー: ${r.fetchError}`);
    }
    if (r.skippedFields && r.skippedFields.length > 0) {
      lines.push(`  ⚠ 列スキップ: ${r.skippedFields.join(', ')}`);
    }
    for (const issue of r.issues) {
      lines.push(`  ▸ ID ${issue.recordId}: ${issue.messages.join('; ')}`);
    }
    for (const issue of r.duplicateIssues) {
      const keyText = Object.entries(issue.keyValues)
        .map(([field, value]) => `${field}=${value}`)
        .join(', ');
      lines.push(`  ▸ ${DUPLICATE_REPORT_TEXT.keyLabel} (${issue.ruleLabel}): ${keyText} / ${issue.duplicateCount}件`);
    }
    lines.push('');
  }

  const totalInvalid = results.reduce((sum, r) => sum + r.invalid, 0);
  const totalDuplicate = results.reduce((sum, r) => sum + r.duplicateCount, 0);
  const fetchFailures = results.filter((r) => r.fetchStatus === 'failed').length;
  if (fetchFailures > 0) {
    lines.push(`⚠ ${fetchFailures}件のリストで取得エラーがありました（未検証）。`);
  }
  lines.push(
    totalInvalid === 0 && fetchFailures === 0
      ? '✅ すべてのデータが正常です。'
      : totalInvalid > 0
        ? `⚠ ${totalInvalid}件の不整合データが見つかりました。`
        : `⚠ ${totalDuplicate}件の${DUPLICATE_REPORT_TEXT.possible}があります。`,
      );

  return lines.join('\n');
}
