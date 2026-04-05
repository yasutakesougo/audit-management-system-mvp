/**
 * handoffTemplates.ts — handoff 送信先テンプレート定義
 *
 * 責務:
 * - 送信先 audience 別の初期選択状態（defaultSelection）を定義
 * - audience 別の payload 出力順序（sectionOrder）を定義
 */
import type { HandoffSectionSelection } from './buildHandoffPayload';

export type HandoffAudience = 'field' | 'admin';

export type SectionKey = 'summary' | 'reports' | 'decisions' | 'actions' | 'notifications';

export type HandoffTemplate = {
  audience: HandoffAudience;
  label: string;
  defaultSelection: Required<Omit<HandoffSectionSelection, 'extraText' | 'sectionOrder' | 'audience'>>;
  sectionOrder: SectionKey[];
};

export const HANDOFF_TEMPLATES: Record<HandoffAudience, HandoffTemplate> = {
  field: {
    audience: 'field',
    label: '現場申し送り',
    defaultSelection: {
      includeSummary: false,
      includeReports: false,
      includeDecisions: true,
      includeActions: true,
      includeNotifications: true,
    },
    // 優先順: actions -> notifications -> decisions -> reports -> summary
    sectionOrder: ['actions', 'notifications', 'decisions', 'reports', 'summary'],
  },
  admin: {
    audience: 'admin',
    label: '管理者共有',
    defaultSelection: {
      includeSummary: true,
      includeReports: true,
      includeDecisions: true,
      includeActions: true,
      includeNotifications: true,
    },
    // 優先順: summary -> reports -> decisions -> actions -> notifications
    sectionOrder: ['summary', 'reports', 'decisions', 'actions', 'notifications'],
  },
};
