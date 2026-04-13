import type { SupportPlanExportModel } from '../types/export';
import { OFFICIAL_ISP_MAP, OFFICIAL_IBD_MAP } from './officialFieldMap';

/**
 * mapToMarkdown — Generates a compliance-ready Markdown string from the Export Model.
 */
export function mapToMarkdown(model: SupportPlanExportModel): string {
  const { coreIsp, goals, ibd, compliance, meta } = model;

  const sections = [
    `# 個別支援計画書 (Draft: ${meta.userName})`,
    `> 作成日時: ${new Date(meta.exportedAt).toLocaleString('ja-JP')} | スキーマ: ${meta.schemaVersion}`,
    '',
    `## 1. ${OFFICIAL_ISP_MAP.header.userName}`,
    `- 利用者名: ${coreIsp.serviceUserName}`,
    `- 支援区分: ${coreIsp.supportLevel}`,
    `- 計画期間: ${coreIsp.planPeriod}`,
    `- 通所日数: ${coreIsp.attendingDays}`,
    '',
    `## 2. ${OFFICIAL_ISP_MAP.assessment.summary}`,
    coreIsp.assessmentSummary || '*未入力*',
    '',
    `### ${OFFICIAL_ISP_MAP.assessment.decision}`,
    coreIsp.decisionSupport || '*未入力*',
    '',
    '## 3. 目標設定 (SMART)',
    `### ${OFFICIAL_ISP_MAP.goals.long}`,
    ...goals.longGoals.map((g, _i) => `${_i + 1}. ${g}`),
    goals.longGoals.length === 0 ? '*設定なし*' : '',
    '',
    `### ${OFFICIAL_ISP_MAP.goals.short}`,
    ...goals.shortGoals.map((g) => `- ${g}`),
    goals.shortGoals.length === 0 ? '*設定なし*' : '',
    '',
    '## 4. 支援内容・具体的方策',
    ...goals.supportMeasures.map((m) => `- ${m}`),
    `- **本人の役割**: ${coreIsp.userRole}`,
    '',
    '## 5. 管理・緊急・権利',
    `### ${OFFICIAL_ISP_MAP.management.monitoring}`,
    coreIsp.monitoringPlan || '*未入力*',
    '',
    `### ${OFFICIAL_ISP_MAP.management.risk}`,
    coreIsp.riskManagement || '*未入力*',
    '',
    `### ${OFFICIAL_ISP_MAP.management.rights}`,
    coreIsp.rightsAdvocacy || '*未入力*',
    '',
  ];

  if (ibd.enabled) {
    sections.push(
      '---',
      `# ${OFFICIAL_IBD_MAP.behavior.adjustment}`,
      `## ${OFFICIAL_IBD_MAP.behavior.adjustment}`,
      ibd.envAdjustment || '*未入力*',
      '',
      `## ${OFFICIAL_IBD_MAP.behavior.pbs}`,
      ibd.pbsStrategy || '*未入力*',
      ''
    );
  }

  // Compliance Footer
  if (!compliance.isExportable) {
    sections.push(
      '---',
      '⚠️ **注意: このドキュメントは必須項目が不足しています。公式様式への出力は制限されています。**',
      ...compliance.issues.map(iss => `- [${iss.severity.toUpperCase()}] ${iss.label}: ${iss.message}`)
    );
  }

  return sections.join('\n');
}
