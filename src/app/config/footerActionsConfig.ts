import { TESTIDS } from '@/testids';

export type FooterAction = {
  key: string;
  label: string;
  color: 'primary' | 'secondary' | 'info';
  variant: 'contained' | 'outlined';
  to?: string;
  onClickKey?: 'handoff-quicknote';
};

/**
 * Single source of truth for the expected paths of all footer links
 * Used by Diagnostics UI and Nav <-> Router Consistency CI Tests.
 */
export const FOOTER_HREFS = [
  '/schedules/month',
  '/daily/attendance',
  '/daily/table',
  '/daily/support',
] as const;

export const footerTestIds: Record<string, string> = {
  'schedules-month': TESTIDS['schedules-footer-month'],
  'daily-attendance': TESTIDS['daily-footer-attendance'],
  'daily-activity': TESTIDS['daily-footer-activity'],
  'daily-support': TESTIDS['daily-footer-support'],
  'handoff-quicknote': TESTIDS['handoff-footer-quicknote'],
};

export const footerAccentByKey: Record<string, string> = {
  'handoff-quicknote': '#C53030',
  'schedules-month': '#B7791F',
  'daily-attendance': '#2F855A',
  'daily-activity': '#C05621',
  'daily-support': '#6B46C1',
};

export const footerShortLabelByKey: Record<string, string> = {
  'handoff-quicknote': '申し送り',
  'schedules-month': '予定',
  'daily-attendance': '通所',
  'daily-activity': 'ケース記録',
  'daily-support': '支援手順',
};

type CreateFooterActionsParams = {
  schedulesEnabled?: boolean;
};

export const createFooterActions = ({
  schedulesEnabled = false,
}: CreateFooterActionsParams): FooterAction[] => {
  const scheduleMonthAction: FooterAction = {
    key: 'schedules-month',
    label: 'スケジュール',
    to: '/schedules/month',
    color: 'info',
    variant: 'contained',
  };

  const baseActions: FooterAction[] = [
    {
      key: 'daily-attendance',
      label: '通所管理',
      to: '/daily/attendance',
      color: 'info',
      variant: 'contained',
    },
    {
      key: 'daily-activity',
      label: 'ケース記録入力',
      to: '/daily/table',
      color: 'primary',
      variant: 'contained',
    },
    {
      key: 'daily-support',
      label: '支援手順記録入力',
      to: '/daily/support',
      color: 'primary',
      variant: 'outlined',
    },
  ];

  const actions: FooterAction[] = [
    {
      key: 'handoff-quicknote',
      label: '今すぐ申し送り',
      color: 'secondary',
      variant: 'contained',
      onClickKey: 'handoff-quicknote',
    },
  ];

  if (schedulesEnabled) {
    actions.push(scheduleMonthAction);
  }

  actions.push(...baseActions);

  return actions;
};
