import type { SupportPlanExportModel } from '../types/export';
import type { SupportPlanTimeline, SupportPlanTimelineEntry } from './timeline.types';
import { buildSupportPlanDiff } from './diffEngine';

/**
 * Summarizes the entire history of a support plan.
 */
export function summarizeSupportPlanTimeline(
  entries: SupportPlanTimelineEntry[]
): SupportPlanTimelineSummary {
  let structuralChanges = 0;
  let criticalSafetyUpdates = 0;
  let lastStructuralChangeAt: string | null = null;
  let lastCriticalSafetyUpdateAt: string | null = null;
  let stagnantSince: string | null = entries.length > 0 ? entries[0].date : null;

  for (const entry of entries) {
    const diff = entry.diffFromPrevious;
    if (diff) {
      if (diff.summary.hasStructuralChange) {
        structuralChanges++;
        lastStructuralChangeAt = entry.date;
        // Stagnation is broken when a structural change occurs
        stagnantSince = entry.date;
      }
      if (diff.summary.hasCriticalSafetyUpdate) {
        criticalSafetyUpdates++;
        lastCriticalSafetyUpdateAt = entry.date;
      }
    }
  }

  return {
    totalVersions: entries.length,
    structuralChanges,
    criticalSafetyUpdates,
    lastStructuralChangeAt,
    lastCriticalSafetyUpdateAt,
    stagnantSince,
  };
}

/**
 * Support Plan Timeline Engine
 * 
 * Arranges normalized export models chronologically and calculates chained differences.
 */
export function buildSupportPlanTimeline(
  models: SupportPlanExportModel[]
): SupportPlanTimeline {
  // 1. Sort by exportedAt ISO string
  const sorted = [...models].sort((a, b) => 
    a.meta.exportedAt.localeCompare(b.meta.exportedAt)
  );

  const entries: SupportPlanTimelineEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = i > 0 ? sorted[i - 1] : null;
    
    const diff = previous ? buildSupportPlanDiff(previous, current) : null;

    entries.push({
      draftId: current.meta.sourceDraftId,
      date: current.meta.exportedAt,
      versionLabel: `v${i + 1}`,
      snapshot: current,
      diffFromPrevious: diff,
    });
  }

  return {
    entries,
    summary: summarizeSupportPlanTimeline(entries),
  };
}
