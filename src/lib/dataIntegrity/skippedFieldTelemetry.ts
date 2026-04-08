import { emitTelemetry } from '@/lib/telemetry';

export interface SkippedFieldTelemetryParams {
  listKey: string;
  skippedFields: string[];
  /** Number of items successfully fetched in this scan request */
  count: number;
  requestId: string;
}

/**
 * Emit `sp:field_skipped` telemetry for each unique skipped field in a scan.
 *
 * - Deduplicates fieldName within the same call (same scan/request).
 * - Fail-open: a telemetry error never propagates to the caller.
 * - Only called when skippedFields.length > 0 (guard in caller, but safe if called regardless).
 */
export function emitSkippedFieldTelemetry(params: SkippedFieldTelemetryParams): void {
  const { listKey, skippedFields, count, requestId } = params;
  const ts = Date.now();
  const seen = new Set<string>();

  for (const fieldName of skippedFields) {
    if (seen.has(fieldName)) continue;
    seen.add(fieldName);

    try {
      emitTelemetry('sp:field_skipped', {
        listKey,
        fieldName,
        screen: 'data-integrity',
        count,
        requestId,
        ts,
      });
    } catch {
      // Fail-open: telemetry failure must not affect scan flow
    }
  }
}
