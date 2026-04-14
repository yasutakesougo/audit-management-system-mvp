import {
  determineWorkflowPhase,
  sortByWorkflowPriority,
  toPlanningWorkflowCardItem,
  type WorkflowPhase,
  type PlanningSheetSnapshot,
  type WorkflowPhaseResult,
  type PlanningWorkflowCardItem,
  type WorkflowSeverity,
} from '@/domain/bridge/workflowPhase';
import {
  buildMeetingEvidenceDraft,
  summarizeABCPatterns,
  summarizeStrategyUsage,
  type MeetingEvidenceDraft,
  type MeetingEvidenceSection,
  type ABCPatternSummary,
  type StrategyUsageSummary,
} from '@/domain/bridge/meetingEvidenceDraft';
import {
  resolveNextStepBanner,
  type BannerContext,
  type BannerTone,
  type NextStepAlertPriority,
  type ResolveNextStepInput,
} from '@/domain/bridge/nextStepBanner';
import type { MonitoringToPlanningBridge } from '@/domain/isp/bridge';
import {
  mapMonitoringToPlanningBridge,
  mapMonitoringMeetingToMonitoringRecord,
} from '@/domain/isp/bridgeMapper';

/**
 * BridgeProxy
 * 
 * UI層 (features/pages) から Domain Bridge への直接参照を遮断するための窓口。
 * ドメイン関数の型（入力・出力）を明示的にエクスポートし、境界を固定する。
 */

// --- Workflow ---

export type GetPlanningWorkflowPhaseInput = Parameters<typeof determineWorkflowPhase>[0];
export type GetPlanningWorkflowPhaseResult = ReturnType<typeof determineWorkflowPhase>;

export function getPlanningWorkflowPhase(
  input: GetPlanningWorkflowPhaseInput
): GetPlanningWorkflowPhaseResult {
  return determineWorkflowPhase(input);
}

export function sortWorkflowItemsByPriority(
  results: WorkflowPhaseResult[]
): WorkflowPhaseResult[] {
  return sortByWorkflowPriority(results);
}

export function getPlanningWorkflowCardItem(
  result: WorkflowPhaseResult
): PlanningWorkflowCardItem {
  return toPlanningWorkflowCardItem(result);
}

// --- Next Step Banner ---

export type {
  BannerContext,
  BannerTone,
  NextStepAlertPriority,
  ResolveNextStepInput,
};

export function getNextStepBanner(
  input: ResolveNextStepInput
): ReturnType<typeof resolveNextStepBanner> {
  return resolveNextStepBanner(input);
}

// --- Meeting Evidence Draft ---

export function getMeetingEvidenceDraft(
  ...args: Parameters<typeof buildMeetingEvidenceDraft>
): ReturnType<typeof buildMeetingEvidenceDraft> {
  return buildMeetingEvidenceDraft(...args);
}

export function getABCPatternSummary(
  ...args: Parameters<typeof summarizeABCPatterns>
): ReturnType<typeof summarizeABCPatterns> {
  return summarizeABCPatterns(...args);
}

export function getStrategyUsageSummary(
  ...args: Parameters<typeof summarizeStrategyUsage>
): ReturnType<typeof summarizeStrategyUsage> {
  return summarizeStrategyUsage(...args);
}

// --- Monitoring Bridge ---

export function getMonitoringToPlanningBridge(
  ...args: Parameters<typeof mapMonitoringToPlanningBridge>
): ReturnType<typeof mapMonitoringToPlanningBridge> {
  return mapMonitoringToPlanningBridge(...args);
}

export function getMonitoringRecordFromMeeting(
  ...args: Parameters<typeof mapMonitoringMeetingToMonitoringRecord>
): ReturnType<typeof mapMonitoringMeetingToMonitoringRecord> {
  return mapMonitoringMeetingToMonitoringRecord(...args);
}

// --- Types ---

export type {
  MonitoringToPlanningBridge,
  WorkflowPhase,
  PlanningSheetSnapshot,
  WorkflowPhaseResult,
  PlanningWorkflowCardItem,
  WorkflowSeverity,
  MeetingEvidenceDraft,
  MeetingEvidenceSection,
  ABCPatternSummary,
  StrategyUsageSummary,
};
