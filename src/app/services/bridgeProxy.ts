import {
  determineWorkflowPhase,
  sortByWorkflowPriority,
  toPlanningWorkflowCardItem,
  type WorkflowPhase,
  type PlanningSheetSnapshot,
  type WorkflowPhaseResult,
  type PlanningWorkflowCardItem,
  type WorkflowSeverity,
  type ReassessmentSnapshot,
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
import { summarizeProcedureExecution } from '@/domain/bridge/monitoringEvidence';
import { determinePdcaCycleState } from '@/domain/bridge/pdcaCycleOrchestrator';
import { toDailyProcedureSteps } from '@/domain/isp/bridge/toDailyProcedureSteps';
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

// --- 1. Workflow & Assessment ---
// 計画策定フロー、アセスメント、進捗状態の判定

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

// --- 2. Dashboard & Alerts ---
// 次のアクション、バナー表示、優先度判定

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

// --- 3. Meeting & Evidence ---
// モニタリング会議、証跡下書き、実績集計

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

export function getProcedureExecutionSummary(
  ...args: Parameters<typeof summarizeProcedureExecution>
): ReturnType<typeof summarizeProcedureExecution> {
  return summarizeProcedureExecution(...args);
}

// --- 4. PDCA & Today Operations ---
// サイクル管理、本日の支援手順への変換

export function getPdcaCycleState(
  ...args: Parameters<typeof determinePdcaCycleState>
): ReturnType<typeof determinePdcaCycleState> {
  return determinePdcaCycleState(...args);
}

export function getDailyProcedureSteps(
  ...args: Parameters<typeof toDailyProcedureSteps>
): ReturnType<typeof toDailyProcedureSteps> {
  return toDailyProcedureSteps(...args);
}

// --- 5. Inter-Domain Mappers ---
// ドメイン間の型変換（モニタリング結果から計画案作成など）

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

// --- Exported Types ---
// UI層で使用する Bridge 関連の型定義

export type {
  MonitoringToPlanningBridge,
  WorkflowPhase,
  PlanningSheetSnapshot,
  WorkflowPhaseResult,
  PlanningWorkflowCardItem,
  WorkflowSeverity,
  ReassessmentSnapshot,
  MeetingEvidenceDraft,
  MeetingEvidenceSection,
  ABCPatternSummary,
  StrategyUsageSummary,
};
