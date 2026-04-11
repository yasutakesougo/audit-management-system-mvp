/**
 * findingToHandoff — 制度ダッシュボードの finding を申し送りに変換する純粋関数
 *
 * P6 Phase 1: RegulatoryDashboard → Handoff 連携証跡
 *
 * 通常監査 finding と加算系 finding の両方に対応し、
 * handoff 作成に必要な title / body / source / severity / category を生成する。
 *
 * @see useCreateHandoffFromExternalSource — 実際の handoff 作成 hook
 * @see auditChecks.ts — AuditFinding 型
 * @see severeAddonFindings.ts — SevereAddonFinding 型
 */

import type { AuditFinding, AuditFindingType } from './auditChecks';
import { AUDIT_FINDING_TYPE_LABELS } from './auditChecks';
import type { SevereAddonFinding, SevereAddonFindingType } from './severeAddonFindings';
import { SEVERE_ADDON_FINDING_TYPE_LABELS } from './severeAddonFindings';

// ---------------------------------------------------------------------------
// Output 型
// ---------------------------------------------------------------------------

export interface HandoffFromFindingInput {
  title: string;
  body: string;
  sourceType: 'regulatory-finding' | 'severe-addon-finding';
  sourceKey: string;
  sourceLabel: string;
  severity: '通常' | '要注意' | '重要';
  category: '支援の工夫' | '事故・ヒヤリ' | 'その他';
}

// ---------------------------------------------------------------------------
// 通常監査 finding → Handoff
// ---------------------------------------------------------------------------

/** finding severity → handoff severity マッピング */
function toHandoffSeverity(severity: string): '通常' | '要注意' | '重要' {
  switch (severity) {
    case 'high': return '重要';
    case 'medium': return '要注意';
    default: return '通常';
  }
}

/** finding type → handoff category マッピング */
function toHandoffCategory(type: AuditFindingType | SevereAddonFindingType): '支援の工夫' | '事故・ヒヤリ' | 'その他' {
  switch (type) {
    // 安全系
    case 'procedure_record_gap':
    case 'weekly_observation_shortage':
      return '事故・ヒヤリ';
    // 支援内容系
    case 'planning_sheet_missing':
    case 'review_overdue':
    case 'delivery_missing':
    case 'planning_sheet_reassessment_overdue':
    case 'authoring_requirement_unmet':
      return '支援の工夫';
    default:
      return 'その他';
  }
}

// ---------------------------------------------------------------------------
// 文面テンプレート
// ---------------------------------------------------------------------------

const REGULAR_FINDING_TEMPLATES: Record<AuditFindingType, (f: AuditFinding) => string> = {
  planning_sheet_missing: (f) =>
    `${f.userName ?? f.userId} の支援計画シートが未作成です。作成をお願いします。`,
  author_qualification_missing: (f) =>
    `${f.userName ?? f.userId} の支援計画シート作成者の資格が不足しています。資格状況の確認をお願いします。`,
  review_overdue: (f) =>
    `${f.userName ?? f.userId} の支援計画シート見直し期限が${f.overdueDays ? `${Math.abs(f.overdueDays)}日` : ''}超過しています。見直しをお願いします。`,
  procedure_record_gap: (f) =>
    `${f.userName ?? f.userId} の実施記録に空白期間があります。記録の確認をお願いします。`,
  delivery_missing: (f) =>
    `${f.userName ?? f.userId} の支援計画シートが未交付です。交付手続きをお願いします。`,
  add_on_candidate: (f) =>
    `${f.userName ?? f.userId} が加算算定の候補です。要件の確認をお願いします。`,
  monitoring_meeting_missing: (f) =>
    `${f.userName ?? f.userId} のモニタリング会議が未実施です。期間内の実施をお願いします。`,
  monitoring_meeting_unfinalized: (f) =>
    `${f.userName ?? f.userId} のモニタリング会議記録が未確定です。内容の確定をお願いします。`,
  monitoring_qualification_missing: (f) =>
    `${f.userName ?? f.userId} のモニタリング会議に参加した作成者の資格が不足しています。資格状況の確認をお願いします。`,
  monitoring_overdue: (f) =>
    `${f.userName ?? f.userId} のモニタリング実施期限が超過しています。至急実施をお願いします。`,
};

const ADDON_FINDING_TEMPLATES: Record<SevereAddonFindingType, (f: SevereAddonFinding) => string> = {
  severe_addon_tier2_candidate: (f) =>
    `${f.userName ?? f.userId} は加算（Ⅱ）の候補者です。要件の充足状況を確認してください。`,
  severe_addon_tier3_candidate: (f) =>
    `${f.userName ?? f.userId} は加算（Ⅲ）の候補者です。要件の充足状況を確認してください。`,
  basic_training_ratio_insufficient: () =>
    `基礎研修修了者の比率が20%を下回っています。研修受講の計画をお願いします。`,
  planning_sheet_reassessment_overdue: (f) =>
    `${f.userName ?? f.userId} の支援計画シートの再評価が3か月を超過しています。再評価の実施をお願いします。`,
  weekly_observation_shortage: (f) =>
    `${f.userName ?? f.userId} の週次観察記録が不足しています。観察・助言記録の確認をお願いします。`,
  authoring_requirement_unmet: (f) =>
    `${f.userName ?? f.userId} の支援計画シート作成者が実践研修を修了していません。資格状況の確認をお願いします。`,
  assignment_without_required_qualification: (f) =>
    `${f.userName ?? f.userId} に基礎研修未修了の職員が配置されています。配置の見直しをお願いします。`,
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * 通常監査 finding から handoff 作成入力を生成する。
 */
export function buildHandoffFromRegularFinding(finding: AuditFinding): HandoffFromFindingInput {
  const typeLabel = AUDIT_FINDING_TYPE_LABELS[finding.type];
  const template = REGULAR_FINDING_TEMPLATES[finding.type];
  const body = template(finding);

  return {
    title: `【制度チェック】${typeLabel}：${finding.userName ?? finding.userId}`,
    body,
    sourceType: 'regulatory-finding',
    sourceKey: `regulatory-finding:${finding.id}`,
    sourceLabel: typeLabel,
    severity: toHandoffSeverity(finding.severity),
    category: toHandoffCategory(finding.type),
  };
}

/**
 * 加算系 finding から handoff 作成入力を生成する。
 */
export function buildHandoffFromAddonFinding(finding: SevereAddonFinding): HandoffFromFindingInput {
  const typeLabel = SEVERE_ADDON_FINDING_TYPE_LABELS[finding.type];
  const template = ADDON_FINDING_TEMPLATES[finding.type];
  const body = template(finding);

  const userName = finding.userId === '__facility__'
    ? '事業所全体'
    : (finding.userName ?? finding.userId);

  return {
    title: `【加算チェック】${typeLabel}：${userName}`,
    body,
    sourceType: 'severe-addon-finding',
    sourceKey: `severe-addon-finding:${finding.id}`,
    sourceLabel: typeLabel,
    severity: toHandoffSeverity(finding.severity),
    category: toHandoffCategory(finding.type),
  };
}
