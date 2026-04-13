/**
 * SupportPlanGuide — Markdown生成・エクスポート
 *
 * buildMarkdown() を SupportPlanGuidePage.tsx から抽出。
 *
 * Phase 5: form.goals (GoalItem[]) のみを出力ソースとする。
 * Phase P2-A: buildSupportPlanMarkdown() で compliance / deadline を統合。
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { IspComplianceMetadata } from '@/domain/isp/schema';
import type { DeadlineInfo, SupportPlanForm } from '../types';

// ────────────────────────────────────────────
// Export Model
// ────────────────────────────────────────────

/** Markdown / PDF 出力用の統合モデル */
export type SupportPlanExportModel = {
  /** フォームデータ */
  form: SupportPlanForm;
  /** コンプライアンスメタデータ（null = 未設定） */
  compliance: IspComplianceMetadata | null;
  /** 期限情報 */
  deadlines: {
    creation: DeadlineInfo;
    monitoring: DeadlineInfo;
  };
};

// ────────────────────────────────────────────
// Goal → Markdown 変換ヘルパー
// ────────────────────────────────────────────

/** GoalItem[] を type でフィルタし、箇条書き Markdown 行を生成する */
function goalsToLines(goals: GoalItem[] | undefined, type: GoalItem['type']): string[] {
  const filtered = goals?.filter((g) => g.type === type) ?? [];
  if (filtered.length === 0) return [];
  return filtered.map((g) => {
    const label = g.label?.trim() ? `**${g.label.trim()}**: ` : '';
    const text = g.text?.trim() ?? '';
    return `- ${label}${text}`;
  });
}

// ────────────────────────────────────────────
// Form → Sections (共通ロジック)
// ────────────────────────────────────────────

type MdSection = { title: string; lines: string[] };

/** フォームデータからセクション一覧を構築する（form 部分のみ） */
function buildFormSections(form: SupportPlanForm): MdSection[] {
  const longGoalLines = goalsToLines(form.goals, 'long');
  const shortGoalLines = goalsToLines(form.goals, 'short');
  const supportGoalLines = goalsToLines(form.goals, 'support');

  const goalSectionLines = [
    ...(longGoalLines.length > 0 ? ['### 長期目標', ...longGoalLines] : []),
    ...(shortGoalLines.length > 0 ? ['### 短期目標', ...shortGoalLines] : []),
  ];

  return [
    {
      title: '基本情報',
      lines: [
        form.serviceUserName && `- 利用者名: ${form.serviceUserName}`,
        form.supportLevel && `- 支援区分 / 医療等: ${form.supportLevel}`,
        form.serviceStartDate && `- 契約開始日: ${form.serviceStartDate}`,
        form.firstServiceDate && `- 実際の初回提供日: ${form.firstServiceDate}`,
        form.planPeriod && `- 計画期間: ${form.planPeriod}`,
        form.attendingDays && `- 通所日数・時間: ${form.attendingDays}`,
        form.medicalConsiderations && `\n**医療的配慮事項**\n${form.medicalConsiderations}`,
      ].filter(Boolean) as string[],
    },
    {
      title: 'アセスメント要約',
      lines: [
        form.assessmentSummary && form.assessmentSummary,
        form.strengths && `強み・資源: ${form.strengths}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '目標（SMART）',
      lines: goalSectionLines,
    },
    {
      title: '具体的支援内容',
      lines: [
        ...supportGoalLines,
        form.userRole && `\n**本人の役割・教育的目標**\n${form.userRole}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '意思決定支援・会議記録',
      lines: [
        form.decisionSupport && `意思決定支援: ${form.decisionSupport}`,
        form.conferenceNotes && `サービス担当者会議: ${form.conferenceNotes}`,
      ].filter(Boolean) as string[],
    },
    {
      title: 'リスク管理・安全対策',
      lines: [
        form.safetyPrecautions && `安全対策: ${form.safetyPrecautions}`,
        form.medicalEmergencyResponse && `医療的緊急対応: ${form.medicalEmergencyResponse}`,
        form.abusePrevention && `虐待防止・権利擁護: ${form.abusePrevention}`,
        form.emergencyResponsePlan && `緊急時対応計画: ${form.emergencyResponsePlan}`,
        form.riskManagement && `リスク管理: ${form.riskManagement}`,
      ].filter(Boolean) as string[],
    },
    {
      title: 'モニタリングと見直し',
      lines: [
        form.monitoringPlan && `モニタリング手法: ${form.monitoringPlan}`,
        form.reviewTiming && `見直しタイミング: ${form.reviewTiming}`,
        form.lastMonitoringDate && `直近モニタ実施日: ${form.lastMonitoringDate}`,
      ].filter(Boolean) as string[],
    },
    // NOTE: 強度行動障害 (IBDシート) 関連は buildIbdSheetMarkdown で出力するため ISPからは除外
  ];
}

/** セクション配列を Markdown 文字列にレンダリングする */
function renderSections(sections: MdSection[]): string {
  return sections
    .map((section) => {
      if (section.lines.length === 0) return '';
      return `## ${section.title}\n${section.lines.join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

// ────────────────────────────────────────────
// Compliance → Markdown セクション
// ────────────────────────────────────────────

/** ISO 8601 日付文字列を日本語日付に変換 */
function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '未入力';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '未入力';
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '未入力';
  }
}

/** コンプライアンスデータから Markdown セクションを構築 */
function buildComplianceSection(compliance: IspComplianceMetadata | null): MdSection {
  if (!compliance) {
    return { title: '制度適合（コンプライアンス）', lines: [] };
  }

  const {
    consent,
    delivery,
    approval,
    meeting = { meetingDate: null, attendees: [], meetingMinutes: '' },
    consultationSupport = { agencyName: '', officerName: '', serviceUsePlanReceivedAt: null, gapNotes: '' },
    standardServiceHours,
  } = compliance;
  const lines: string[] = [];

  // 基本サービス
  if (standardServiceHours) {
    lines.push(`- 標準支援提供時間: ${standardServiceHours}時間`);
  }

  // 同意記録
  lines.push('### 同意記録');
  lines.push(`- 説明実施日: ${formatIsoDate(consent.explainedAt)}`);
  if (consent.explainedBy) lines.push(`- 説明実施者: ${consent.explainedBy}`);
  lines.push(`- 同意取得日: ${formatIsoDate(consent.consentedAt)}`);
  if (consent.consentedBy) lines.push(`- 同意者: ${consent.consentedBy}`);
  if (consent.proxyName) {
    lines.push(`- 代理人: ${consent.proxyName}${consent.proxyRelation ? `（${consent.proxyRelation}）` : ''}`);
    if (consent.proxyReason) lines.push(`  - 代理同意理由: ${consent.proxyReason}`);
  }
  if (consent.consentMethod) {
    const methods: Record<string, string> = {
      signature: '署名',
      seal: '記名押印',
      electronic: '電子署名',
      other: 'その他',
    };
    lines.push(`- 同意方法: ${methods[consent.consentMethod] || consent.consentMethod}`);
  }
  if (consent.notes) lines.push(`- 備考: ${consent.notes}`);

  // 交付記録
  lines.push('### 交付記録');
  lines.push(`- 交付日: ${formatIsoDate(delivery.deliveredAt)}`);
  lines.push(`- 本人への交付: ${delivery.deliveredToUser ? '✓ 済' : '✗ 未'}`);
  lines.push(`- 相談支援専門員への交付: ${delivery.deliveredToConsultationSupport ? '✓ 済' : '✗ 未'}`);
  if (delivery.deliveryMethod) lines.push(`- 交付方法: ${delivery.deliveryMethod}`);
  if (delivery.notes) lines.push(`- 備考: ${delivery.notes}`);

  // 会議記録
  lines.push('### サービス担当者会議記録');
  lines.push(`- 実施日: ${formatIsoDate(meeting.meetingDate)}`);
  if (meeting.attendees.length > 0) lines.push(`- 出席者: ${meeting.attendees.join(', ')}`);
  if (meeting.meetingMinutes) lines.push(`- 議事要旨: ${meeting.meetingMinutes}`);

  // 相談支援連携
  lines.push('### 相談支援連携');
  if (consultationSupport.agencyName) lines.push(`- 相談支援事業所: ${consultationSupport.agencyName}`);
  if (consultationSupport.officerName) lines.push(`- 相談支援専門員: ${consultationSupport.officerName}`);
  lines.push(`- 利用計画受領日: ${formatIsoDate(consultationSupport.serviceUsePlanReceivedAt)}`);
  if (consultationSupport.gapNotes) lines.push(`- 利用計画との不整合メモ: ${consultationSupport.gapNotes}`);

  // 承認記録
  lines.push('### 承認記録');
  lines.push(`- ステータス: ${approval.approvalStatus === 'approved' ? '✓ 承認済み' : '下書き'}`);
  if (approval.approvedBy) lines.push(`- 承認者: ${approval.approvedBy}`);
  if (approval.approvedAt) lines.push(`- 承認日時: ${formatIsoDate(approval.approvedAt)}`);

  return { title: '制度適合（コンプライアンス）', lines };
}

// ────────────────────────────────────────────
// Deadline → Markdown セクション
// ────────────────────────────────────────────

/** DeadlineInfo の色をステータス文字列に変換 */
function deadlineStatus(info: DeadlineInfo): string {
  if (info.daysLeft === undefined || !info.date) return '未設定';
  if (info.daysLeft < 0) return `⚠ ${Math.abs(info.daysLeft)}日超過`;
  if (info.daysLeft === 0) return '⚠ 本日期限';
  return `残り ${info.daysLeft}日`;
}

/** 期限情報から Markdown セクションを構築 */
function buildDeadlineSection(deadlines: SupportPlanExportModel['deadlines']): MdSection {
  const { creation, monitoring } = deadlines;
  const lines: string[] = [];

  // 作成期限
  const creationDate = creation.date
    ? creation.date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '未設定';
  lines.push(`- ${creation.label}: ${creationDate}（${deadlineStatus(creation)}）`);

  // モニタ期限
  const monitoringDate = monitoring.date
    ? monitoring.date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '未設定';
  lines.push(`- ${monitoring.label}: ${monitoringDate}（${deadlineStatus(monitoring)}）`);

  return { title: '期限管理', lines };
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * @deprecated P2-A: buildSupportPlanMarkdown() を使用してください。
 * 後方互換のため残しています。
 */
export const buildMarkdown = (form: SupportPlanForm): string => {
  const sections = buildFormSections(form);
  const body = renderSections(sections);
  return body ? `# 個別支援計画書\n\n${body}\n` : '# 個別支援計画書\n';
};

/**
 * P2-A: ExportModel から Markdown を生成する。
 *
 * form + compliance + deadlines を統合して出力。
 */
export const buildSupportPlanMarkdown = (model: SupportPlanExportModel): string => {
  const formSections = buildFormSections(model.form);
  const complianceSection = buildComplianceSection(model.compliance);
  const deadlineSection = buildDeadlineSection(model.deadlines);

  const allSections = [
    ...formSections,
    complianceSection,
    deadlineSection,
  ];

  const body = renderSections(allSections);
  return body ? `# 個別支援計画書\n\n${body}\n` : '# 個別支援計画書\n';
};

/**
 * 強度行動障害支援計画シート専用の Markdown を生成する。
 * (ISP とは別の法的文書としての体裁)
 */
export const buildIbdSheetMarkdown = (form: SupportPlanForm): string => {
  const sections: MdSection[] = [
    {
      title: '強度行動障害支援計画シート (案)',
      lines: [
        `- 利用者名: ${form.serviceUserName || '未入力'}`,
        `- 作成日: ${new Date().toLocaleDateString('ja-JP')}`,
        `- 計画期間: ${form.planPeriod || '未入力'}`,
      ],
    },
    {
      title: '1. 環境調整・コミュニケーション支援',
      lines: [form.ibdEnvAdjustment || '未入力'],
    },
    {
      title: '2. 肯定的行動支援 (PBS)・対応手順',
      lines: [form.ibdPbsStrategy || '未入力'],
    },
    {
      title: '3. 権利擁護の取り組み',
      lines: [form.rightsAdvocacy || '未入力'],
    },
    {
      title: '4. 特記事項・改善案',
      lines: [form.improvementIdeas || '未入力'],
    },
  ];

  const body = renderSections(sections);
  return body ? `# 強度行動障害支援計画シート\n\n${body}\n` : '# 強度行動障害支援計画シート\n';
};
