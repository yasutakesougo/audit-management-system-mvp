/**
 * SupportPlanGuide — Markdown生成・エクスポート
 *
 * buildMarkdown() を SupportPlanGuidePage.tsx から抽出。
 * 振る舞いの変更は一切なし（純粋リファクタリング）。
 */
import type { SupportPlanForm } from '../types';

export const buildMarkdown = (form: SupportPlanForm) => {
  const sections: Array<{ title: string; lines: string[] }> = [
    {
      title: '基本情報',
      lines: [
        form.serviceUserName && `- 利用者名: ${form.serviceUserName}`,
        form.supportLevel && `- 支援区分 / 医療等: ${form.supportLevel}`,
        form.planPeriod && `- 計画期間: ${form.planPeriod}`,
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
      lines: [
        form.longTermGoal && `長期目標: ${form.longTermGoal}`,
        form.shortTermGoals && `短期目標: ${form.shortTermGoals}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '具体的支援内容',
      lines: [
        form.dailySupports && `日中支援: ${form.dailySupports}`,
        form.creativeActivities && `創作/生産活動: ${form.creativeActivities}`,
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
      title: 'モニタリングと見直し',
      lines: [
        form.monitoringPlan && `モニタリング手法: ${form.monitoringPlan}`,
        form.reviewTiming && `見直しタイミング: ${form.reviewTiming}`,
        form.lastMonitoringDate && `直近モニタ実施日: ${form.lastMonitoringDate}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '減算リスク対策',
      lines: [
        form.riskManagement && `リスク管理: ${form.riskManagement}`,
        form.complianceControls && `コンプラ対策: ${form.complianceControls}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '卓越性・改善提案',
      lines: [form.improvementIdeas && form.improvementIdeas].filter(Boolean) as string[],
    },
  ];

  const sectionsBody = sections
    .map((section) => {
      if (section.lines.length === 0) {
        return '';
      }
      return `## ${section.title}\n${section.lines.join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return sectionsBody ? `# 個別支援計画書ドラフト\n\n${sectionsBody}\n` : '# 個別支援計画書ドラフト\n';
};
