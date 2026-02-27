import { z, type ZodType } from 'zod';
import { translateZodIssue } from './zodErrorUtils';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** A single scan target (SharePoint list + Zod schema) */
export interface ScanTarget {
  /** Human-readable name (e.g. 'users', 'daily') */
  name: string;
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

/** Result summary for one scan target */
export interface ScanResult {
  target: string;
  total: number;
  valid: number;
  invalid: number;
  issues: ScanIssue[];
  durationMs: number;
}

/** Progress callback payload */
export interface ScanProgress {
  target: string;
  scanned: number;
  total: number;
  phase: 'fetching' | 'validating' | 'done';
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
  data: Map<string, unknown[]>,
  onProgress?: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): ScanResult[] {
  const results: ScanResult[] = [];

  for (const target of targets) {
    if (signal?.aborted) break;

    const items = data.get(target.name) ?? [];
    const total = items.length;

    onProgress?.({
      target: target.name,
      scanned: 0,
      total,
      phase: 'validating',
    });

    const start = performance.now();
    const { valid, invalid, issues } = validateItems(items, target.schema, target.name);
    const durationMs = Math.round(performance.now() - start);

    results.push({
      target: target.name,
      total,
      valid,
      invalid,
      issues,
      durationMs,
    });

    onProgress?.({
      target: target.name,
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
    lines.push(`【${r.target}】 ${r.total}件中 ${r.valid}件 OK / ${r.invalid}件 エラー (${r.durationMs}ms)`);
    for (const issue of r.issues) {
      lines.push(`  ▸ ID ${issue.recordId}: ${issue.messages.join('; ')}`);
    }
    lines.push('');
  }

  const totalInvalid = results.reduce((sum, r) => sum + r.invalid, 0);
  lines.push(totalInvalid === 0
    ? '✅ すべてのデータが正常です。'
    : `⚠ ${totalInvalid}件の不整合データが見つかりました。`);

  return lines.join('\n');
}
