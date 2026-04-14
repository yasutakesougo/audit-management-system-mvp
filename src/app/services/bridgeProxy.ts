import {
  determineWorkflowPhase,
  sortByWorkflowPriority,
  toPlanningWorkflowCardItem,
  type WorkflowPhase,
  type PlanningSheetSnapshot,
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
//
// Narrowing の原則:
//   UI 層には「ドメインの中間表現」ではなく、画面が実際に読むプロパティだけを持つ
//   UI 専用 interface (`PlanningWorkflowUi*`) を返す。ドメイン型 (WorkflowPhaseResult,
//   PlanningWorkflowCardItem, WorkflowSeverity 等) はここで内部化し、UI には露出させない。
//   これにより、ドメイン側の判定構造が変わっても UI 側は影響を受けにくくなる。

/** UI 公開用の計画策定フェーズ (ドメイン WorkflowPhase の別名) */
export type PlanningWorkflowUiPhase =
  | 'needs_assessment'
  | 'needs_plan'
  | 'active_plan'
  | 'needs_monitoring'
  | 'monitoring_overdue'
  | 'needs_reassessment';

/** UI 公開用の深刻度 */
export type PlanningWorkflowUiSeverity = 'info' | 'success' | 'warning' | 'danger';

/**
 * UI からフェーズ判定に渡す計画シートの最小スナップショット。
 *
 * ドメイン側 PlanningSheetSnapshot と structurally compatible だが、
 * UI はこの narrow 型経由でのみ Bridge を呼ぶ。
 */
export interface PlanningWorkflowUiSheetSnapshot {
  id: string;
  status: string;
  appliedFrom?: string | null;
  reviewedAt?: string | null;
  reviewCycleDays?: number;
  procedureCount: number;
  isCurrent?: boolean;
}

/**
 * UI 公開用の Today カードアイテム。
 *
 * ドメイン PlanningWorkflowCardItem から、UI が実際に描画に使うプロパティのみに
 * 絞っている。`priority` などの判定内部情報は含めない。
 */
export interface PlanningWorkflowUiCardItem {
  userId: string;
  userName: string;
  phase: PlanningWorkflowUiPhase;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  severity: PlanningWorkflowUiSeverity;
}

/** buildPlanningWorkflowUi の入力 */
export interface PlanningWorkflowUiBuildInput {
  users: ReadonlyArray<{ userId: string; userName: string }>;
  sheetsByUser: ReadonlyMap<string, ReadonlyArray<PlanningWorkflowUiSheetSnapshot>>;
  referenceDate?: string;
}

/** buildPlanningWorkflowUi の出力 */
export interface PlanningWorkflowUiBuildResult {
  /** priority 順にソート済みの UI 用アイテム一覧 */
  items: PlanningWorkflowUiCardItem[];
  /** 利用者ごとのフェーズ（集計用・未ソート） */
  phases: ReadonlyArray<{ userId: string; phase: PlanningWorkflowUiPhase }>;
}

/**
 * Today 用: 複数利用者のワークフローフェーズ → ソート済み UI カードアイテム一覧
 *
 * 内部で determineWorkflowPhase → sortByWorkflowPriority → toPlanningWorkflowCardItem
 * を合成し、UI に渡す前に narrow 型へ射影する。UI にはドメイン中間表現が漏れない。
 */
export function buildPlanningWorkflowUi(
  input: PlanningWorkflowUiBuildInput,
): PlanningWorkflowUiBuildResult {
  const results = input.users.map((user) =>
    determineWorkflowPhase({
      userId: user.userId,
      userName: user.userName,
      planningSheets: [...(input.sheetsByUser.get(user.userId) ?? [])],
      reassessments: [],
      referenceDate: input.referenceDate,
    }),
  );

  const sorted = sortByWorkflowPriority(results);

  const items: PlanningWorkflowUiCardItem[] = sorted.map((r) => {
    const card = toPlanningWorkflowCardItem(r);
    return {
      userId: card.userId,
      userName: card.userName,
      phase: card.phase,
      title: card.title,
      subtitle: card.subtitle,
      ctaLabel: card.ctaLabel,
      href: card.href,
      severity: card.severity,
    };
  });

  const phases = results.map((r) => ({ userId: r.userId, phase: r.phase }));

  return { items, phases };
}

/**
 * 単一計画シートからフェーズのみを取り出す narrow 関数。
 *
 * SupportPlanningSheet ページの ViewModel 構築など、UI が
 * 「今どのフェーズか」だけを知りたい場面で使う。
 */
export function getPlanningWorkflowPhaseForSheet(input: {
  userId: string;
  userName: string;
  sheet: PlanningWorkflowUiSheetSnapshot;
  referenceDate?: string;
}): { phase: PlanningWorkflowUiPhase } {
  const result = determineWorkflowPhase({
    userId: input.userId,
    userName: input.userName,
    planningSheets: [input.sheet],
    referenceDate: input.referenceDate,
  });
  return { phase: result.phase };
}

// --- 1b. Legacy full-shape shim (pdca 領域用) ---
// 注意: 新規 UI コードからは buildPlanningWorkflowUi / getPlanningWorkflowPhaseForSheet
// を使うこと。この関数は monitoring.daysRemaining など判定内部情報を必要とする
// usePdcaCycleState 等の既存 consumer のために残している。

export type GetPlanningWorkflowPhaseInput = Parameters<typeof determineWorkflowPhase>[0];
export type GetPlanningWorkflowPhaseResult = ReturnType<typeof determineWorkflowPhase>;

export function getPlanningWorkflowPhase(
  input: GetPlanningWorkflowPhaseInput,
): GetPlanningWorkflowPhaseResult {
  return determineWorkflowPhase(input);
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
  ReassessmentSnapshot,
  MeetingEvidenceDraft,
  MeetingEvidenceSection,
  ABCPatternSummary,
  StrategyUsageSummary,
};
