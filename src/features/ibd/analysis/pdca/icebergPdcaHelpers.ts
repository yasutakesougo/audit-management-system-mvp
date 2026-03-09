/**
 * Iceberg PDCA — Metrics Computation Helpers
 *
 * Pure helper functions for computing trend labels and derived metric values.
 * Extracted from IcebergPdcaPage.tsx for maintainability.
 *
 * @module features/ibd/analysis/pdca/icebergPdcaHelpers
 */

import type { TrendDirection } from './dailyMetricsAdapter';
import type { DailySnapshotMetrics } from './readDailySnapshot';

// ============================================================================
// Types
// ============================================================================

export interface DailyMetricsResult {
  recordDate: string;
  completionRate: number;
  averageLeadTimeMinutes: number;
  submittedCount: number;
  targetCount: number;
}

// ============================================================================
// Trend Display
// ============================================================================

/**
 * Get arrow label for trend direction
 */
export function trendLabel(trend: TrendDirection): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

// ============================================================================
// Daily Metrics Resolution
// ============================================================================

/**
 * Resolve daily metrics, preferring snapshot data when available
 */
export function resolveDailyMetrics(
  dailyMetrics: DailyMetricsResult,
  dailySnapshotMetrics: DailySnapshotMetrics | null,
): DailyMetricsResult {
  if (!dailySnapshotMetrics) {
    return dailyMetrics;
  }

  return {
    ...dailyMetrics,
    recordDate: dailySnapshotMetrics.targetDate ?? dailyMetrics.recordDate,
    completionRate: dailySnapshotMetrics.completionRate,
    averageLeadTimeMinutes: dailySnapshotMetrics.leadTimeMinutes,
  };
}

// ============================================================================
// Display Labels
// ============================================================================

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatMinutes(minutes: number): string {
  return `${minutes}分`;
}
