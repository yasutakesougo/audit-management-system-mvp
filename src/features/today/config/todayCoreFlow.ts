import type { DashboardAudience } from '@/features/auth/store';
import { buildDailySupportUrl } from '@/app/links/dailySupportLinks';

export type TodayCoreFlowStep = {
  key: 'today-overview' | 'attendance' | 'daily-table' | 'handoff-timeline' | 'daily-support';
  label: string;
  route: string;
  order: number;
  audience: DashboardAudience[];
  primary: boolean;
};

export const TODAY_CORE_FLOW: readonly TodayCoreFlowStep[] = [
  {
    key: 'today-overview',
    label: '今日の概要を確認',
    route: '/today',
    order: 0,
    audience: ['staff', 'admin'],
    primary: false,
  },
  {
    key: 'attendance',
    label: '出欠を登録する',
    route: '/daily/attendance',
    order: 1,
    audience: ['staff', 'admin'],
    primary: true,
  },
  {
    key: 'daily-table',
    label: '記録を入力する',
    route: '/daily/table',
    order: 2,
    audience: ['staff', 'admin'],
    primary: true,
  },
  {
    key: 'handoff-timeline',
    label: '申し送りを確認',
    route: '/handoff-timeline',
    order: 3,
    audience: ['staff', 'admin'],
    primary: true,
  },
  {
    key: 'daily-support',
    label: '支援手順',
    route: buildDailySupportUrl({ wizard: 'user' }),
    order: 4,
    audience: ['staff', 'admin'],
    primary: true,
  },
] as const;

export const getTodayPrimaryFlowSteps = (role: DashboardAudience): TodayCoreFlowStep[] =>
  TODAY_CORE_FLOW
    .filter((step) => step.primary && step.audience.includes(role))
    .sort((a, b) => a.order - b.order);

