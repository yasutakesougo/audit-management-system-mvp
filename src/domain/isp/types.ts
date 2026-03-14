/**
 * ISP 三層モデル — ドメイン型定義
 *
 * ADR-005 に基づき、個別支援計画（ISP）・支援計画シート・支援手順書兼記録の
 * 三層構造を型レベルで定義する。
 *
 * 既存型との関係:
 *   - 第2層: ibdTypes.ts の SupportPlanSheet と整合
 *   - 第3層: ibdTypes.ts の SupportProcedureManual + SupportScene と整合
 *   - ISPReference: ibdTypes.ts のスナップショット参照を継承
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

// ─────────────────────────────────────────────
// 共通: 監査証跡 (Audit Trail)
// ─────────────────────────────────────────────

/** すべての文書が持つべき監査証跡フィールド */
export interface AuditTrail {
  /** 作成者 ID */
  createdBy: number;
  /** 作成日（ISO 8601） */
  createdAt: string;
  /** 最終更新者 ID */
  updatedBy: number;
  /** 最終更新日（ISO 8601） */
  updatedAt: string;
  /** 版番号（例: "v1", "v2"） */
  version: string;
  /** 承認者 UPN (email) — F-1 追加 */
  approvedBy?: string;
  /** 承認日時（ISO 8601） — F-1 追加 */
  approvedAt?: string;
}

/** 版管理エントリ — 更新時のスナップショットを保持 */
export interface VersionHistoryEntry<T> {
  /** 履歴エントリ ID */
  id: string;
  /** スナップショット時のバージョン */
  version: string;
  /** スナップショット日時（ISO 8601） */
  snapshotAt: string;
  /** 変更実施者 ID */
  changedBy: number;
  /** 変更理由 */
  changeReason: string;
  /** 変更内容サマリ */
  changeSummary: string;
  /** 変更前の完全コピー */
  snapshot: T;
}

// ─────────────────────────────────────────────
// 第1層: ISP（個別支援計画）
// ─────────────────────────────────────────────

/** ISP の状態遷移 */
export type ISPStatus =
  | 'assessment'        // アセスメント
  | 'draft_creation'    // 原案作成
  | 'meeting'           // 会議
  | 'explanation'       // 説明
  | 'consent_obtained'  // 同意取得
  | 'delivered'         // 交付
  | 'implementation'    // 実施
  | 'monitoring'        // モニタリング
  | 'review';           // 見直し

/** ISP 状態の日本語ラベル */
export const ISP_STATUS_LABELS: Record<ISPStatus, string> = {
  assessment: 'アセスメント',
  draft_creation: '原案作成',
  meeting: '会議',
  explanation: '説明',
  consent_obtained: '同意取得',
  delivered: '交付',
  implementation: '実施',
  monitoring: 'モニタリング',
  review: '見直し',
} as const;

/** ISPの許可された状態遷移マップ */
export const ISP_STATUS_TRANSITIONS: Record<ISPStatus, ISPStatus[]> = {
  assessment: ['draft_creation'],
  draft_creation: ['meeting'],
  meeting: ['explanation'],
  explanation: ['consent_obtained'],
  consent_obtained: ['delivered'],
  delivered: ['implementation'],
  implementation: ['monitoring'],
  monitoring: ['review'],
  review: ['draft_creation'],
} as const;

/** 同意記録 */
export interface ConsentRecord {
  /** 同意取得日（ISO 8601） */
  consentDate: string;
  /** 同意者名 */
  consentedBy: string;
  /** 同意者の続柄（本人/家族/後見人等） */
  relationship: string;
  /** 説明実施者 ID */
  explainedBy: number;
  /** 備考 */
  notes?: string;
}

/** 交付記録 */
export interface DeliveryRecord {
  /** 交付日（ISO 8601） */
  deliveryDate: string;
  /** 交付先 */
  deliveredTo: string;
  /** 交付方法（手渡し/郵送等） */
  deliveryMethod: string;
  /** 交付実施者 ID */
  deliveredBy: number;
}

/** モニタリング記録 */
export interface MonitoringRecord {
  /** モニタリング ID */
  id: string;
  /** モニタリング実施日（ISO 8601） */
  monitoringDate: string;
  /** モニタリング実施者 ID */
  monitoredBy: number;
  /** 目標達成状況 */
  goalAchievements: GoalAchievementRecord[];
  /** 総評 */
  overallAssessment: string;
  /** 計画変更の要否 */
  planChangeRequired: boolean;
  /** 変更理由（planChangeRequired が true の場合） */
  changeReason?: string;
  /** 次回モニタリング予定日 */
  nextMonitoringDate?: string;
}

/** 目標達成状況の記録 */
export interface GoalAchievementRecord {
  /** 目標 ID（GoalItem.id と対応） */
  goalId: string;
  /** 達成度（1-5または文字列） */
  achievementLevel: string;
  /** 評価コメント */
  comment: string;
}

/** 会議記録 */
export interface MeetingRecord {
  /** 会議 ID */
  id: string;
  /** 会議日時（ISO 8601） */
  meetingDate: string;
  /** 参加者 ID リスト */
  attendeeIds: number[];
  /** 参加者氏名リスト */
  attendeeNames: string[];
  /** 議題 */
  agenda: string;
  /** 決定事項 */
  decisions: string[];
  /** 備考 */
  notes?: string;
}

/** 個別支援計画（ISP） — 第1層 */
export interface IndividualSupportPlan extends AuditTrail {
  /** ISP ID */
  id: string;
  /** 対象利用者 ID */
  userId: number;
  /** 現在のステータス */
  status: ISPStatus;

  // ── 本質的内容 ──

  /** 本人の意向 */
  personalIntention: string;
  /** 家族の意向 */
  familyIntention: string;
  /** 総合的支援方針 */
  overallSupportPolicy: string;
  /** QOL向上課題 */
  qolImprovementIssues: string[];
  /** 長期目標（概ね1年） */
  longTermGoals: string[];
  /** 短期目標（概ね3〜6ヶ月） */
  shortTermGoals: string[];
  /** 達成時期 */
  targetDate: string;
  /** 留意事項 */
  precautions: string[];

  // ── 運用証跡 ──

  /** 同意記録 */
  consentRecord?: ConsentRecord;
  /** 交付記録 */
  deliveryRecords: DeliveryRecord[];
  /** 会議記録 */
  meetingRecords: MeetingRecord[];
  /** モニタリング記録 */
  monitoringRecords: MonitoringRecord[];
  /** 見直し履歴 */
  reviewHistory: VersionHistoryEntry<IndividualSupportPlan>[];
}

// ─────────────────────────────────────────────
// 第2層: 支援計画シート（ISP→支援計画シートの参照）
// ─────────────────────────────────────────────

/** 支援計画シートの状態 */
export type SupportPlanSheetStatus =
  | 'behavior_assessment'    // 行動特性アセスメント
  | 'hypothesis_organization' // 仮説整理
  | 'plan_creation'          // 支援計画作成
  | 'procedurization'        // 手順化
  | 'service_recording'      // 実施記録
  | 'reassessment'           // 再アセスメント
  | 'revision';              // 改訂

/** 支援計画シート状態の日本語ラベル */
export const SUPPORT_PLAN_SHEET_STATUS_LABELS: Record<SupportPlanSheetStatus, string> = {
  behavior_assessment: '行動特性アセスメント',
  hypothesis_organization: '仮説整理',
  plan_creation: '支援計画作成',
  procedurization: '手順化',
  service_recording: '実施記録',
  reassessment: '再アセスメント',
  revision: '改訂',
} as const;

/** 支援計画シートの状態遷移マップ */
export const SUPPORT_PLAN_SHEET_TRANSITIONS: Record<SupportPlanSheetStatus, SupportPlanSheetStatus[]> = {
  behavior_assessment: ['hypothesis_organization'],
  hypothesis_organization: ['plan_creation'],
  plan_creation: ['procedurization'],
  procedurization: ['service_recording'],
  service_recording: ['reassessment'],
  reassessment: ['revision'],
  revision: ['plan_creation'],
} as const;

/**
 * 支援計画シート三層型 — 第2層
 *
 * 既存の ibdTypes.SupportPlanSheet を制度モデルで補完する拡張型。
 * 実装時は ibdTypes.SupportPlanSheet を extends するか、
 * adapter パターンで変換する。
 */
export interface SupportPlanSheetThreeLayer extends AuditTrail {
  /** 支援計画シート ID */
  id: string;
  /** 対象利用者 ID */
  userId: number;
  /** 紐づく ISP の ID */
  ispId: string;
  /** 現在のステータス */
  status: SupportPlanSheetStatus;

  // ── 行動特性分析 ──

  /** 行動観察（表面的行動） */
  behaviorObservations: string[];
  /** 情報収集（背景情報） */
  informationGathering: string[];
  /** 分析・理解・仮説 */
  analysisAndHypothesis: string;
  /** 支援課題 */
  supportIssues: string[];
  /** 対応方針 */
  responsePolicy: string;
  /** 環境調整 */
  environmentalAdjustments: string[];
  /** 関わり方の具体策 */
  interactionStrategies: string[];

  // ── 版管理 ──

  /** 次回見直し期限（ISO 8601） */
  nextReviewDueDate: string;
  /** 更新履歴 */
  revisionHistory: VersionHistoryEntry<SupportPlanSheetThreeLayer>[];
}

// ─────────────────────────────────────────────
// 第3層: 支援手順書兼記録
// ─────────────────────────────────────────────

/**
 * 支援手順実施記録 — 第3層の記録単位
 *
 * 支援手順書の各ステップに対する実施結果を記録する。
 * 単なる日報ではなく、支援の再現性を担保する実施ログ。
 */
export interface ProcedureExecutionRecord {
  /** 実施記録 ID */
  id: string;
  /** 紐づく支援計画シート ID */
  supportPlanSheetId: string;
  /** 対象利用者 ID */
  userId: number;
  /** 実施日（ISO 8601 日付部分） */
  executionDate: string;

  // ── 実施内容 ──

  /** 時間帯（例: "09:30-10:00"） */
  timeSlot: string;
  /** 活動名 */
  activityName: string;
  /** 場面タイプ（ibdTypes.SceneType と互換） */
  sceneType?: string;
  /** 支援手順の概要 */
  procedureSummary: string;

  // ── 記録 ──

  /** 実施チェック（true: 手順通り実施 / false: 逸脱あり） */
  procedureFollowed: boolean;
  /** 手順逸脱の理由（procedureFollowed が false の場合） */
  deviationReason?: string;
  /** 利用者の様子 */
  observation: string;
  /** 特記事項 */
  notes?: string;
  /** 連絡事項 */
  communicationNotes?: string;

  // ── 実施者情報 ──

  /** 実施者 ID */
  executedBy: number;
  /** 実施日時（ISO 8601） */
  executedAt: string;
  /** 記録入力日時（ISO 8601） */
  recordedAt: string;
}

// ─────────────────────────────────────────────
// 相互参照ビュー
// ─────────────────────────────────────────────

/**
 * 三層統合ビュー — ISP から支援記録まで一気通貫で参照するための集約型
 *
 * UI のトレーサビリティ表示や監査レポート生成に使用。
 */
export interface ThreeLayerTraceabilityView {
  /** 第1層: ISP */
  isp: IndividualSupportPlan;
  /** 第2層: 紐づく支援計画シート群 */
  supportPlanSheets: SupportPlanSheetThreeLayer[];
  /** 第3層: 紐づく実施記録群（支援計画シート ID でグループ化済み） */
  executionRecords: Record<string, ProcedureExecutionRecord[]>;
}

/**
 * ISP → 記録 方向のナビゲーションパス
 *
 * 上位目標から具体支援へ辿るためのリンク構造。
 */
export interface ISPToRecordPath {
  /** ISP ID */
  ispId: string;
  /** 関連する短期目標 */
  shortTermGoal: string;
  /** 支援計画シート ID */
  supportPlanSheetId: string;
  /** 実施記録 ID */
  executionRecordId: string;
}

/**
 * 記録 → ISP 方向のナビゲーションパス
 *
 * 実施記録から根拠となる支援計画・ISP へ戻るためのリンク構造。
 */
export interface RecordToISPPath {
  /** 実施記録 ID */
  executionRecordId: string;
  /** 支援計画シート ID */
  supportPlanSheetId: string;
  /** ISP ID */
  ispId: string;
  /** 関連する ISP 短期目標 */
  relatedGoals: string[];
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * ISP の状態遷移が有効かどうかを検証する
 */
export function isValidISPTransition(
  currentStatus: ISPStatus,
  nextStatus: ISPStatus,
): boolean {
  return ISP_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

/**
 * 支援計画シートの状態遷移が有効かどうかを検証する
 */
export function isValidSupportPlanSheetTransition(
  currentStatus: SupportPlanSheetStatus,
  nextStatus: SupportPlanSheetStatus,
): boolean {
  return SUPPORT_PLAN_SHEET_TRANSITIONS[currentStatus].includes(nextStatus);
}
