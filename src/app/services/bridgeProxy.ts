import { determineWorkflowPhase } from '@/domain/bridge/workflowPhase';
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

export type { MonitoringToPlanningBridge };
