import type { SectionKey } from '../types';

export const SECTION_LABELS: Readonly<Record<SectionKey, string>> = {
  overview: '基本情報',
  assessment: 'アセスメント',
  smart: 'SMART目標',
  supports: '支援内容',
  safety: '安全管理・緊急時対応',
  decision: '意思決定支援',
  compliance: '同意・交付',
  monitoring: 'モニタリング',
  risk: '強度行動障害支援計画 (IBDシート)',
  excellence: 'PDCA・改善記録',
  preview: 'プレビュー',
};

const FIELD_SECTION_MAP: Readonly<Record<string, SectionKey>> = {
  serviceUserName: 'overview',
  supportLevel: 'overview',
  planPeriod: 'overview',
  serviceStartDate: 'overview',
  firstServiceDate: 'overview',
  attendingDays: 'overview',
  medicalConsiderations: 'overview',
  assessmentSummary: 'assessment',
  strengths: 'assessment',
  userRole: 'supports',
  emergencyResponsePlan: 'safety',
  rightsAdvocacy: 'safety',
  riskManagement: 'safety',
  decisionSupport: 'decision',
  conferenceNotes: 'decision',
  monitoringPlan: 'monitoring',
  reviewTiming: 'monitoring',
  lastMonitoringDate: 'monitoring',
  ibdEnvAdjustment: 'risk',
  ibdPbsStrategy: 'risk',
  complianceControls: 'risk',
  improvementIdeas: 'excellence',
};

export const findSectionKeyByFieldKey = (fieldKey: string): SectionKey | undefined => FIELD_SECTION_MAP[fieldKey];
