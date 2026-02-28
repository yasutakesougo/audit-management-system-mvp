// ---------------------------------------------------------------------------
// TimeFlow 支援記録 — ユーティリティ関数
// ---------------------------------------------------------------------------

import {
    defaultSupportActivities,
    type SupportActivityTemplate as MasterSupportActivityTemplate,
    SupportActivityTemplateZ,
} from '@/domain/support/types';
import {
    fallbackSupportActivities,
    type SupportActivityTemplate as FlowSupportActivityTemplate,
    type SupportPlanDeployment,
} from '@/features/planDeployment/supportFlow';
import {
    categoryToStageMap,
    SUPPORT_ACTIVITY_STORAGE_KEY,
} from './timeFlowConstants';
import type { DailySupportRecord, SupportRecord } from './timeFlowTypes';

// ===== マスタテンプレート構築 =====

export const buildDefaultMasterTemplates = (): MasterSupportActivityTemplate[] =>
  defaultSupportActivities.map((template, index) => ({
    ...template,
    iconEmoji: template.iconEmoji ?? '📋',
    id: `default-${index + 1}`,
  }));

// ===== 時刻正規化 =====

export const normalizeTemplateTime = (rawTime: string): string => {
  const trimmed = rawTime?.trim();
  if (!trimmed) {
    return '00:00';
  }

  const match = trimmed.match(/^(\d{1,2})(?:[:：](\d{1,2}))?$/);
  if (!match) {
    return trimmed;
  }

  const hours = Math.min(23, Math.max(0, Number.parseInt(match[1], 10) || 0));
  const minutesValue = match[2] ?? '0';
  const minutes = Math.min(59, Math.max(0, Number.parseInt(minutesValue, 10) || 0));

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// ===== マスタ→フロー形式変換 =====

export const convertMasterTemplates = (
  templates: MasterSupportActivityTemplate[],
): FlowSupportActivityTemplate[] => {
  return templates
    .map((template) => ({
      time: normalizeTemplateTime(template.specificTime),
      title: template.activityName,
      personTodo: template.userExpectedActions,
      supporterTodo: template.staffSupportMethods,
      stage: categoryToStageMap[template.category] ?? 'proactive',
    }))
    .sort((a, b) => a.time.localeCompare(b.time, 'ja'));
};

// ===== デフォルトのフロー版マスタ活動 =====

export const DEFAULT_FLOW_MASTER_ACTIVITIES = convertMasterTemplates(buildDefaultMasterTemplates());

// ===== 記録済みスロット数算出 =====

export const countRecordedSlots = (records: SupportRecord[]): number =>
  records.filter((record) => record.status === '記録済み').length;

// ===== LocalStorageからマスタ読み込み =====

export const loadMasterSupportActivities = (): FlowSupportActivityTemplate[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_FLOW_MASTER_ACTIVITIES;
  }

  const raw = window.localStorage.getItem(SUPPORT_ACTIVITY_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_FLOW_MASTER_ACTIVITIES;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_FLOW_MASTER_ACTIVITIES;
    }

    const templates: MasterSupportActivityTemplate[] = parsed.reduce<MasterSupportActivityTemplate[]>(
      (acc, item, index) => {
        const result = SupportActivityTemplateZ.safeParse(item);
        if (result.success) {
          acc.push({
            ...result.data,
            iconEmoji: result.data.iconEmoji ?? '📋',
            id: result.data.id || `restored-${index}`,
          });
        }
        return acc;
      },
      [],
    );

    if (templates.length === 0) {
      return DEFAULT_FLOW_MASTER_ACTIVITIES;
    }

    return convertMasterTemplates(templates);
  } catch {
    return DEFAULT_FLOW_MASTER_ACTIVITIES;
  }
};

// ===== モック日次記録生成 =====

export const generateMockTimeFlowDailyRecord = (
  user: { id: string; name: string },
  date: string,
  activities: FlowSupportActivityTemplate[],
  deployment: SupportPlanDeployment | null,
): DailySupportRecord => {
  const moodSamples: Array<SupportRecord['userCondition']['mood']> = ['良好', '普通', '良好', '良好'];
  const behaviorSamples = [
    '朝の会で落ち着いて参加できました',
    '課題に集中し、質問も適切に行えています',
    '好きな音楽を聴きながらリラックスできています',
    '落ち着いた様子で食事を楽しめています',
  ];

  const limitedActivities = activities.slice(0, Math.min(4, activities.length));

  const sampleRecords: SupportRecord[] = limitedActivities.map((activity, index) => {
    const mood = moodSamples[index % moodSamples.length];
    const behavior = behaviorSamples[index % behaviorSamples.length];

    return {
      id: Date.now() + index,
      supportPlanId: deployment?.planId ?? `plan-${user.id}`,
      personId: user.id,
      personName: user.name,
      date,
      timeSlot: `${activity.time} ${activity.title}`,
      activityKey: activity.time,
      activityName: activity.title,
      userActivities: {
        planned: activity.personTodo,
        actual: behavior,
        notes: '',
      },
      staffActivities: {
        planned: activity.supporterTodo,
        actual: activity.supporterTodo,
        notes: '',
      },
      userCondition: {
        mood,
        behavior,
        communication: undefined,
        physicalState: '体調良好',
      },
      specialNotes: {},
      reporter: {
        name: '支援員A',
        role: '生活支援員',
      },
      status: '記録済み',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      abc:
        index === 1
          ? {
              antecedent: '課題中',
              behavior: '質問をする',
              consequence: '一緒に確認して再開',
              intensity: '中度',
            }
          : undefined,
    } satisfies SupportRecord;
  });

  return {
    id: Date.now(),
    supportPlanId: deployment?.planId ?? `plan-${user.id}`,
    personId: user.id,
    personName: user.name,
    date,
    records: sampleRecords,
    summary: {
      totalTimeSlots: activities.length,
      recordedTimeSlots: sampleRecords.length,
      concerningIncidents: 0,
      achievementHighlights: sampleRecords.length,
      overallProgress: '良好',
    },
    dailyNotes: deployment?.summary
      ? `計画サマリー: ${deployment.summary}`
      : `${user.name}さんは本日、全体的に落ち着いて過ごせており、課題にも意欲的に参加できています。`,
    completedBy: '支援員A',
    completedAt: new Date().toISOString(),
    status: '作成中',
  };
};

// ===== Re-export =====

export { fallbackSupportActivities };
export type { FlowSupportActivityTemplate, SupportPlanDeployment };
